import type { DateValue } from "../types/domain";
import type { AnalyticsFilters, AnalyticsTitle, AnalyticsEvent } from "./types";
export function dateBounds(
  f: AnalyticsFilters,
  nowYear: number,
): [string, string] | null {
  if (f.date === "all") return null;
  if (f.date === "range") return [f.from || "0001-01-01", f.to || "9999-12-31"];
  const y =
    f.date === "this"
      ? nowYear
      : f.date === "previous"
        ? nowYear - 1
        : Number(f.year);
  return [
    `${String(y).padStart(4, "0")}-01-01`,
    `${String(y).padStart(4, "0")}-12-31`,
  ];
}
/** Partial dates qualify only when their entire uncertainty interval fits. */
export function dateWithin(
  date: DateValue,
  bounds: [string, string] | null,
): boolean {
  if (!bounds) return true;
  if (date.precision === "unknown") return false;
  const start =
    date.precision === "year"
      ? `${date.value}-01-01`
      : date.precision === "month"
        ? `${date.value}-01`
        : date.value;
  const end =
    date.precision === "year"
      ? `${date.value}-12-31`
      : date.precision === "month"
        ? `${date.value}-${new Date(Date.UTC(Number(date.value.slice(0, 4)), Number(date.value.slice(5, 7)), 0)).getUTCDate()}`
        : date.value;
  return start >= bounds[0] && end <= bounds[1];
}
export function filterAnalytics(
  rows: AnalyticsTitle[],
  events: AnalyticsEvent[],
  f: AnalyticsFilters,
  nowYear: number,
) {
  const bounds = dateBounds(f, nowYear);
  const qualifying = new Set(
    events.filter((e) => dateWithin(e.date, bounds)).map((e) => e.titleId),
  );
  const items = rows.filter(
    ({ title: t, entry: e, genreIds, categoryIds }) =>
      (f.media === "all" || t.mediaType === f.media) &&
      (f.status === "all" || e.status === f.status) &&
      (!f.minYear ||
        (t.releaseYear !== null && t.releaseYear >= Number(f.minYear))) &&
      (!f.maxYear ||
        (t.releaseYear !== null && t.releaseYear <= Number(f.maxYear))) &&
      (!f.genreIds.length || f.genreIds.some((id) => genreIds.includes(id))) &&
      (!f.categoryIds.length ||
        f.categoryIds.some((id) => categoryIds.includes(id))) &&
      (f.rating !== "unrated" || e.personalRating === null) &&
      (f.rating !== "rated" || e.personalRating !== null) &&
      (!f.minRating ||
        (e.personalRating !== null &&
          e.personalRating >= Number(f.minRating))) &&
      (!f.maxRating ||
        (e.personalRating !== null &&
          e.personalRating <= Number(f.maxRating))) &&
      (!bounds || qualifying.has(t.id)),
  );
  const ids = new Set(items.map((i) => i.title.id));
  return {
    items,
    events: events.filter(
      (e) => ids.has(e.titleId) && dateWithin(e.date, bounds),
    ),
    bounds,
  };
}
