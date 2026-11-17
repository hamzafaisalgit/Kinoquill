import { z } from "zod";
import type { KinoquillDatabase } from "../db/database";
import type { ShowMetadata, SeasonTracking } from "../types/domain";
import type { TitleEditIdentity, TitleSaveInput } from "./titleRecordService";
import { TitleRecordService } from "./titleRecordService";
import { activeEntry, domainTables, required, write } from "./domainSupport";
import { dateSchema, validate } from "../utils/validation";
import { ConflictError, ValidationError } from "../utils/errors";
import { TvProgressService } from "./tvProgressService";
import { tvProgress, seasonProgress } from "../utils/tvProgress";
import { UNKNOWN_DATE } from "../utils/dates";
import { now } from "../utils/normalization";
import { getSeasonEpisodes } from "./tmdb/api";
import { isCalendarDate } from "../utils/dates";
import type { z as Zod } from "zod";
import {
  seasonCreateSchema,
  seasonUpdateSchema,
  episodeCreateSchema,
  episodeUpdateSchema,
} from "../utils/validation";

export const showMetadataSchema = z
  .object({
    lastAirDate: z
      .string()
      .nullable()
      .refine(
        (value) =>
          value === null ||
          dateSchema.safeParse({ precision: "day", value }).success,
        "Enter a valid last air date.",
      ),
    totalSeasons: z.number().int().nonnegative().nullable(),
    totalEpisodes: z.number().int().nonnegative().nullable(),
    includeSpecials: z.boolean(),
  })
  .strict();
