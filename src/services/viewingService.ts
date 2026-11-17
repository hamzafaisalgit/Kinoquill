import type { KinoquillDatabase } from "../db/database";
import type { z } from "zod";
import { viewingCreateSchema, validate } from "../utils/validation";
import { newId, now } from "../utils/normalization";
import { activeEntry, required, write } from "./domainSupport";

export class ViewingService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createViewingSession(input: z.input<typeof viewingCreateSchema>) {
    const values = validate(viewingCreateSchema, input);
    return write(this.db, async () => {
      await activeEntry(this.db, values.libraryEntryId);
      const record = {
        ...values,
        id: newId(),
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.viewingSessions.add(record);
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
        ...input,
        libraryEntryId: current.libraryEntryId,
      });
      const session = { ...current, ...values, updatedAt: now() };
      await this.db.viewingSessions.put(session);
      return session;
    });
  }
}
