import { z } from "zod";
import {
  titleCreateSchema,
  libraryBaseSchema,
  dateSchema,
  viewingCreateSchema,
  seasonCreateSchema,
  episodeCreateSchema,
  progressUpdateSchema,
} from "../../utils/validation";
import { showMetadataSchema } from "../showService";
import { namedSchema, savedConfigSchema } from "../personalService";
import { settingsSchema } from "../preferences";
import { normalizeName } from "../../utils/normalization";
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const id = z.string().min(1).max(500),
  timestamp = z.iso.datetime(),
  nullable = z.string().nullable(),
  count = z.number().int().nonnegative();
const timestamps = { createdAt: timestamp, updatedAt: timestamp };
const named = z
  .object({
    id,
    name: z.string().trim().min(1),
    normalizedName: z.string().min(1),
    ...timestamps,
  })
  .strict();
export const storeSchemas = {
  titles: titleCreateSchema.safeExtend({
    id,
    revision: count,
    normalizedTitle: z.string().min(1),
    ...timestamps,
  }),
  libraryEntries: libraryBaseSchema.safeExtend({
    id,
    titleId: id,
    needsReview: z.boolean(),
    reviewReasons: z.array(z.string()),
    ratingPolicy: z.enum(["manual", "historical"]),
    dateAdded: timestamp,
    updatedAt: timestamp,
    deletedAt: timestamp.nullable(),
    revision: count,
  }),
  genres: named.omit({ updatedAt: true }),
  people: named,
  categories: namedSchema.safeExtend({
    id,
    normalizedName: z.string().min(1),
    ...timestamps,
  }),
  titleGenres: z.object({ titleId: id, genreId: id }).strict(),
  titlePeople: z
    .object({
      titleId: id,
      personId: id,
      role: z.enum(["director", "creator"]),
    })
    .strict(),
  libraryCategories: z.object({ libraryEntryId: id, categoryId: id }).strict(),
  viewingSessions: viewingCreateSchema.extend({
    id,
    ...timestamps,
    episodeId: id.nullable().optional(),
    sessionRating: z.number().finite().min(0).max(10).nullable().optional(),
    platform: nullable.optional(),
    context: nullable.optional(),
  }),
  seasons: seasonCreateSchema.safeExtend({ id, ...timestamps }),
  episodes: episodeCreateSchema.safeExtend({ id, ...timestamps }),
  episodeProgress: progressUpdateSchema.safeExtend({
    id,
    updatedAt: timestamp,
  }),
  showMetadata: showMetadataSchema.safeExtend({ titleId: id }),
  seasonTracking: z
    .object({
      seasonId: id,
      libraryEntryId: id,
      mode: z.enum(["exact", "approximate"]),
      approximateWatched: count,
      personalRating: z.number().finite().min(0).max(10).nullable(),
      updatedAt: timestamp,
    })
    .strict(),
  importBatches: z
    .object({
      id,
      originalFileName: z.string(),
      importedAt: timestamp,
      fileType: z.enum(["csv", "xlsx"]),
      sheetNames: z.array(z.string()),
      totalRows: count,
      createdCount: count,
      updatedCount: count,
      skippedCount: count,
      failedCount: count,
      warningsCount: count,
      categoriesCreated: count,
      movies: count,
      shows: count,
      status: z.literal("completed"),
      entryIds: z.array(id),
    })
    .strict(),
  importRecords: z
    .object({
      id,
      batchId: id,
      sheet: z.string(),
      row: z.number().int().positive(),
      sourceTitle: z.string(),
      action: z.enum(["created", "updated", "skipped", "failed"]),
      titleId: id.nullable(),
      entryId: id.nullable(),
      ratedDate: dateSchema,
      legacyPosition: nullable,
      warnings: z.array(z.string()),
      errors: z.array(z.string()),
    })
    .strict(),
  customLists: namedSchema.safeExtend({ id, ...timestamps }),
  listItems: z
    .object({
      id,
      listId: id,
      titleId: id,
      position: count,
      createdAt: timestamp,
    })
    .strict(),
  tags: named,
  titleTags: z.object({ titleId: id, tagId: id }).strict(),
  savedViews: namedSchema.safeExtend({
    ...savedConfigSchema.shape,
    id,
    ...timestamps,
  }),
  appSettings: settingsSchema,
};
export const BACKUP_STORES = Object.keys(
  storeSchemas,
) as (keyof typeof storeSchemas)[];
const dataSchema = z
  .object(
    Object.fromEntries(
      BACKUP_STORES.map((name) => [name, z.array(storeSchemas[name])]),
    ) as {
      [K in keyof typeof storeSchemas]: z.ZodArray<(typeof storeSchemas)[K]>;
    },
  )
  .strict();
