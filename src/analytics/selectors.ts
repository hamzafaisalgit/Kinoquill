import type { AnalyticsResult } from "./calculations";
import { activityByMonth, compareYear, groupStats } from "./calculations";
import type { ChartRow } from "./types";

/** Presentation datasets share indexed joins instead of per-chart storage reads. */
export function selectAnalytics(
  r: AnalyticsResult,
  activityYear: number,
  yearA: number,
  yearB: number,
) {
  const items = new Map(r.items.map((i) => [i.title.id, i]));
  const genres = new Map(r.genres.map((g) => [g.id, g]));
  const yearly = new Map<string, Map<string, Set<string>>>();
  const timeByGenre = new Map(
    r.genres.map((g) => [g.id, { ...g, recorded: 0, estimated: 0 }]),
  );
  for (const e of r.events) {
    const item = items.get(e.titleId);
    if (!item) continue;
    const year = e.date.value?.slice(0, 4);
    for (const id of item.genreIds) {
      const time = timeByGenre.get(id);
      if (time) {
        time.recorded += (e.recorded ?? 0) / 60;
        time.estimated += (e.estimated ?? 0) / 60;
      }
      if (!year) continue;
      const yearMap = yearly.get(year) ?? new Map<string, Set<string>>();
      const titles = yearMap.get(id) ?? new Set<string>();
      titles.add(e.titleId);
      yearMap.set(id, titles);
      yearly.set(year, yearMap);
    }
  }
  const genreYearIds = new Set(
    r.events
      .filter(
        (e) =>
          e.kind !== "episode" &&
          e.kind !== "session" &&
          e.date.value?.startsWith(String(activityYear)),
      )
      .map((e) => e.titleId),
  );
  const genreTrends = groupStats(
    r.items.filter((i) => genreYearIds.has(i.title.id)),
    (i) =>
      i.genreIds.map((id) => ({
        id,
        name: genres.get(id)?.name ?? "Unknown genre",
      })),
  );
  const compareGenres = r.genres.map((g) => ({
    ...g,
    [String(yearA)]: yearly.get(String(yearA))?.get(g.id)?.size ?? 0,
    [String(yearB)]: yearly.get(String(yearB))?.get(g.id)?.size ?? 0,
  }));
  const topGenreIds = r.genres.slice(0, 5).map((g) => g.id);
  const genreYears: ChartRow[] = [...yearly]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, map]) => ({
      name: year,
      ...Object.fromEntries(
        topGenreIds.map((id) => [genres.get(id)!.name, map.get(id)?.size ?? 0]),
      ),
    }));
  return {
    monthly: activityByMonth(r.events, activityYear),
    genreTrends,
    genreYears,
    genreYearKeys: topGenreIds.map((id) => genres.get(id)!.name),
    compareGenres,
    timeByGenre: [...timeByGenre.values()],
    a: compareYear(r.items, r.events, yearA),
    b: compareYear(r.items, r.events, yearB),
  };
}
