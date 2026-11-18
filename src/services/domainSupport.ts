import type { Table } from "dexie";
import type { KinoquillDatabase } from "../db/database";
import {
  ConflictError,
  RecordNotFoundError,
  StorageUnavailableError,
} from "../utils/errors";
import type { LibraryEntry } from "../types/domain";

export function domainTables(db: KinoquillDatabase) {
  return [
    db.titles,
    db.genres,
    db.people,
    db.titleGenres,
    db.titlePeople,
    db.categories,
    db.libraryCategories,
    db.libraryEntries,
    db.viewingSessions,
    db.seasons,
    db.episodes,
    db.episodeProgress,
    db.showMetadata,
    db.seasonTracking,
    db.customLists,
    db.listItems,
    db.savedViews,
    db.tags,
    db.titleTags,
  ];
}
/** Short, serialized domain writes protect references even across browser tabs. */
export async function write<T>(
  db: KinoquillDatabase,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction("rw", domainTables(db), operation);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "ConstraintError")
      throw new ConflictError(
        "A unique record or association already exists.",
        { cause: error },
      );
    if (
      [
        "QuotaExceededError",
        "DatabaseClosedError",
        "MissingAPIError",
        "SecurityError",
        "OpenFailedError",
        "VersionError",
      ].includes(name)
    )
      throw new StorageUnavailableError(
        "Local storage could not complete this operation. No changes were committed.",
        { cause: error },
      );
    throw error;
  }
}
export async function required<T>(
  table: Table<T, string>,
  id: string,
  label: string,
): Promise<T> {
  const record = await table.get(id);
  if (!record) throw new RecordNotFoundError(`${label} was not found.`);
  return record;
}
export async function activeEntry(
  db: KinoquillDatabase,
  id: string,
): Promise<LibraryEntry> {
  const entry = await required(db.libraryEntries, id, "Library entry");
  if (entry.deletedAt !== null)
    throw new ConflictError("Restore this archived entry before editing it.");
  return entry;
}
export async function reviewFlags(
  db: KinoquillDatabase,
  entry: Pick<LibraryEntry, "titleId" | "status" | "personalRating">,
): Promise<string[]> {
  const reasons: string[] = [];
  if (entry.status === "unknown") reasons.push("Watch status is unknown.");
  if (entry.status === "completed" && entry.personalRating === null)
    reasons.push("Completed title has no personal rating.");
  if (!(await db.titleGenres.where("titleId").equals(entry.titleId).count()))
    reasons.push("No genres have been recorded.");
  return reasons;
}
export async function refreshReviewFlags(
  db: KinoquillDatabase,
  titleId: string,
) {
  const entry = await db.libraryEntries
    .where("titleId")
    .equals(titleId)
    .first();
  if (entry) {
    const reasons = await reviewFlags(db, entry);
    await db.libraryEntries.update(entry.id, {
      needsReview: reasons.length > 0,
      reviewReasons: reasons,
      revision: entry.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }
}
