import { queryLibrary } from "./libraryQuery";
import type { KinoquillDatabase } from "../db/database";
import type {
  LibraryEntry,
  LibraryQuery,
  LibrarySummary,
  WatchStatus,
} from "../types/domain";
import type {
  Associations,
  LibraryInput,
  LibraryUpdate,
  TitleInput,
} from "../utils/validation";
import {
  associationSchema,
  libraryBaseSchema,
  libraryCreateSchema,
  libraryUpdateSchema,
  validate,
  validateLibraryEdit,
} from "../utils/validation";
import { newId, now } from "../utils/normalization";
import { ConflictError, ValidationError } from "../utils/errors";
import { activeEntry, required, reviewFlags, write } from "./domainSupport";
import { TitleService } from "./titleService";
import { CategoryService } from "./categoryService";
export type LibraryTarget = { id: string; revision: number };
export type BulkAction =
  | { kind: "favorite"; value: boolean }
  | { kind: "status"; value: WatchStatus }
  | { kind: "category_add" | "category_remove"; categoryId: string }
  | { kind: "archive" };

type TitleSelection =
  { title: TitleInput; titleId?: never } | { titleId: string; title?: never };
export type CreateLibraryTitleInput = TitleSelection &
  Associations & { library: LibraryInput; confirmPossibleDuplicate?: boolean };
export type HistoricalLibraryTitleInput = TitleSelection &
  Associations & {
    library: Omit<LibraryInput, "status"> & { status?: WatchStatus };
    confirmPossibleDuplicate?: boolean;
  };

export class LibraryService {
  private readonly db: KinoquillDatabase;
  private readonly titles: TitleService;
  constructor(db: KinoquillDatabase) {
    this.db = db;
    this.titles = new TitleService(db);
  }

  async createLibraryTitle(input: CreateLibraryTitleInput) {
    const library = validate(libraryCreateSchema, input.library);
    return this.createComposite(input, library, "manual");
  }

  /** Controlled historical intake: every field and relationship is still validated. */
  async importHistoricalLibraryTitle(input: HistoricalLibraryTitleInput) {
    const library = validate(libraryBaseSchema, {
      ...input.library,
      status: input.library.status ?? "unknown",
    });
    return this.createComposite(input, library, "historical");
  }

  private createComposite(
    input: TitleSelection &
      Associations & { confirmPossibleDuplicate?: boolean },
    library: ReturnType<typeof libraryBaseSchema.parse>,
    policy: "manual" | "historical",
  ) {
    const associations = validate(associationSchema, {
      genreIds: input.genreIds,
      categoryIds: input.categoryIds,
      people: input.people,
    });
    if (Boolean(input.title) === Boolean(input.titleId))
      throw new ValidationError(
        "Provide either new title metadata or one existing title ID.",
      );
    return write(this.db, async () => {
      const title = input.titleId
        ? await this.titles.getTitleById(input.titleId)
        : await this.titles.createTitle(
            {
              ...input.title!,
              metadataSource:
                input.title!.metadataSource ??
                (policy === "historical" ? "import" : "manual"),
            },
            { confirmPossibleDuplicate: input.confirmPossibleDuplicate },
          );
      if (
        await this.db.libraryEntries.where("titleId").equals(title.id).first()
      )
        throw new ConflictError(
          "This title already has a library entry. Restore it if archived.",
        );
      const existingGenres = await this.db.titleGenres
        .where("titleId")
        .equals(title.id)
        .toArray();
      const genreIds = new Set([
        ...existingGenres.map((link) => link.genreId),
        ...associations.genreIds,
      ]);
      if (policy === "manual" && genreIds.size === 0)
        throw new ValidationError("Please select at least one genre.");
      for (const genreId of associations.genreIds) {
        await required(this.db.genres, genreId, "Genre");
        await this.db.titleGenres.put({ titleId: title.id, genreId });
      }
      for (const person of associations.people) {
        await required(this.db.people, person.personId, "Person");
        if (
          await this.db.titlePeople.get([
            title.id,
            person.personId,
            person.role,
          ])
        )
          throw new ConflictError(
            "This person and role are already attached to the title.",
          );
        await this.db.titlePeople.add({ titleId: title.id, ...person });
      }
      const timestamp = now();
      const entry: LibraryEntry = {
        ...library,
        id: newId(),
        titleId: title.id,
        dateAdded: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        needsReview: false,
        reviewReasons: [],
        ratingPolicy: policy,
        revision: 1,
      };
      entry.reviewReasons = await reviewFlags(this.db, entry);
      entry.needsReview = entry.reviewReasons.length > 0;
      await this.db.libraryEntries.add(entry);
      for (const categoryId of associations.categoryIds) {
        await required(this.db.categories, categoryId, "Category");
        await this.db.libraryCategories.add({
          libraryEntryId: entry.id,
          categoryId,
        });
      }
      return { title, entry };
    });
  }

