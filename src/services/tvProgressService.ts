import type { KinoquillDatabase } from "../db/database";
import type { z } from "zod";
import {
  episodeCreateSchema,
  seasonCreateSchema,
  seasonUpdateSchema,
  episodeUpdateSchema,
  progressUpdateSchema,
  validate,
} from "../utils/validation";
import { newId, now } from "../utils/normalization";
import { activeEntry, required, write } from "./domainSupport";
import { ConflictError, ReferentialIntegrityError } from "../utils/errors";
import { calculateShowProgress } from "../utils/progress";

export class TvProgressService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createSeason(input: z.input<typeof seasonCreateSchema>) {
    const values = validate(seasonCreateSchema, input);
    return write(this.db, async () => {
      const title = await required(this.db.titles, values.titleId, "Title");
      if (title.mediaType !== "tv")
        throw new ReferentialIntegrityError(
          "Seasons can only belong to TV titles.",
        );
      if (
        await this.db.seasons
          .where("[titleId+seasonNumber]")
          .equals([title.id, values.seasonNumber])
          .first()
      )
        throw new ConflictError(
          "This season number already exists for the show.",
        );
      const season = {
        ...values,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.seasons.add(season);
      return season;
    });
  }
  async createEpisode(input: z.input<typeof episodeCreateSchema>) {
    const values = validate(episodeCreateSchema, input);
    return write(this.db, async () => {
      const season = await required(this.db.seasons, values.seasonId, "Season");
      if (
        await this.db.episodes
          .where("[seasonId+episodeNumber]")
          .equals([season.id, values.episodeNumber])
          .first()
      )
        throw new ConflictError(
          "This episode number already exists in the season.",
        );
      if (
        season.episodeCount !== null &&
        values.episodeNumber > season.episodeCount
      )
        throw new ConflictError(
          "Episode number exceeds the recorded season episode count. Correct the season metadata first.",
        );
      const episode = {
        ...values,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.episodes.add(episode);
      return episode;
    });
  }
  async setEpisodeProgress(input: z.input<typeof progressUpdateSchema>) {
    const values = validate(progressUpdateSchema, input);
    return write(this.db, async () => {
      const entry = await activeEntry(this.db, values.libraryEntryId);
      const episode = await required(
        this.db.episodes,
        values.episodeId,
        "Episode",
      );
      const season = await required(
        this.db.seasons,
        episode.seasonId,
        "Season",
      );
      const title = await required(this.db.titles, entry.titleId, "Title");
      if (title.mediaType !== "tv" || season.titleId !== entry.titleId)
        throw new ReferentialIntegrityError(
          "Episode does not belong to this TV show.",
        );
      if (
        (await this.db.seasonTracking.get([entry.id, season.id]))?.mode ===
        "approximate"
      )
        throw new ConflictError(
          "Switch this season to exact tracking before changing individual episodes.",
        );
      const current = await this.db.episodeProgress
        .where("[libraryEntryId+episodeId]")
        .equals([entry.id, episode.id])
        .first();
      const watchedAt =
        values.watched && input.watchedAt === undefined && current?.watched
          ? current.watchedAt
          : values.watchedAt;
      const progress = {
        ...values,
        watchedAt,
        id: current?.id ?? newId(),
        updatedAt: now(),
      };
      await this.db.episodeProgress.put(progress);
      return progress;
    });
  }
  listSeasons(titleId: string) {
    return this.db.seasons
      .where("titleId")
      .equals(titleId)
      .sortBy("seasonNumber");
  }
  getSeason(id: string) {
    return required(this.db.seasons, id, "Season");
  }
  getEpisode(id: string) {
    return required(this.db.episodes, id, "Episode");
  }
  async listEpisodeProgress(libraryEntryId: string) {
    return this.db.transaction(
      "r",
      [this.db.libraryEntries, this.db.episodeProgress],
      async () => {
        await activeEntry(this.db, libraryEntryId);
        return this.db.episodeProgress
          .where("libraryEntryId")
          .equals(libraryEntryId)
          .toArray();
      },
    );
  }
  async updateSeason(id: string, input: z.input<typeof seasonUpdateSchema>) {
    const patch = validate(seasonUpdateSchema, input);
    return write(this.db, async () => {
      const current = await this.getSeason(id);
      const season = { ...current, ...patch, updatedAt: now() };
      const duplicate = await this.db.seasons
        .where("[titleId+seasonNumber]")
        .equals([season.titleId, season.seasonNumber])
        .first();
      if (duplicate && duplicate.id !== id)
        throw new ConflictError(
          "This season number already exists for the show.",
        );
      if (
        season.episodeCount !== null &&
        (await this.db.episodes
          .where("seasonId")
          .equals(id)
          .filter((episode) => episode.episodeNumber > season.episodeCount!)
          .count())
      )
        throw new ConflictError(
          "The episode count cannot exclude existing episodes.",
        );
      await this.db.seasons.put(season);
      return season;
    });
  }
  async updateEpisode(id: string, input: z.input<typeof episodeUpdateSchema>) {
    const patch = validate(episodeUpdateSchema, input);
    return write(this.db, async () => {
      const current = await this.getEpisode(id);
      const episode = { ...current, ...patch, updatedAt: now() };
      const season = await this.getSeason(episode.seasonId);
      const duplicate = await this.db.episodes
        .where("[seasonId+episodeNumber]")
        .equals([episode.seasonId, episode.episodeNumber])
        .first();
      if (duplicate && duplicate.id !== id)
        throw new ConflictError(
          "This episode number already exists in the season.",
        );
      if (
        season.episodeCount !== null &&
        episode.episodeNumber > season.episodeCount
      )
        throw new ConflictError(
          "Episode number exceeds the recorded season episode count.",
        );
      await this.db.episodes.put(episode);
      return episode;
    });
  }
  listEpisodes(seasonId: string) {
    return this.db.episodes
      .where("seasonId")
      .equals(seasonId)
      .sortBy("episodeNumber");
  }
  async getShowProgress(libraryEntryId: string) {
    return this.db.transaction(
      "r",
      [
        this.db.libraryEntries,
        this.db.titles,
        this.db.seasons,
        this.db.episodes,
        this.db.episodeProgress,
        this.db.seasonTracking,
        this.db.showMetadata,
      ],
      async () => {
        const entry = await activeEntry(this.db, libraryEntryId);
        const title = await required(this.db.titles, entry.titleId, "Title");
        if (title.mediaType !== "tv")
          throw new ReferentialIntegrityError(
            "Episode progress requires a TV title.",
          );
        const seasons = await this.listSeasons(title.id);
        const episodes = await this.db.episodes
          .where("seasonId")
          .anyOf(seasons.map((season) => season.id))
          .toArray();
        const progress = await this.db.episodeProgress
          .where("libraryEntryId")
          .equals(libraryEntryId)
          .toArray();
        const tracking = await this.db.seasonTracking
          .where("libraryEntryId")
          .equals(entry.id)
          .toArray();
        const metadata = await this.db.showMetadata.get(title.id);
        return calculateShowProgress(
          seasons,
          episodes,
          progress,
          tracking,
          metadata,
        );
      },
    );
  }
}
