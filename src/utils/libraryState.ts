import type { LibraryQuery, LibrarySort } from "../types/domain";
import { isCalendarDate } from "./dates";
export const SORTS: { value: LibrarySort; label: string }[] = [
  { value: "newest", label: "Recently added" },
  { value: "oldest", label: "Oldest added" },
  { value: "title_asc", label: "Title A–Z" },
  { value: "title_desc", label: "Title Z–A" },
  { value: "rating_desc", label: "Highest personal rating" },
  { value: "rating_asc", label: "Lowest personal rating" },
  { value: "year_desc", label: "Newest release year" },
  { value: "year_asc", label: "Oldest release year" },
  { value: "watched_desc", label: "Recently watched" },
  { value: "watched_asc", label: "Oldest watched" },
  { value: "runtime_desc", label: "Longest runtime" },
  { value: "runtime_asc", label: "Shortest runtime" },
];
export const COLUMNS = [
  ["poster", "Poster"],
  ["title", "Title"],
  ["type", "Media type"],
  ["year", "Release year"],
  ["genres", "Genres"],
  ["people", "Directors / Creators"],
  ["rating", "Personal rating"],
  ["status", "Watch status"],
  ["watched", "Watched / Completed"],
  ["favorite", "Favorite"],
  ["categories", "Categories"],
  ["added", "Date added"],
  ["actions", "Actions"],
] as const;
export type ColumnId = (typeof COLUMNS)[number][0];
export interface LibraryPreferences {
  view: "grid" | "table";
  sort: LibrarySort;
  columns: ColumnId[];
}
export const DEFAULT_LIBRARY_PREFERENCES: LibraryPreferences = {
  view: "grid",
  sort: "newest",
  columns: COLUMNS.filter(([key]) => key !== "categories").map(([key]) => key),
};
export function libraryPreferences(value: unknown): LibraryPreferences {
  if (!value || typeof value !== "object")
    return { ...DEFAULT_LIBRARY_PREFERENCES };
  const record = value as Record<string, unknown>;
  const columns = Array.isArray(record.columns)
    ? COLUMNS.filter(
        ([key]) =>
          key === "title" ||
          (record.columns instanceof Array && record.columns.includes(key)),
      ).map(([key]) => key)
    : DEFAULT_LIBRARY_PREFERENCES.columns;
  return {
    view: record.view === "table" ? "table" : "grid",
    sort: SORTS.some((item) => item.value === record.sort)
      ? (record.sort as LibrarySort)
      : "newest",
    columns,
  };
}
const statuses = [
  "watchlist",
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "caught_up",
  "unknown",
] as const;
export const STATUSES = statuses.map((value) => ({
  value,
  label:
    value === "completed"
      ? "Watched / Completed"
      : value === "on_hold"
        ? "On Hold"
        : value === "caught_up"
          ? "Caught Up"
          : value[0].toUpperCase() + value.slice(1),
}));
export const FILTER_KEYS = [
  "q",
  "type",
  "status",
  "genre",
  "genreMatch",
  "category",
  "categoryMatch",
  "minRating",
  "maxRating",
  "unrated",
  "minYear",
  "maxYear",
  "favorite",
  "language",
  "country",
  "addedFrom",
  "addedTo",
  "watchedFrom",
  "watchedTo",
];
export function parseLibraryParams(params: URLSearchParams): LibraryQuery {
  const numeric = (key: string, min: number, max: number) => {
    const raw = params.get(key);
    if (!raw?.trim()) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max
      ? value
      : undefined;
  };
  const dates = Object.fromEntries(
    ["addedFrom", "addedTo", "watchedFrom", "watchedTo"].flatMap((key) => {
      const value = params.get(key);
      return value && isCalendarDate(value) ? [[key, value]] : [];
    }),
  );
  let minRating = numeric("minRating", 0, 10),
    maxRating = numeric("maxRating", 0, 10),
    minYear = numeric("minYear", 1, 9999),
    maxYear = numeric("maxYear", 1, 9999);
  if (
    minRating !== undefined &&
    maxRating !== undefined &&
    minRating > maxRating
  ) {
    minRating = undefined;
    maxRating = undefined;
  }
  if (minYear !== undefined && maxYear !== undefined && minYear > maxYear) {
    minYear = undefined;
    maxYear = undefined;
  }
  const type = params.get("type"),
    status = params.get("status"),
    sort = params.get("sort");
  return {
    search: params.get("q")?.trim().slice(0, 500),
    ...(type === "movie" || type === "tv"
      ? { mediaType: type }
      : type === "tv_miniseries"
        ? { mediaType: "tv", mediaSubtype: "tv_miniseries" }
        : {}),
    status: statuses.includes(status as (typeof statuses)[number])
      ? (status as (typeof statuses)[number])
      : undefined,
    genreIds: [...new Set(params.getAll("genre"))].slice(0, 100),
    genreMatch: params.get("genreMatch") === "all" ? "all" : "any",
    categoryIds: [...new Set(params.getAll("category"))].slice(0, 100),
    categoryMatch: params.get("categoryMatch") === "all" ? "all" : "any",
    minRating,
    maxRating,
    minYear,
    maxYear,
    unrated: params.get("unrated") === "1",
    favorite: params.get("favorite") === "1" ? true : undefined,
    languages: params.getAll("language").slice(0, 100),
    countries: params.getAll("country").slice(0, 100),
    ...dates,
    sort: SORTS.some((item) => item.value === sort)
      ? (sort as LibrarySort)
      : undefined,
    page: Math.floor(numeric("page", 1, 100000) ?? 1),
    pageSize: 24,
  };
}
export function titleHref(item: { title: { id: string; mediaType: string } }) {
  return `/${item.title.mediaType === "movie" ? "movies" : "shows"}/${item.title.id}`;
}
export function libraryReturn(state: unknown, fallback: string) {
  if (
    state &&
    typeof state === "object" &&
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    /^\/(library|movies|shows|watchlist|favorites)(\?|$)/.test(state.returnTo)
  )
    return state.returnTo;
  return fallback;
}