  createLibraryEntry(titleId: string, library: LibraryInput) {
    return this.createLibraryTitle({ titleId, library });
  }
  getLibraryEntry(id: string) {
    return activeEntry(this.db, id);
  }

  async updateLibraryEntry(
    id: string,
    input: LibraryUpdate,
    expectedRevision?: number,
  ) {
    const patch = validate(libraryUpdateSchema, input);
    return write(this.db, async () => {
      const current = await activeEntry(this.db, id);
      if (
        expectedRevision !== undefined &&
        current.revision !== expectedRevision
      )
        throw new ConflictError(
          "This library entry changed in another view. Reload it before saving.",
        );
      const values = validateLibraryEdit(current, patch);
      const entry = {
        ...current,
        ...values,
        updatedAt: now(),
        revision: current.revision + 1,
      };
      entry.reviewReasons = await reviewFlags(this.db, entry);
      entry.needsReview = entry.reviewReasons.length > 0;
      await this.db.libraryEntries.put(entry);
      return entry;
    });
  }
  /** Controlled spreadsheet intake; validates all values while retaining imported precision. */
  async importHistoricalLibraryUpdate(
    id: string,
    input: LibraryUpdate,
    expectedRevision: number,
  ) {
    const patch = validate(libraryUpdateSchema, input);
    return write(this.db, async () => {
      const current = await activeEntry(this.db, id);
      if (current.revision !== expectedRevision)
        throw new ConflictError(
          "This entry changed after the import preview. Revalidate before importing.",
        );
      const values = validate(libraryBaseSchema, {
        status: current.status,
        personalRating: current.personalRating,
        personalReview: current.personalReview,
        isFavorite: current.isFavorite,
        startedAt: current.startedAt,
        completedAt: current.completedAt,
        ...patch,
      });
      const entry = {
        ...current,
        ...values,
        ratingPolicy: "historical" as const,
        revision: current.revision + 1,
        updatedAt: now(),
      };
      entry.reviewReasons = await reviewFlags(this.db, entry);
      entry.needsReview = entry.reviewReasons.length > 0;
      await this.db.libraryEntries.put(entry);
      return entry;
    });
  }

  setFavorite(id: string, favorite: boolean) {
    return this.updateLibraryEntry(id, { isFavorite: favorite });
  }
  softDeleteLibraryEntry(id: string) {
    return write(this.db, async () => {
      const entry = await activeEntry(this.db, id);
      const archived = {
        ...entry,
        deletedAt: now(),
        updatedAt: now(),
        revision: entry.revision + 1,
      };
      await this.db.libraryEntries.put(archived);
      return archived;
    });
  }
  restoreLibraryEntry(id: string) {
    return write(this.db, async () => {
      const entry = await required(this.db.libraryEntries, id, "Library entry");
      await required(this.db.titles, entry.titleId, "Title");
      const conflict = await this.db.libraryEntries
        .where("titleId")
        .equals(entry.titleId)
        .filter((other) => other.id !== id && other.deletedAt === null)
        .first();
      if (conflict)
        throw new ConflictError(
          "An active entry already exists for this title.",
        );
      if (entry.deletedAt === null) return entry;
      const restored = {
        ...entry,
        deletedAt: null,
        updatedAt: now(),
        revision: entry.revision + 1,
      };
      await this.db.libraryEntries.put(restored);
      return restored;
    });
  }
  listDeletedEntries() {
    return this.db.libraryEntries
      .filter((entry) => entry.deletedAt !== null)
      .toArray();
  }

  async listLibraryEntries(query: LibraryQuery = {}) {
    return queryLibrary(this.db, query);
  }
  async exportLibraryEntries(query: LibraryQuery = {}) {
    return (
      await queryLibrary(this.db, { ...query, page: 1, pageSize: 200 }, true)
    ).items;
  }

