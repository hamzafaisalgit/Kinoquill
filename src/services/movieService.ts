import type { KinoquillDatabase } from "../db/database";
import type {
  Category,
  DateValue,
  Genre,
  LibraryEntry,
  Person,
  Title,
  ViewingSession,
} from "../types/domain";
import type { LibraryInput, TitleInput } from "../utils/validation";
import {
  dateSchema,
  libraryBaseSchema,
  titleCreateSchema,
  validate,
} from "../utils/validation";
import {
  ConflictError,
  RecordNotFoundError,
  ValidationError,
} from "../utils/errors";
import { normalizeName } from "../utils/normalization";
import { UNKNOWN_DATE } from "../utils/dates";
import { domainTables, required, write } from "./domainSupport";
import { TitleService } from "./titleService";
import { LibraryService } from "./libraryService";
import { GenreService } from "./genreService";
import { CategoryService } from "./categoryService";
import { PersonService } from "./personService";
import { ViewingService } from "./viewingService";
import { movieImage } from "../utils/movieImages";

export interface DirectorChoice {
  id?: string;
  name: string;
}
export interface MovieRecord {
  title: Title;
  entry: LibraryEntry;
  genres: Genre[];
  directors: Person[];
  categories: Category[];
  firstWatch: ViewingSession | null;
}
export interface MovieSaveInput {
  metadata: TitleInput;
  library: LibraryInput;
  genreNames: string[];
  directors: DirectorChoice[];
  categoryNames: string[];
  watchedDate: DateValue;
  dateChanged: boolean;
}
export interface MovieEditIdentity {
  titleId: string;
  titleRevision: number;
  entryRevision: number;
}

export function metadataFromTitle(title: Title): TitleInput {
  const { id, revision, normalizedTitle, createdAt, updatedAt, ...metadata } =
    title;
  void id;
  void revision;
  void normalizedTitle;
  void createdAt;
  void updatedAt;
  return metadata;
}

/** Movie-specific orchestration; all writes reuse Phase 2 services in one transaction. */
export class MovieService {
  private readonly db: KinoquillDatabase;
  private readonly titles: TitleService;
  private readonly library: LibraryService;
  private readonly genres: GenreService;
  private readonly people: PersonService;
  private readonly categories: CategoryService;
  private readonly viewing: ViewingService;
  constructor(db: KinoquillDatabase) {
    this.db = db;
    this.titles = new TitleService(db);
    this.library = new LibraryService(db);
    this.genres = new GenreService(db);
    this.people = new PersonService(db);
    this.categories = new CategoryService(db);
    this.viewing = new ViewingService(db);
  }

  async getMovie(titleId: string): Promise<MovieRecord> {
    return this.db.transaction("r", domainTables(this.db), async () => {
      const title = await required(this.db.titles, titleId, "Movie");
      if (title.mediaType !== "movie")
        throw new RecordNotFoundError("This record is not a movie.");
      const entry = await this.db.libraryEntries
        .where("titleId")
        .equals(titleId)
        .first();
      if (!entry)
        throw new RecordNotFoundError(
          "This movie does not have a personal library entry.",
        );
      const genres = await this.genres.getTitleGenres(titleId);
      const directors = (await this.people.getTitlePeople(titleId))
        .filter((link) => link.role === "director")
        .map((link) => link.person);
      const categoryLinks = await this.db.libraryCategories
        .where("libraryEntryId")
        .equals(entry.id)
        .toArray();
      const categories = await Promise.all(
        categoryLinks.map((link) =>
          this.categories.getCategory(link.categoryId),
        ),
      );
      const sessions = await this.db.viewingSessions
        .where("libraryEntryId")
        .equals(entry.id)
        .filter((session) => session.sessionType === "first_watch")
        .sortBy("createdAt");
      return {
        title,
        entry,
        genres,
        directors,
        categories,
        firstWatch: sessions[0] ?? null,
      };
    });
  }

  async listDeletedMovies() {
    return this.db.transaction(
      "r",
      [this.db.libraryEntries, this.db.titles],
      async () => {
        const entries = await this.library.listDeletedEntries();
        const titles = await this.db.titles.bulkGet(
          entries.map((entry) => entry.titleId),
        );
        return entries.flatMap((entry, index) =>
          titles[index]?.mediaType === "movie"
            ? [{ entry, title: titles[index]! }]
            : [],
        );
      },
    );
  }
  async getSummary() {
    return this.db.transaction(
      "r",
      [this.db.titles, this.db.libraryEntries],
      async () => {
        const movieIds = new Set(
          await this.db.titles.where("mediaType").equals("movie").primaryKeys(),
        );
        return {
          watched: await this.db.libraryEntries
            .where("status")
            .equals("completed")
            .filter(
              (entry) =>
                entry.deletedAt === null && movieIds.has(entry.titleId),
            )
            .count(),
        };
      },
    );
  }