export const backupSchema = z
  .object({
    format: z.literal("kinoquill-backup"),
    backupVersion: z.literal(1),
    schemaVersion: z.literal(5),
    exportedAt: timestamp,
    appVersion: z.string().min(1),
    data: dataSchema,
  })
  .strict();
export type CompleteBackup = z.output<typeof backupSchema>;
function fail(message: string): never {
  throw new Error(`Invalid backup: ${message}`);
}
export function validateBackup(input: unknown): CompleteBackup {
  // Check physical completeness before schemas with legacy defaults can fill fields.
  if (!input || typeof input !== "object" || !("data" in input))
    fail("expected a complete Kinoquill backup.");
  const data = (input as { data: unknown }).data;
  if (!data || typeof data !== "object")
    fail("data must contain every user-data store.");
  let total = 0;
  for (const name of BACKUP_STORES) {
    const rows = (data as Record<string, unknown>)[name];
    if (!Array.isArray(rows)) fail(`${name} must be an array.`);
    total += rows.length;
    if (total > 200000)
      fail("over 200,000 records; split or reduce the dataset.");
    const optional =
      name === "viewingSessions"
        ? ["episodeId", "sessionRating", "platform", "context"]
        : name === "appSettings"
          ? ["library", "journal"]
          : [];
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== "object")
        fail(`${name}[${index}] must be a record.`);
      for (const field of Object.keys(storeSchemas[name].shape))
        if (!optional.includes(field) && !Object.hasOwn(row, field))
          fail(`${name}[${index}].${field} is missing.`);
    }
  }
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success)
    fail(
      parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("\n"),
    );
  const b = parsed.data!,
    d = b.data;
  const unique = (
    rows: unknown[],
    key: (row: never) => unknown,
    label: string,
  ) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = JSON.stringify(key(row as never));
      if (seen.has(value)) fail(`duplicate ${label} key ${value}.`);
      seen.add(value);
    }
  };
  for (const name of BACKUP_STORES) {
    const rows = d[name];
    const fields: Record<string, string[]> = {
      titleGenres: ["titleId", "genreId"],
      titlePeople: ["titleId", "personId", "role"],
      libraryCategories: ["libraryEntryId", "categoryId"],
      titleTags: ["titleId", "tagId"],
      showMetadata: ["titleId"],
      seasonTracking: ["libraryEntryId", "seasonId"],
    };
    unique(
      rows,
      (r) => {
        const row = r as Record<string, unknown>;
        return (fields[name] ?? ["id"]).map((f) => row[f]);
      },
      name,
    );
  }
  const titles = new Map(d.titles.map((t) => [t.id, t])),
    entries = new Map(d.libraryEntries.map((e) => [e.id, e])),
    seasons = new Map(d.seasons.map((s) => [s.id, s])),
    episodes = new Map(d.episodes.map((e) => [e.id, e]));
  const requireKey = (
    ids: Set<string> | Map<string, unknown>,
    key: string,
    label: string,
  ) => {
    if (!ids.has(key)) fail(`${label}: missing reference ${key}.`);
  };
  unique(
    d.libraryEntries,
    (r) => (r as { titleId: string }).titleId,
    "library title",
  );
  unique(
    d.seasons,
    (r) => {
      const s = r as { titleId: string; seasonNumber: number };
      return [s.titleId, s.seasonNumber];
    },
    "season number",
  );
  unique(
    d.episodes,
    (r) => {
      const e = r as { seasonId: string; episodeNumber: number };
      return [e.seasonId, e.episodeNumber];
    },
    "episode number",
  );
  unique(
    d.episodeProgress,
    (r) => {
      const p = r as { libraryEntryId: string; episodeId: string };
      return [p.libraryEntryId, p.episodeId];
    },
    "episode progress",
  );
  unique(
    d.listItems,
    (r) => {
      const i = r as { listId: string; titleId: string };
      return [i.listId, i.titleId];
    },
    "list membership",
  );
  unique(
    d.listItems,
    (r) => {
      const i = r as { listId: string; position: number };
      return [i.listId, i.position];
    },
    "list ordering",
  );
  for (const name of ["genres", "people", "categories", "tags"] as const) {
    for (const row of d[name])
      if (row.normalizedName !== normalizeName(row.name))
        fail(`${name}: inconsistent normalized name.`);
    if (name !== "people")
      unique(
        d[name],
        (r) => (r as { normalizedName: string }).normalizedName,
        `${name} name`,
      );
  }
  const externalIds = new Set<string>();
  for (const t of d.titles) {
    if (t.normalizedTitle !== normalizeName(t.title))
      fail("titles: inconsistent normalized title.");
    for (const field of ["tmdbId", "imdbId"] as const)
      if (t[field] !== null) {
        const key = JSON.stringify([t.mediaType, field, t[field]]);
        if (externalIds.has(key)) fail(`titles: conflicting ${field}.`);
        externalIds.add(key);
      }
  }
  for (const e of d.libraryEntries)
    requireKey(titles, e.titleId, "libraryEntries");
  for (const s of d.seasons) {
    requireKey(titles, s.titleId, "seasons");
    if (titles.get(s.titleId)!.mediaType !== "tv")
      fail("seasons must belong to television titles.");
  }
  for (const e of d.episodes) {
    requireKey(seasons, e.seasonId, "episodes");
    const total = seasons.get(e.seasonId)!.episodeCount;
    if (total !== null && e.episodeNumber > total)
      fail("episode number exceeds season total.");
  }
  const matchEpisode = (entryId: string, episodeId: string, label: string) => {
    requireKey(entries, entryId, label);
    requireKey(episodes, episodeId, label);
    if (
      seasons.get(episodes.get(episodeId)!.seasonId)!.titleId !==
      entries.get(entryId)!.titleId
    )
      fail(`${label}: episode belongs to another title.`);
  };
  for (const p of d.episodeProgress)
    matchEpisode(p.libraryEntryId, p.episodeId, "episodeProgress");
  for (const v of d.viewingSessions) {
    requireKey(entries, v.libraryEntryId, "viewingSessions");
    if (v.episodeId)
      matchEpisode(v.libraryEntryId, v.episodeId, "viewingSessions");
  }
  for (const t of d.seasonTracking) {
    requireKey(entries, t.libraryEntryId, "seasonTracking");
    requireKey(seasons, t.seasonId, "seasonTracking");
    const season = seasons.get(t.seasonId)!;
    if (season.titleId !== entries.get(t.libraryEntryId)!.titleId)
      fail("seasonTracking: incorrect show.");
    if (
      season.episodeCount !== null &&
      t.approximateWatched > season.episodeCount
    )
      fail("seasonTracking: watched count exceeds known total.");
  }
  for (const m of d.showMetadata) {
    requireKey(titles, m.titleId, "showMetadata");
    if (titles.get(m.titleId)!.mediaType !== "tv")
      fail("showMetadata requires a TV title.");
  }
  const genres = new Set(d.genres.map((g) => g.id)),
    people = new Set(d.people.map((p) => p.id)),
    categories = new Set(d.categories.map((c) => c.id)),
    tags = new Set(d.tags.map((t) => t.id)),
    lists = new Set(d.customLists.map((l) => l.id)),
    batches = new Set(d.importBatches.map((b) => b.id));
  for (const l of d.titleGenres) {
    requireKey(titles, l.titleId, "titleGenres");
    requireKey(genres, l.genreId, "titleGenres");
  }
  for (const l of d.titlePeople) {
    requireKey(titles, l.titleId, "titlePeople");
    requireKey(people, l.personId, "titlePeople");
  }
  for (const l of d.libraryCategories) {
    requireKey(entries, l.libraryEntryId, "libraryCategories");
    requireKey(categories, l.categoryId, "libraryCategories");
  }
  for (const l of d.titleTags) {
    requireKey(titles, l.titleId, "titleTags");
    requireKey(tags, l.tagId, "titleTags");
  }
  for (const i of d.listItems) {
    requireKey(lists, i.listId, "listItems");
    requireKey(titles, i.titleId, "listItems");
  }
  for (const batch of d.importBatches)
    for (const entryId of batch.entryIds)
      requireKey(entries, entryId, "importBatches");
  for (const r of d.importRecords) {
    requireKey(batches, r.batchId, "importRecords");
    if (r.entryId) requireKey(entries, r.entryId, "importRecords");
    if (r.titleId) requireKey(titles, r.titleId, "importRecords");
    if (r.entryId && r.titleId && entries.get(r.entryId)!.titleId !== r.titleId)
      fail("importRecords: title and entry disagree.");
  }
  if (d.appSettings.length !== 1 || d.appSettings[0].id !== "preferences")
    fail("one preferences record is required.");
  return b;
}