  async bulkUpdate(targets: LibraryTarget[], action: BulkAction) {
    if (
      !targets.length ||
      targets.length > 200 ||
      new Set(targets.map((row) => row.id)).size !== targets.length
    )
      throw new ValidationError("Select 1–200 distinct visible records.");
    return write(this.db, async () => {
      const records = await Promise.all(
        targets.map(async (target) => {
          const entry = await activeEntry(this.db, target.id);
          if (entry.revision !== target.revision)
            throw new ConflictError(
              "A selected record changed. Refresh the selection before applying this action.",
            );
          return entry;
        }),
      );
      const categories = new CategoryService(this.db);
      const titles = await this.db.titles.bulkGet(
        records.map((entry) => entry.titleId),
      );
      if (action.kind === "category_add" || action.kind === "category_remove")
        await categories.getCategory(action.categoryId);
      for (const entry of records) {
        try {
          if (action.kind === "favorite")
            await this.updateLibraryEntry(entry.id, {
              isFavorite: action.value,
            });
          else if (action.kind === "status")
            await this.updateLibraryEntry(entry.id, { status: action.value });
          else if (action.kind === "archive")
            await this.softDeleteLibraryEntry(entry.id);
          else if (action.kind === "category_add") {
            if (
              !(await this.db.libraryCategories.get([
                entry.id,
                action.categoryId,
              ]))
            )
              await categories.addCategory(entry.id, action.categoryId);
          } else await categories.removeCategory(entry.id, action.categoryId);
        } catch (error) {
          if (error instanceof ValidationError) {
            const title = titles[records.indexOf(entry)];
            throw new ValidationError(
              `${title?.title ?? "A selected title"}: ${error.message} No selected records were changed.`,
            );
          }
          throw error;
        }
      }
      return { updated: records.length };
    });
  }
  async quickUpdate(
    target: LibraryTarget,
    patch: LibraryUpdate,
    categoryIds?: string[],
  ) {
    return write(this.db, async () => {
      const entry = await activeEntry(this.db, target.id);
      await this.updateLibraryEntry(entry.id, patch, target.revision);
      if (categoryIds) {
        if (new Set(categoryIds).size !== categoryIds.length)
          throw new ValidationError("Choose each category once.");
        const categories = new CategoryService(this.db),
          links = await this.db.libraryCategories
            .where("libraryEntryId")
            .equals(entry.id)
            .toArray();
        for (const id of categoryIds) await categories.getCategory(id);
        for (const link of links)
          if (!categoryIds.includes(link.categoryId))
            await categories.removeCategory(entry.id, link.categoryId);
        for (const id of categoryIds)
          if (!links.some((link) => link.categoryId === id))
            await categories.addCategory(entry.id, id);
      }
    });
  }
  async getFilterOptions() {
    return this.db.transaction(
      "r",
      [this.db.titles, this.db.libraryEntries],
      async () => {
        const entries = await this.db.libraryEntries
            .filter((entry) => entry.deletedAt === null)
            .toArray(),
          titles = await this.db.titles.bulkGet(
            entries.map((entry) => entry.titleId),
          );
        return {
          languages: [
            ...new Set(
              titles.flatMap((title) =>
                title?.originalLanguage ? [title.originalLanguage] : [],
              ),
            ),
          ].sort(),
          countries: [
            ...new Set(titles.flatMap((title) => title?.countries ?? [])),
          ].sort(),
        };
      },
    );
  }

  async getSummary(): Promise<LibrarySummary> {
    return this.db.transaction(
      "r",
      [this.db.titles, this.db.libraryEntries],
      async () => {
        const movies = new Set(
          await this.db.titles.where("mediaType").equals("movie").primaryKeys(),
        );
        const shows = new Set(
          await this.db.titles.where("mediaType").equals("tv").primaryKeys(),
        );
        return {
          movies: await this.db.libraryEntries
            .filter(
              (entry) => entry.deletedAt === null && movies.has(entry.titleId),
            )
            .count(),
          shows: await this.db.libraryEntries
            .filter(
              (entry) => entry.deletedAt === null && shows.has(entry.titleId),
            )
            .count(),
          watchlist: await this.db.libraryEntries
            .where("status")
            .equals("watchlist")
            .filter((entry) => entry.deletedAt === null)
            .count(),
          favorites: await this.db.libraryEntries
            .filter((entry) => entry.deletedAt === null && entry.isFavorite)
            .count(),
        };
      },
    );
  }
}