  async saveMovie(
    input: MovieSaveInput,
    edit?: MovieEditIdentity,
    confirmPossibleDuplicate = false,
  ) {
    const metadata = validate(titleCreateSchema, input.metadata);
    const library = validate(libraryBaseSchema, input.library);
    const watchedDate = validate(dateSchema, input.watchedDate);
    if (metadata.mediaType !== "movie" || metadata.mediaSubtype !== "movie")
      throw new ValidationError("The movie workflow only accepts movies.");
    for (const image of [metadata.posterPath, metadata.backdropPath])
      if (image && !movieImage(image))
        throw new ValidationError(
          "Use a valid TMDB image path or an HTTPS image URL without embedded credentials.",
        );
    const genreNames = uniqueNames(input.genreNames, "genre");
    const categoryNames = uniqueNames(input.categoryNames, "category");
    uniqueNames(
      input.directors
        .filter((person) => !person.id)
        .map((person) => person.name),
      "new director",
    );
    return write(this.db, async () => {
      const current = edit ? await this.getMovie(edit.titleId) : null;
      if (
        current &&
        (current.title.revision !== edit!.titleRevision ||
          current.entry.revision !== edit!.entryRevision)
      )
        throw new ConflictError(
          "This movie changed in another view. Reload it before saving so no changes are overwritten.",
        );
      if (current?.entry.deletedAt)
        throw new ConflictError("Restore this movie before editing it.");
      if (
        !genreNames.length &&
        !(
          current?.entry.ratingPolicy === "historical" && !current.genres.length
        )
      )
        throw new ValidationError("Please select at least one genre.");
      const genreIds: string[] = [];
      for (const name of genreNames) {
        const existing = await this.db.genres
          .where("normalizedName")
          .equals(normalizeName(name))
          .first();
        genreIds.push(
          existing?.id ?? (await this.genres.createGenre({ name })).id,
        );
      }
      const categoryIds: string[] = [];
      for (const name of categoryNames) {
        const existing = await this.db.categories
          .where("normalizedName")
          .equals(normalizeName(name))
          .first();
        categoryIds.push(
          existing?.id ?? (await this.categories.createCategory({ name })).id,
        );
      }
      const personIds: string[] = [];
      for (const choice of input.directors) {
        const person = choice.id
          ? await this.people.getPerson(choice.id)
          : await this.people.createPerson({ name: choice.name });
        if (personIds.includes(person.id))
          throw new ValidationError("A director can only be selected once.");
        personIds.push(person.id);
      }
      let title: Title, entry: LibraryEntry;
      const personal = {
        ...library,
        ...(input.dateChanged ? { completedAt: watchedDate } : {}),
      };
      if (current) {
        title = await this.titles.updateTitle(current.title.id, metadata, {
          expectedRevision: edit!.titleRevision,
          confirmPossibleDuplicate,
        });
        entry = await this.library.updateLibraryEntry(
          current.entry.id,
          personal,
          edit!.entryRevision,
        );
        await this.genres.assignGenres(title.id, genreIds);
        for (const director of current.directors)
          if (!personIds.includes(director.id))
            await this.people.detachPersonFromTitle(
              title.id,
              director.id,
              "director",
            );
        for (const personId of personIds)
          if (!current.directors.some((person) => person.id === personId))
            await this.people.attachPersonToTitle(
              title.id,
              personId,
              "director",
            );
        for (const category of current.categories)
          if (!categoryIds.includes(category.id))
            await this.categories.removeCategory(entry.id, category.id);
        for (const categoryId of categoryIds)
          if (
            !current.categories.some((category) => category.id === categoryId)
          )
            await this.categories.addCategory(entry.id, categoryId);
      } else {
        const result = await this.library.createLibraryTitle({
          title: metadata,
          library: personal,
          genreIds,
          categoryIds,
          people: personIds.map((personId) => ({ personId, role: "director" })),
          confirmPossibleDuplicate,
        });
        title = result.title;
        entry = result.entry;
      }
      if (input.dateChanged) {
        if (current?.firstWatch)
          await this.viewing.updateViewingSession(current.firstWatch.id, {
            viewedDate: watchedDate,
          });
        else if (watchedDate.precision !== "unknown")
          await this.viewing.createViewingSession({
            libraryEntryId: entry.id,
            sessionType: "first_watch",
            viewedDate: watchedDate,
          });
      }
      return this.getMovie(title.id);
    });
  }

  async setFavorite(titleId: string, favorite: boolean) {
    return write(this.db, async () => {
      const movie = await this.getMovie(titleId);
      return this.library.setFavorite(movie.entry.id, favorite);
    });
  }
  async softDelete(titleId: string) {
    return write(this.db, async () => {
      const movie = await this.getMovie(titleId);
      return this.library.softDeleteLibraryEntry(movie.entry.id);
    });
  }
  async restore(titleId: string) {
    return write(this.db, async () => {
      const movie = await this.getMovie(titleId);
      return this.library.restoreLibraryEntry(movie.entry.id);
    });
  }
}

function uniqueNames(values: string[], label: string) {
  const names = values.map((value) => value.trim());
  if (names.some((name) => !name))
    throw new ValidationError(`Please enter a ${label} name.`);
  if (new Set(names.map(normalizeName)).size !== names.length)
    throw new ValidationError(`Duplicate ${label} selections are not allowed.`);
  return names;
}
export function firstWatchedDate(movie: MovieRecord): DateValue {
  return (
    movie.firstWatch?.viewedDate ?? movie.entry.completedAt ?? UNKNOWN_DATE
  );
}
