import type { KinoquillDatabase } from "../db/database";
import type {
  LibraryEntry,
  LibraryItem,
  LibraryQuery,
  LibrarySummary,
  Title,
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
import { newId, now, normalizeName } from "../utils/normalization";
import { ConflictError, ValidationError } from "../utils/errors";
import { activeEntry, required, reviewFlags, write } from "./domainSupport";
import { TitleService, paginate, pagination } from "./titleService";

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
    const { page, pageSize } = pagination(query);
    if (
      (query.minRating !== undefined &&
        (!Number.isFinite(query.minRating) ||
          query.minRating < 0 ||
          query.minRating > 10)) ||
      (query.maxRating !== undefined &&
        (!Number.isFinite(query.maxRating) ||
          query.maxRating < 0 ||
          query.maxRating > 10)) ||
      (query.minRating !== undefined &&
        query.maxRating !== undefined &&
        query.minRating > query.maxRating)
    )
      throw new ValidationError(
        "Rating filters must be between 0 and 10, with minimum no greater than maximum.",
      );
    return this.db.transaction(
      "r",
      [
        this.db.libraryEntries,
        this.db.titles,
        this.db.titleGenres,
        this.db.libraryCategories,
      ],
      async () => {
        const entries = await (
          query.status
            ? this.db.libraryEntries.where("status").equals(query.status)
            : this.db.libraryEntries.toCollection()
        )
          .filter(
            (entry) =>
              entry.deletedAt === null &&
              (query.favorite === undefined ||
                entry.isFavorite === query.favorite) &&
              (query.minRating === undefined ||
                (entry.personalRating !== null &&
                  entry.personalRating >= query.minRating)) &&
              (query.maxRating === undefined ||
                (entry.personalRating !== null &&
                  entry.personalRating <= query.maxRating)),
          )
          .toArray();
        const titles = await this.db.titles.bulkGet(
          entries.map((entry) => entry.titleId),
        );
        const genreTitles = query.genreId
          ? new Set(
              (
                await this.db.titleGenres
                  .where("genreId")
                  .equals(query.genreId)
                  .toArray()
              ).map((link) => link.titleId),
            )
          : null;
        const categoryEntries = query.categoryId
          ? new Set(
              (
                await this.db.libraryCategories
                  .where("categoryId")
                  .equals(query.categoryId)
                  .toArray()
              ).map((link) => link.libraryEntryId),
            )
          : null;
        const search = normalizeName(query.search ?? "");
        const items: LibraryItem[] = [];
        entries.forEach((entry, index) => {
          const title = titles[index];
          if (!title)
            throw new ConflictError(
              "A library entry references missing metadata. No records were changed.",
            );
          if (
            (!query.mediaType || title.mediaType === query.mediaType) &&
            (!query.mediaSubtype ||
              title.mediaSubtype === query.mediaSubtype) &&
            (query.releaseYear === undefined ||
              title.releaseYear === query.releaseYear) &&
            title.normalizedTitle.includes(search) &&
            (!genreTitles || genreTitles.has(title.id)) &&
            (!categoryEntries || categoryEntries.has(entry.id))
          )
            items.push({ entry, title });
        });
        items.sort((a, b) => compareItems(a, b, query.sort ?? "newest"));
        return paginate(items, page, pageSize);
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

function nullableCompare(
  a: number | null,
  b: number | null,
  descending: boolean,
): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}
function compareItems(
  a: { title: Title; entry: LibraryEntry },
  b: { title: Title; entry: LibraryEntry },
  sort: NonNullable<LibraryQuery["sort"]>,
) {
  let result: number;
  if (sort.startsWith("title_"))
    result =
      a.title.normalizedTitle.localeCompare(b.title.normalizedTitle) *
      (sort === "title_desc" ? -1 : 1);
  else if (sort.startsWith("rating_"))
    result = nullableCompare(
      a.entry.personalRating,
      b.entry.personalRating,
      sort === "rating_desc",
    );
  else if (sort.startsWith("year_"))
    result = nullableCompare(
      a.title.releaseYear,
      b.title.releaseYear,
      sort === "year_desc",
    );
  else
    result =
      a.entry.dateAdded.localeCompare(b.entry.dateAdded) *
      (sort === "newest" ? -1 : 1);
  return result || a.entry.id.localeCompare(b.entry.id);
}
