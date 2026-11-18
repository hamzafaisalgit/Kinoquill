import type { KinoquillDatabase } from "../../db/database";
import type {
  ImportBatch,
  ImportData,
  ImportPlan,
  ImportRecord,
  UpdateField,
} from "../../types/imports";
import { TitleService } from "../titleService";
import { LibraryService } from "../libraryService";
import { GenreService } from "../genreService";
import { PersonService } from "../personService";
import { CategoryService } from "../categoryService";
import { ViewingService } from "../viewingService";
import { domainTables } from "../domainSupport";
import { ConflictError, ValidationError } from "../../utils/errors";
import {
  dateSchema,
  libraryBaseSchema,
  titleCreateSchema,
  validate,
} from "../../utils/validation";
import type { TitleUpdate, LibraryUpdate } from "../../utils/validation";
import { normalizeName, newId, now } from "../../utils/normalization";
import { localMatches, strongMatch } from "./duplicateResolver";
import { MAX_IMPORT_ROWS } from "./fileParser";
import { movieImage } from "../../utils/movieImages";
import { metadataFromTitle } from "../titleRecordService";
export const UPDATE_FIELDS: {
  value: UpdateField;
  label: string;
  kind: "metadata" | "personal" | "association";
}[] = [
  ...(
    [
      "title",
      "mediaSubtype",
      "originalTitle",
      "releaseYear",
      "releaseDate",
      "runtimeMinutes",
      "overview",
      "originalLanguage",
      "countries",
      "posterPath",
      "backdropPath",
      "tmdbId",
      "imdbId",
    ] as const
  ).map((value) => ({
    value,
    label: value.replace(/([A-Z])/g, " $1"),
    kind: "metadata" as const,
  })),
  ...(
    [
      "personalRating",
      "personalReview",
      "status",
      "isFavorite",
      "startedAt",
      "completedAt",
      "watchedDate",
    ] as const
  ).map((value) => ({
    value,
    label: value.replace(/([A-Z])/g, " $1"),
    kind: "personal" as const,
  })),
  ...(["genres", "people", "categories"] as const).map((value) => ({
    value,
    label: `Add incoming ${value} (keep existing)`,
    kind: "association" as const,
  })),
];
export function planCounts(plan: ImportPlan) {
  const errors = plan.rows.filter((row) =>
    row.issues.some((issue) => issue.severity === "error"),
  );
  return {
    total: plan.rows.length,
    valid: plan.rows.filter((row) => !row.issues.length).length,
    warnings: plan.rows.filter(
      (row) =>
        row.issues.some((issue) => issue.severity === "warning") &&
        !row.issues.some((issue) => issue.severity === "error"),
    ).length,
    errors: errors.length,
    duplicates: plan.rows.filter(
      (row) => row.matches.length || row.fileMatches.length,
    ).length,
    add: plan.rows.filter(
      (row) =>
        !errors.includes(row) &&
        (row.action === "add" || row.action === "separate"),
    ).length,
    update: plan.rows.filter(
      (row) => !errors.includes(row) && row.action === "update",
    ).length,
    skip: plan.rows.filter(
      (row) => row.action === "skip" && !errors.includes(row),
    ).length,
  };
}
export function validateImportData(data: ImportData) {
  validate(titleCreateSchema, data.metadata);
  validate(libraryBaseSchema, data.library);
  validate(dateSchema, data.watchedDate);
  validate(dateSchema, data.ratedDate);
  for (const value of [
    ...data.genres,
    ...data.categories,
    ...data.people.map((person) => person.name),
  ])
    if (!value.trim())
      throw new ValidationError("Empty association names are not allowed.");
  for (const path of [data.metadata.posterPath, data.metadata.backdropPath])
    if (path && !movieImage(path))
      throw new ValidationError(
        "Artwork must use a safe TMDB path or HTTPS URL.",
      );
}
/** Validate the selected fields as a merged record, before the user approves an update. */
export function validateApprovedUpdate(
  row: import("../../types/imports").ImportRow,
) {
  const match = row.matches.find((match) => match.title.id === row.targetId);
  if (!match?.entry)
    throw new ValidationError(
      "Choose an active existing personal record before approving updates.",
    );
  const meta = metadataFromTitle(match.title),
    personal = {
      status: match.entry.status,
      personalRating: match.entry.personalRating,
      personalReview: match.entry.personalReview,
      isFavorite: match.entry.isFavorite,
      startedAt: match.entry.startedAt,
      completedAt: match.entry.completedAt,
    };
  for (const field of UPDATE_FIELDS.filter((field) =>
    row.updateFields.includes(field.value),
  )) {
    if (field.kind === "metadata")
      Object.assign(meta, {
        [field.value]:
          row.data.metadata[field.value as keyof typeof row.data.metadata],
      });
    else if (field.kind === "personal" && field.value !== "watchedDate")
      Object.assign(personal, {
        [field.value]:
          row.data.library[field.value as keyof typeof row.data.library],
      });
    else if (field.value === "watchedDate")
      personal.completedAt = row.data.watchedDate;
  }
  validate(titleCreateSchema, meta);
  validate(libraryBaseSchema, personal);
}
export class ImportService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  history() {
    return this.db.importBatches
      .orderBy("importedAt")
      .reverse()
      .limit(20)
      .toArray();
  }
  records(batchId: string) {
    return this.db.importRecords.where("batchId").equals(batchId).toArray();
  }
  async commit(
    input: ImportPlan,
    onProgress?: (count: number, total: number) => void,
  ) {
    const plan = structuredClone(input);
    if (
      !plan.rows.length ||
      plan.rows.length > MAX_IMPORT_ROWS ||
      new Set(plan.rows.map((row) => row.id)).size !== plan.rows.length
    )
      throw new ValidationError(
        "Import 1–5,000 distinct source rows at a time.",
      );
    for (const row of plan.rows)
      if (row.action !== "skip") {
        if (row.issues.some((issue) => issue.severity === "error"))
          throw new ValidationError(
            `${row.sheet}, row ${row.row}: correct errors or skip this row.`,
          );
        validateImportData(row.data);
        if (row.action === "update") validateApprovedUpdate(row);
        if (
          row.action === "update" &&
          (!row.targetId ||
            !row.updateFields.length ||
            row.updateFields.some(
              (field) =>
                !UPDATE_FIELDS.some((option) => option.value === field),
            ))
        )
          throw new ValidationError(
            "Select a target and approved update fields for each update row.",
          );
      }
    return this.db.transaction(
      "rw",
      [...domainTables(this.db), this.db.importBatches, this.db.importRecords],
      async () => {
        const titles = new TitleService(this.db),
          library = new LibraryService(this.db),
          genres = new GenreService(this.db),
          people = new PersonService(this.db),
          categories = new CategoryService(this.db),
          viewing = new ViewingService(this.db);
        const createdCategories = new Set<string>(),
          updatedTargets = new Set<string>(),
          activeSources = new Set(
            plan.rows
              .filter((row) => row.action !== "skip")
              .map((row) => row.id),
          ),
          batchId = newId(),
          records: ImportRecord[] = [],
          entryIds = new Set<string>();
        let created = 0,
          updated = 0,
          movies = 0,
          shows = 0;
        // Check all preview identities before any row changes the database.
        for (const row of plan.rows.filter((row) => row.action !== "skip")) {
          const fresh = await localMatches(this.db, row);
          if (
            fresh.length !== row.matches.length ||
            fresh.some(
              (match) =>
                !row.matches.some(
                  (previous) =>
                    previous.title.id === match.title.id &&
                    previous.title.revision === match.title.revision &&
                    (previous.entry?.revision ?? null) ===
                      (match.entry?.revision ?? null),
                ),
            )
          )
            throw new ConflictError(
              `${row.sheet}, row ${row.row}: the library changed after preview. Revalidate before importing.`,
            );
          if (
            row.action === "add" &&
            (row.matches.length ||
              row.fileMatches.some((match) => activeSources.has(match.id)))
          )
            throw new ConflictError(
              "Review duplicates before adding this row.",
            );
          if (
            row.action === "separate" &&
            (row.matches.some((match) => strongMatch(row, match)) ||
              row.fileMatches.some(
                (match) => match.strong && activeSources.has(match.id),
              ))
          )
            throw new ConflictError(
              "Strong external-ID matches cannot be imported as separate records.",
            );
          if (row.action === "update") {
            if (updatedTargets.has(row.targetId!))
              throw new ConflictError(
                "Multiple rows would update the same title. Keep one update and skip the others.",
              );
            updatedTargets.add(row.targetId!);
            const target = row.matches.find(
              (match) => match.title.id === row.targetId,
            );
            if (!target)
              throw new ConflictError(
                "The approved update target is no longer a duplicate match.",
              );
            const strong = row.matches.filter((match) =>
              strongMatch(row, match),
            );
            if (strong.length > 1)
              throw new ConflictError(
                "The source external IDs match different existing productions. Correct the IDs or skip this row.",
              );
            if (
              strong.length &&
              !strong.some((match) => match.title.id === target.title.id)
            )
              throw new ConflictError(
                "Use the external-ID match as the update target, or correct the source identifiers.",
              );
            if (target.entry?.deletedAt)
              throw new ConflictError(
                "Restore archived matches before importing updates.",
              );
          }
        }
        for (const row of plan.rows) {
          let titleId: string | null = null,
            entryId: string | null = null,
            action: ImportRecord["action"] = row.issues.some(
              (issue) => issue.severity === "error",
            )
              ? "failed"
              : "skipped";
          if (row.action !== "skip") {
            const data = row.data,
              update = row.action === "update",
              approved = new Set(row.updateFields);
            const genreIds: string[] = [],
              categoryIds: string[] = [],
              personLinks: {
                personId: string;
                role: "director" | "creator";
              }[] = [];
            if (!update || approved.has("genres"))
              for (const name of data.genres) {
                const existing = await this.db.genres
                  .where("normalizedName")
                  .equals(normalizeName(name))
                  .first();
                genreIds.push(
                  existing?.id ?? (await genres.createGenre({ name })).id,
                );
              }
            if (!update || approved.has("categories"))
              for (const name of data.categories) {
                const existing = await this.db.categories
                  .where("normalizedName")
                  .equals(normalizeName(name))
                  .first();
                const category =
                  existing ?? (await categories.createCategory({ name }));
                if (!existing) createdCategories.add(category.id);
                categoryIds.push(category.id);
              }
            if (!update || approved.has("people"))
              for (const person of data.people) {
                const existingLinks = update
                  ? await people.getTitlePeople(row.targetId!)
                  : [];
                if (
                  existingLinks.some(
                    (link) =>
                      link.role === person.role &&
                      normalizeName(link.person.name) ===
                        normalizeName(person.name),
                  )
                )
                  continue;
                personLinks.push({
                  personId: (await people.createPerson({ name: person.name }))
                    .id,
                  role: person.role,
                });
              }
            if (!update) {
              const record = await library.importHistoricalLibraryTitle({
                title: data.metadata,
                library: data.library,
                genreIds,
                categoryIds,
                people: personLinks,
                confirmPossibleDuplicate: row.action === "separate",
              });
              titleId = record.title.id;
              entryId = record.entry.id;
              created++;
              action = "created";
              if (data.watchedDate.precision !== "unknown")
                await viewing.createViewingSession({
                  libraryEntryId: entryId,
                  sessionType: "first_watch",
                  viewedDate: data.watchedDate,
                });
            } else {
              titleId = row.targetId!;
              const match = row.matches.find(
                  (match) => match.title.id === titleId,
                )!,
                patch: TitleUpdate = {},
                personal: LibraryUpdate = {};
              for (const field of UPDATE_FIELDS.filter(
                (field) =>
                  field.kind === "metadata" && approved.has(field.value),
              ))
                Object.assign(patch, {
                  [field.value]:
                    data.metadata[field.value as keyof typeof data.metadata],
                });
              if (Object.keys(patch).length)
                await titles.updateTitle(titleId, patch, {
                  expectedRevision: match.title.revision,
                  confirmPossibleDuplicate: true,
                });
              if (match.entry) {
                entryId = match.entry.id;
                for (const field of UPDATE_FIELDS.filter(
                  (field) =>
                    field.kind === "personal" &&
                    approved.has(field.value) &&
                    field.value !== "watchedDate",
                ))
                  Object.assign(personal, {
                    [field.value]:
                      data.library[field.value as keyof typeof data.library],
                  });
                if (approved.has("watchedDate"))
                  personal.completedAt = data.watchedDate;
                if (Object.keys(personal).length)
                  await library.importHistoricalLibraryUpdate(
                    entryId,
                    personal,
                    match.entry.revision,
                  );
                if (approved.has("genres")) {
                  const existing = await genres.getTitleGenres(titleId);
                  await genres.assignGenres(titleId, [
                    ...new Set([...existing.map((row) => row.id), ...genreIds]),
                  ]);
                }
                for (const id of categoryIds)
                  if (!(await this.db.libraryCategories.get([entryId, id])))
                    await categories.addCategory(entryId, id);
                for (const person of personLinks)
                  await people.attachPersonToTitle(
                    titleId,
                    person.personId,
                    person.role,
                  );
                if (approved.has("watchedDate")) {
                  const first = await this.db.viewingSessions
                    .where("libraryEntryId")
                    .equals(entryId)
                    .filter(
                      (session) =>
                        session.sessionType === "first_watch" &&
                        !session.episodeId,
                    )
                    .first();
                  if (first)
                    await viewing.updateViewingSession(first.id, {
                      viewedDate: data.watchedDate,
                    });
                  else if (data.watchedDate.precision !== "unknown")
                    await viewing.createViewingSession({
                      libraryEntryId: entryId,
                      sessionType: "first_watch",
                      viewedDate: data.watchedDate,
                    });
                }
              } else
                throw new ConflictError(
                  "This matched title has no personal library entry. Skip it and add its personal record explicitly before reimporting.",
                );
              updated++;
              action = "updated";
            }
            entryIds.add(entryId!);
            if (data.metadata.mediaType === "movie") movies++;
            else shows++;
          }
          records.push({
            id: `${batchId}:${row.id}`,
            batchId,
            sheet: row.sheet,
            row: row.row,
            sourceTitle: row.data.metadata.title,
            action,
            titleId,
            entryId,
            ratedDate: row.data.ratedDate,
            legacyPosition: row.data.legacyPosition,
            warnings: row.issues
              .filter((issue) => issue.severity === "warning")
              .map((issue) => `${issue.field}: ${issue.message}`),
            errors: row.issues
              .filter((issue) => issue.severity === "error")
              .map((issue) => `${issue.field}: ${issue.message}`),
          });
          onProgress?.(records.length, plan.rows.length);
        }
        const batch: ImportBatch = {
          id: batchId,
          originalFileName: plan.fileName,
          importedAt: now(),
          fileType: plan.fileType,
          sheetNames: plan.sheetNames,
          totalRows: plan.rows.length,
          createdCount: created,
          updatedCount: updated,
          skippedCount: records.filter((record) => record.action === "skipped")
            .length,
          failedCount: records.filter((record) => record.action === "failed")
            .length,
          warningsCount: records.filter((record) => record.warnings.length > 0)
            .length,
          categoriesCreated: createdCategories.size,
          movies,
          shows,
          status: "completed",
          entryIds: [...entryIds],
        };
        await this.db.importBatches.add(batch);
        await this.db.importRecords.bulkAdd(records);
        return batch;
      },
    );
  }
}
