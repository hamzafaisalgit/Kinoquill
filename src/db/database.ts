import Dexie, { type Table } from "dexie";
import type { AppSettings, LocalMetadata } from "../types/storage";
import type { ImportBatch, ImportRecord } from "../types/imports";
import type {
  Title,
  Genre,
  Person,
  TitleGenre,
  TitlePerson,
  Category,
  LibraryCategory,
  LibraryEntry,
  ViewingSession,
  Season,
  Episode,
  EpisodeProgress,
  ShowMetadata,
  SeasonTracking,
} from "../types/domain";

export const DATABASE_NAME = "kinoquill_local";
export const DATABASE_VERSION = 4;

export class KinoquillDatabase extends Dexie {
  appSettings!: Table<AppSettings, string>;
  localMetadata!: Table<LocalMetadata, string>;
  titles!: Table<Title, string>;
  genres!: Table<Genre, string>;
  people!: Table<Person, string>;
  titleGenres!: Table<TitleGenre, [string, string]>;
  titlePeople!: Table<TitlePerson, [string, string, string]>;
  categories!: Table<Category, string>;
  libraryCategories!: Table<LibraryCategory, [string, string]>;
  libraryEntries!: Table<LibraryEntry, string>;
  viewingSessions!: Table<ViewingSession, string>;
  seasons!: Table<Season, string>;
  episodes!: Table<Episode, string>;
  episodeProgress!: Table<EpisodeProgress, string>;
  showMetadata!: Table<ShowMetadata, string>;
  seasonTracking!: Table<SeasonTracking, [string, string]>;
  importBatches!: Table<ImportBatch, string>;
  importRecords!: Table<ImportRecord, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    // Keep the database name stable; evolve schemas with additive version upgrades.
    this.version(1).stores({
      appSettings: "&id",
      localMetadata: "&key",
    });
    this.version(2).stores({
      titles:
        "&id,normalizedTitle,mediaType,mediaSubtype,releaseYear,&[mediaType+tmdbId],&[mediaType+imdbId],[mediaType+normalizedTitle]",
      genres: "&id,&normalizedName",
      people: "&id,normalizedName",
      titleGenres: "[titleId+genreId],titleId,genreId",
      titlePeople: "[titleId+personId+role],titleId,personId",
      categories: "&id,&normalizedName",
      libraryCategories:
        "[libraryEntryId+categoryId],libraryEntryId,categoryId",
      libraryEntries: "&id,&titleId,status,personalRating,dateAdded",
      viewingSessions: "&id,libraryEntryId",
      seasons: "&id,titleId,&[titleId+seasonNumber]",
      episodes: "&id,seasonId,&[seasonId+episodeNumber]",
      episodeProgress:
        "&id,libraryEntryId,episodeId,&[libraryEntryId+episodeId]",
    });
    // Additive: existing titles, movie records, seasons and progress stay untouched.
    this.version(3).stores({
      showMetadata: "&titleId",
      seasonTracking: "[libraryEntryId+seasonId],libraryEntryId,seasonId",
    });
    this.version(4).stores({
      importBatches: "&id,importedAt",
      importRecords: "&id,batchId,entryId,titleId",
    });
  }
}
