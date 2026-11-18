import type { DateValue, LibraryEntry, Title } from "./domain";
import type { LibraryInput, TitleInput } from "../utils/validation";
export interface ImportBatch {
  id: string;
  originalFileName: string;
  importedAt: string;
  fileType: "csv" | "xlsx";
  sheetNames: string[];
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  warningsCount: number;
  categoriesCreated: number;
  movies: number;
  shows: number;
  status: "completed";
  entryIds: string[];
}
export interface ImportRecord {
  id: string;
  batchId: string;
  sheet: string;
  row: number;
  sourceTitle: string;
  action: "created" | "updated" | "skipped" | "failed";
  titleId: string | null;
  entryId: string | null;
  ratedDate: DateValue;
  legacyPosition: string | null;
  warnings: string[];
  errors: string[];
}
export type Cell = string | number | boolean | null;
export interface ParsedSheet {
  name: string;
  rows: { number: number; cells: Cell[] }[];
  notices: string[];
}
export interface ParsedFile {
  name: string;
  size: number;
  type: "csv" | "xlsx";
  sheets: ParsedSheet[];
}
export type Field =
  | "ignore"
  | "title"
  | "originalTitle"
  | "type"
  | "year"
  | "genres"
  | "directors"
  | "creators"
  | "rating"
  | "runtime"
  | "releaseDate"
  | "watchedDate"
  | "startedAt"
  | "completedAt"
  | "ratedDate"
  | "status"
  | "categories"
  | "review"
  | "notes"
  | "language"
  | "countries"
  | "favorite"
  | "tmdbId"
  | "imdbId"
  | "posterPath"
  | "backdropPath"
  | "overview"
  | "position";
export interface SheetConfig {
  name: string;
  selected: boolean;
  headerRow: number;
  defaultType: "" | "movie" | "tv_series" | "tv_miniseries";
  category: string;
  mapping: Record<number, Field>;
}
export interface ImportOptions {
  defaultStatus: LibraryEntry["status"];
  ratingScale: 10 | 5 | 100;
  dateFormat: "auto" | "dmy" | "mdy" | "iso";
  categories: string[];
  enrichment: boolean;
  decodeSafeText: boolean;
}
export interface RowIssue {
  field: string;
  message: string;
  severity: "warning" | "error";
  suggestion: string;
}
export interface ImportData {
  metadata: TitleInput;
  library: LibraryInput;
  genres: string[];
  people: { name: string; role: "director" | "creator" }[];
  categories: string[];
  ratedDate: DateValue;
  legacyPosition: string | null;
  watchedDate: DateValue;
}
export interface ImportMatch {
  title: Title;
  entry: LibraryEntry | null;
}
export type UpdateField =
  | "mediaSubtype"
  | "title"
  | "originalTitle"
  | "releaseYear"
  | "releaseDate"
  | "runtimeMinutes"
  | "overview"
  | "originalLanguage"
  | "countries"
  | "posterPath"
  | "backdropPath"
  | "tmdbId"
  | "imdbId"
  | "genres"
  | "people"
  | "categories"
  | "personalRating"
  | "personalReview"
  | "status"
  | "isFavorite"
  | "startedAt"
  | "completedAt"
  | "watchedDate";
export interface ImportRow {
  id: string;
  sheet: string;
  row: number;
  data: ImportData;
  issues: RowIssue[];
  matches: ImportMatch[];
  fileMatches: { id: string; strong: boolean }[];
  action: "add" | "skip" | "separate" | "update";
  targetId: string | null;
  updateFields: UpdateField[];
}
export interface ImportPlan {
  fileName: string;
  fileType: "csv" | "xlsx";
  sheetNames: string[];
  rows: ImportRow[];
}
