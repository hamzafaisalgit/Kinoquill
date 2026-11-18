import type {
  Title,
  LibraryEntry,
  Genre,
  Person,
  Category,
  TitleGenre,
  TitlePerson,
  LibraryCategory,
  ViewingSession,
  Season,
  Episode,
  EpisodeProgress,
  ShowMetadata,
  SeasonTracking,
  DateValue,
} from "../types/domain";
export interface AnalyticsSnapshot {
  titles: Title[];
  entries: LibraryEntry[];
  genres: Genre[];
  people: Person[];
  categories: Category[];
  titleGenres: TitleGenre[];
  titlePeople: TitlePerson[];
  libraryCategories: LibraryCategory[];
  sessions: ViewingSession[];
  seasons: Season[];
  episodes: Episode[];
  progress: EpisodeProgress[];
  metadata: ShowMetadata[];
  tracking: SeasonTracking[];
}
export interface AnalyticsTitle {
  title: Title;
  entry: LibraryEntry;
  genreIds: string[];
  categoryIds: string[];
  people: TitlePerson[];
}
export interface AnalyticsEvent {
  id: string;
  titleId: string;
  kind: "movie" | "show" | "episode" | "session";
  rewatch: boolean;
  date: DateValue;
  recorded: number | null;
  estimated: number | null;
}
export interface AnalyticsFilters {
  media: string;
  date: string;
  year: string;
  from: string;
  to: string;
  minYear: string;
  maxYear: string;
  genreIds: string[];
  categoryIds: string[];
  minRating: string;
  maxRating: string;
  rating: string;
  status: string;
}
export const DEFAULT_FILTERS: AnalyticsFilters = {
  media: "all",
  date: "all",
  year: String(new Date().getFullYear()),
  from: "",
  to: "",
  minYear: "",
  maxYear: "",
  genreIds: [],
  categoryIds: [],
  minRating: "",
  maxRating: "",
  rating: "all",
  status: "all",
};
export interface ChartRow {
  name: string;
  [key: string]: string | number | null;
}
export interface GroupStat extends ChartRow {
  id: string;
  count: number;
  completed: number;
  movies: number;
  shows: number;
  rated: number;
  average: number | null;
}
