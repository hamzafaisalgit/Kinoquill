export type MediaType = "movie" | "tv";
export type MediaSubtype = "movie" | "tv_series" | "tv_miniseries";
export type WatchStatus =
  | "watchlist"
  | "watching"
  | "completed"
  | "on_hold"
  | "dropped"
  | "caught_up"
  | "unknown";
export type PersonRole = "director" | "creator";
export type DateValue =
  | { precision: "day" | "month" | "year"; value: string }
  | { precision: "unknown"; value: null };
export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}
export interface Title extends Timestamped {
  id: string;
  revision: number;
  title: string;
  normalizedTitle: string;
  originalTitle: string | null;
  mediaType: MediaType;
  mediaSubtype: MediaSubtype;
  releaseYear: number | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  overview: string | null;
  originalLanguage: string | null;
  countries: string[];
  posterPath: string | null;
  backdropPath: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  metadataSource: "manual" | "tmdb" | "import";
  metadataLastSyncedAt: string | null;
}
export interface Genre {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
}
export interface Person extends Timestamped {
  id: string;
  name: string;
  normalizedName: string;
}
export interface TitleGenre {
  titleId: string;
  genreId: string;
}
export interface TitlePerson {
  titleId: string;
  personId: string;
  role: PersonRole;
}
export interface Category extends Timestamped {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
}
export interface LibraryCategory {
  libraryEntryId: string;
  categoryId: string;
}
export interface LibraryEntry {
  id: string;
  titleId: string;
  status: WatchStatus;
  personalRating: number | null;
  personalReview: string | null;
  isFavorite: boolean;
  startedAt: DateValue;
  completedAt: DateValue;
  needsReview: boolean;
  reviewReasons: string[];
  /** Records imported through the historical contract retain their rating precision on edits. */
  ratingPolicy: "manual" | "historical";
  dateAdded: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}
export interface ViewingSession extends Timestamped {
  id: string;
  libraryEntryId: string;
  sessionType: "first_watch" | "rewatch";
  viewedDate: DateValue;
  durationMinutes: number | null;
  notes: string | null;
}
export interface Season extends Timestamped {
  id: string;
  titleId: string;
  seasonNumber: number;
  name: string | null;
  episodeCount: number | null;
  releaseDate: string | null;
}
export interface Episode extends Timestamped {
  id: string;
  seasonId: string;
  episodeNumber: number;
  name: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
}
export interface EpisodeProgress {
  id: string;
  episodeId: string;
  libraryEntryId: string;
  watched: boolean;
  watchedAt: DateValue;
  updatedAt: string;
}
export interface DuplicateMatch {
  strength: "strong" | "possible";
  reason: string;
  title: Title;
}
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export type LibrarySort =
  | "title_asc"
  | "title_desc"
  | "rating_desc"
  | "rating_asc"
  | "newest"
  | "oldest"
  | "year_asc"
  | "year_desc";
export interface LibraryQuery {
  search?: string;
  mediaType?: MediaType;
  mediaSubtype?: MediaSubtype;
  status?: WatchStatus;
  favorite?: boolean;
  genreId?: string;
  categoryId?: string;
  releaseYear?: number;
  minRating?: number;
  maxRating?: number;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
}
export interface LibraryItem {
  entry: LibraryEntry;
  title: Title;
}
export interface LibrarySummary {
  movies: number;
  shows: number;
  watchlist: number;
  favorites: number;
}