export interface ShowSaveInput extends TitleSaveInput {
  show: Omit<ShowMetadata, "titleId">;
  seasons?: {
    number: number;
    name: string;
    episodeCount: number | null;
    airDate: string | null;
  }[];
}
export class ShowService extends TitleRecordService {
  constructor(db: KinoquillDatabase) {
    super(db, "tv");
  }
  async getShow(id: string) {
    return this.db.transaction("r", domainTables(this.db), async () => ({
      ...(await this.getRecord(id)),
      show: (await this.db.showMetadata.get(id)) ?? {
        titleId: id,
        lastAirDate: null,
        totalSeasons: null,
        totalEpisodes: null,
        includeSpecials: false,
      },
    }));
  }
  async saveShow(
    input: ShowSaveInput,
    edit?: TitleEditIdentity,
    confirm = false,
  ) {
    const metadata = validate(showMetadataSchema, input.show);
    if (
      metadata.lastAirDate &&
      input.metadata.releaseDate &&
      metadata.lastAirDate < input.metadata.releaseDate
    )
      throw new ValidationError(
        "Last air date cannot precede the first air date.",
      );
    return write(this.db, async () => {
      const record = await this.saveRecord(
        { ...input, dateChanged: false },
        edit,
        confirm,
      );
      await this.db.showMetadata.put({ ...metadata, titleId: record.title.id });
      if (!edit)
        for (const season of input.seasons ?? [])
          await new TvProgressService(this.db).createSeason({
            titleId: record.title.id,
            seasonNumber: season.number,
            name: season.name,
            episodeCount: season.episodeCount,
            releaseDate: season.airDate,
          });
      return this.getShow(record.title.id);
    });
  }
  async tracking(titleId: string) {
    return this.db.transaction("r", domainTables(this.db), async () => {
      const record = await this.getShow(titleId);
      const seasons = await this.db.seasons
        .where("titleId")
        .equals(titleId)
        .sortBy("seasonNumber");
      const episodes = await this.db.episodes
        .where("seasonId")
        .anyOf(seasons.map((item) => item.id))
        .toArray();
      const progress = await this.db.episodeProgress
        .where("libraryEntryId")
        .equals(record.entry.id)
        .toArray();
      const tracking = await this.db.seasonTracking
        .where("libraryEntryId")
        .equals(record.entry.id)
        .toArray();
      return {
        ...record,
        seasons,
        episodes,
        progress,
        tracking,
        summary: tvProgress(seasons, episodes, progress, tracking, record.show),
      };
    });
  }
  async seasonState(entryId: string, seasonId: string) {
    const entry = await activeEntry(this.db, entryId),
      season = await required(this.db.seasons, seasonId, "Season");
    if (season.titleId !== entry.titleId)
      throw new ValidationError("Season does not belong to this show.");
    const tracking = (await this.db.seasonTracking.get([
      entryId,
      seasonId,
    ])) ?? {
      libraryEntryId: entryId,
      seasonId,
      mode: "exact" as const,
      approximateWatched: 0,
      personalRating: null,
      updatedAt: now(),
    };
    return { entry, season, tracking };
  }
  async rateSeason(entryId: string, seasonId: string, rating: number | null) {
    if (
      rating !== null &&
      (!Number.isFinite(rating) ||
        rating < 0 ||
        rating > 10 ||
        !Number.isInteger(rating * 2))
    )
      throw new ValidationError("Season ratings use half points from 0 to 10.");
    return write(this.db, async () => {
      const { tracking } = await this.seasonState(entryId, seasonId);
      await this.db.seasonTracking.put({
        ...tracking,
        personalRating: rating,
        updatedAt: now(),
      });
    });
  }
  async saveSeason(
    entryId: string,
    input: Zod.input<typeof seasonCreateSchema>,
    id?: string,
  ) {
    return write(this.db, async () => {
      const entry = await activeEntry(this.db, entryId);
      if (entry.titleId !== input.titleId)
        throw new ValidationError("Season does not belong to this show.");
      if (id) {
        const { tracking } = await this.seasonState(entryId, id);
        if (
          input.episodeCount != null &&
          tracking.mode === "approximate" &&
          tracking.approximateWatched > input.episodeCount
        )
          throw new ConflictError(
            "The total cannot exclude your approximate watched count.",
          );
        const { titleId, ...patch } = input;
        void titleId;
        return new TvProgressService(this.db).updateSeason(
          id,
          validate(seasonUpdateSchema, patch),
        );
      }
      return new TvProgressService(this.db).createSeason(input);
    });
  }
  async saveEpisode(
    entryId: string,
    input: Zod.input<typeof episodeCreateSchema>,
    id?: string,
  ) {
    return write(this.db, async () => {
      await this.seasonState(entryId, input.seasonId);
      if (id) {
        const current = await required(this.db.episodes, id, "Episode");
        if (current.seasonId !== input.seasonId)
          throw new ValidationError("Episode belongs to another season.");
        const { seasonId, ...patch } = input;
        void seasonId;
        return new TvProgressService(this.db).updateEpisode(
          id,
          validate(episodeUpdateSchema, patch),
        );
      }
      return new TvProgressService(this.db).createEpisode(input);
    });
  }
  async loadSeason(entryId: string, seasonId: string) {
    const { season, entry } = await this.seasonState(entryId, seasonId);
    const title = await required(this.db.titles, entry.titleId, "Show");
    if (!title.tmdbId)
      throw new ValidationError(
        "This show has no TMDB ID. Add episodes manually.",
      );
    const remote = await getSeasonEpisodes(title.tmdbId, season.seasonNumber);
    return write(this.db, async () => {
      const latest = await this.seasonState(entryId, seasonId);
      if (latest.season.seasonNumber !== season.seasonNumber)
        throw new ConflictError(
          "Season changed while fetching. Please try again.",
        );
      const tv = new TvProgressService(this.db);
      const existing = await tv.listEpisodes(seasonId);
      let added = 0;
      const count = Math.max(
        latest.season.episodeCount ?? 0,
        ...remote.map((episode) => episode.episode_number),
      );
      if (count > (latest.season.episodeCount ?? 0))
        await tv.updateSeason(seasonId, { episodeCount: count });
      for (const episode of remote)
        if (
          !existing.some(
            (item) => item.episodeNumber === episode.episode_number,
          )
        ) {
          await tv.createEpisode({
            seasonId,
            episodeNumber: episode.episode_number,
            name: episode.name ?? null,
            runtimeMinutes: episode.runtime || null,
            airDate:
              episode.air_date && isCalendarDate(episode.air_date)
                ? episode.air_date
                : null,
          });
          added++;
        }
      return added;
    });
  }
  async quickProgress(
    entryId: string,
    seasonId: string,
    count: number,
    mode: SeasonTracking["mode"],
    confirmed: boolean,
  ) {
    if (!confirmed)
      throw new ConflictError("Confirm the season progress change first.");
    if (!Number.isSafeInteger(count) || count < 0)
      throw new ValidationError("Enter a whole watched count of zero or more.");
    return write(this.db, async () => {
      const { season, tracking } = await this.seasonState(entryId, seasonId);
      if (season.episodeCount !== null && count > season.episodeCount)
        throw new ValidationError(
          "Watched count exceeds the known season total.",
        );
      const episodes = await new TvProgressService(this.db).listEpisodes(
        seasonId,
      );
      if (mode === "exact") {
        await this.db.seasonTracking.put({
          ...tracking,
          mode: "exact",
          updatedAt: now(),
        });
        if (!seasonProgress(season, episodes, []).completeCatalog)
          throw new ValidationError(
            "Complete episode metadata is required for exact quick tracking. Use approximate tracking instead.",
          );
        const tv = new TvProgressService(this.db);
        for (let index = 0; index < episodes.length; index++)
          await tv.setEpisodeProgress({
            libraryEntryId: entryId,
            episodeId: episodes[index].id,
            watched: index < count,
          });
      }
      await this.db.seasonTracking.put({
        ...tracking,
        mode,
        approximateWatched:
          mode === "approximate" ? count : tracking.approximateWatched,
        updatedAt: now(),
      });
    });
  }
  async useExact(entryId: string, seasonId: string) {
    return write(this.db, async () => {
      const { tracking } = await this.seasonState(entryId, seasonId);
      await this.db.seasonTracking.put({
        ...tracking,
        mode: "exact",
        updatedAt: now(),
      });
    });
  }
  async includeSpecials(titleId: string, includeSpecials: boolean) {
    return write(this.db, async () => {
      const record = await this.getShow(titleId);
      await activeEntry(this.db, record.entry.id);
      await this.db.showMetadata.put({ ...record.show, includeSpecials });
      await this.db.titles.update(titleId, {
        revision: record.title.revision + 1,
        updatedAt: now(),
      });
    });
  }
  async watchEpisode(
    entryId: string,
    episodeId: string,
    watched: boolean,
    day?: string,
  ) {
    return write(this.db, async () => {
      const episode = await required(this.db.episodes, episodeId, "Episode");
      const { tracking } = await this.seasonState(entryId, episode.seasonId);
      if (tracking.mode === "approximate")
        throw new ConflictError(
          "Switch this season to exact tracking before changing individual episodes.",
        );
      return new TvProgressService(this.db).setEpisodeProgress({
        libraryEntryId: entryId,
        episodeId,
        watched,
        ...(day === undefined
          ? {}
          : {
              watchedAt: day
                ? { precision: "day" as const, value: day }
                : UNKNOWN_DATE,
            }),
      });
    });
  }
  async continueWatching() {
    return this.db.transaction("r", domainTables(this.db), async () => {
      const entries = await this.db.libraryEntries
        .where("status")
        .equals("watching")
        .filter((entry) => entry.deletedAt === null)
        .sortBy("updatedAt");
      const titles = await this.db.titles.bulkGet(
        entries.map((entry) => entry.titleId),
      );
      const records = await Promise.all(
        titles.flatMap((title, index) =>
          title?.mediaType === "tv"
            ? [
                (async () => {
                  const entry = entries[index];
                  const seasons = await this.db.seasons
                    .where("titleId")
                    .equals(title.id)
                    .sortBy("seasonNumber");
                  const episodes = await this.db.episodes
                    .where("seasonId")
                    .anyOf(seasons.map((season) => season.id))
                    .toArray();
                  const progress = await this.db.episodeProgress
                    .where("libraryEntryId")
                    .equals(entry.id)
                    .toArray();
                  const tracking = await this.db.seasonTracking
                    .where("libraryEntryId")
                    .equals(entry.id)
                    .toArray();
                  const metadata = await this.db.showMetadata.get(title.id);
                  return {
                    title,
                    entry,
                    seasons,
                    summary: tvProgress(
                      seasons,
                      episodes,
                      progress,
                      tracking,
                      metadata,
                    ),
                  };
                })(),
              ]
            : [],
        ),
      );
      return records
        .reverse()
        .filter(
          (record) =>
            record.summary.percentage === null ||
            record.summary.percentage < 100,
        )
        .slice(0, 6);
    });
  }
}
export type ShowRecord = Awaited<ReturnType<ShowService["getShow"]>>;
export type ShowTrackingRecord = Awaited<ReturnType<ShowService["tracking"]>>;
