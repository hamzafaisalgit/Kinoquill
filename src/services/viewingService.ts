import type { KinoquillDatabase } from "../db/database";
import type { z } from "zod";
import { viewingCreateSchema, validate } from "../utils/validation";
import { newId, now } from "../utils/normalization";
import { activeEntry, required, write } from "./domainSupport";
import { TvProgressService } from "./tvProgressService";
import { ConflictError, ValidationError } from "../utils/errors";

export class ViewingService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createViewingSession(
    input: z.input<typeof viewingCreateSchema>,
    options: { markWatched?: boolean; sessionId?: string } = {},
  ) {
    const values = validate(viewingCreateSchema, input);
    return write(this.db, async () => {
      await this.check(values);
      if (
        values.sessionRating !== null &&
        !Number.isInteger(values.sessionRating * 2)
      )
        throw new ValidationError("Session ratings use 0.5 increments.");
      if (values.sessionType === "first_watch") {
        const first = await this.db.viewingSessions
          .where("libraryEntryId")
          .equals(values.libraryEntryId)
          .filter(
            (s) =>
              s.sessionType === "first_watch" &&
              (s.episodeId ?? null) === values.episodeId,
          )
          .first();
        if (first)
          throw new ConflictError(
            "A first watch is already recorded for this title or episode. Choose Rewatch to log another viewing.",
          );
      }
      const record = {
        ...values,
        id: options.sessionId ?? newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.viewingSessions.add(record);
      if (options.markWatched && values.episodeId)
        await new TvProgressService(this.db).setEpisodeProgress({
          libraryEntryId: values.libraryEntryId,
          episodeId: values.episodeId,
          watched: true,
          watchedAt: values.viewedDate,
        });
      return record;
    });
  }
  async listViewingSessions(
    libraryEntryId?: string,
    options: { includeArchived?: boolean } = {},
  ) {
    return this.db.transaction(
      "r",
      [this.db.libraryEntries, this.db.viewingSessions],
      async () => {
        if (libraryEntryId)
          await required(
            this.db.libraryEntries,
            libraryEntryId,
            "Library entry",
          );
        const allowed = new Set(
          (
            await this.db.libraryEntries
              .filter(
                (entry) => options.includeArchived || entry.deletedAt === null,
              )
              .toArray()
          ).map((entry) => entry.id),
        );
        return (
          libraryEntryId
            ? this.db.viewingSessions
                .where("libraryEntryId")
                .equals(libraryEntryId)
            : this.db.viewingSessions.toCollection()
        )
          .filter((session) => allowed.has(session.libraryEntryId))
          .toArray();
      },
    );
  }
  updateViewingSession(
    id: string,
    input: Partial<Omit<z.input<typeof viewingCreateSchema>, "libraryEntryId">>,
  ) {
    return write(this.db, async () => {
      const current = await required(
        this.db.viewingSessions,
        id,
        "Viewing session",
      );
      await activeEntry(this.db, current.libraryEntryId);
      const values = validate(viewingCreateSchema, {
        sessionType: current.sessionType,
        viewedDate: current.viewedDate,
        durationMinutes: current.durationMinutes,
        notes: current.notes,
        episodeId: current.episodeId ?? null,
        sessionRating: current.sessionRating ?? null,
        platform: current.platform ?? null,
        context: current.context ?? null,
        ...input,
        libraryEntryId: current.libraryEntryId,
      });
      if (
        values.episodeId !== (current.episodeId ?? null) ||
        values.sessionType !== current.sessionType
      )
        throw new ValidationError(
          "Session identity and classification cannot be changed. Delete and log a corrected session instead.",
        );
      if (
        values.sessionRating !== null &&
        values.sessionRating !== current.sessionRating &&
        !Number.isInteger(values.sessionRating * 2)
      )
        throw new ValidationError("Session ratings use 0.5 increments.");
      await this.check(values);
      const session = { ...current, ...values, updatedAt: now() };
      await this.db.viewingSessions.put(session);
      return session;
    });
  }
  private async check(values: z.output<typeof viewingCreateSchema>) {
    const entry = await activeEntry(this.db, values.libraryEntryId);
    if (values.episodeId) {
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
      if (season.titleId !== entry.titleId)
        throw new ValidationError(
          "This episode does not belong to the selected show.",
        );
    }
  }
  deleteViewingSession(id: string) {
    return write(this.db, async () => {
      const session = await required(
        this.db.viewingSessions,
        id,
        "Viewing session",
      );
      await activeEntry(this.db, session.libraryEntryId);
      await this.db.viewingSessions.delete(id);
    });
  }
}
