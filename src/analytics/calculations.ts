import type { DateValue } from "../types/domain";
import type {
  AnalyticsSnapshot,
  AnalyticsTitle,
  AnalyticsEvent,
  AnalyticsFilters,
  ChartRow,
  GroupStat,
} from "./types";
import { DEFAULT_FILTERS } from "./types";
import { filterAnalytics } from "./filters";
import { tvProgress } from "../utils/tvProgress";

const unknown: DateValue = { precision: "unknown", value: null };
export const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const displayNumber = (value: number | null, digits = 1) =>
  value === null
    ? "Unknown"
    : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(
        value,
      );
function indexBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = map.get(id) ?? [];
    group.push(row);
    map.set(id, group);
  }
  return map;
}
export function prepareAnalytics(s: AnalyticsSnapshot, today: string) {
  const titles = new Map(s.titles.map((t) => [t.id, t]));
  const genres = indexBy(s.titleGenres, (r) => r.titleId),
    categories = indexBy(s.libraryCategories, (r) => r.libraryEntryId),
    people = indexBy(s.titlePeople, (r) => r.titleId);
  const seen = new Set<string>();
  const items: AnalyticsTitle[] = [];
  for (const entry of s.entries) {
    const title = titles.get(entry.titleId);
    if (entry.deletedAt !== null || !title || seen.has(title.id)) continue;
    seen.add(title.id);
    items.push({
      title,
      entry,
      genreIds: [
        ...new Set((genres.get(title.id) ?? []).map((r) => r.genreId)),
      ],
      categoryIds: [
        ...new Set((categories.get(entry.id) ?? []).map((r) => r.categoryId)),
      ],
      people: people.get(title.id) ?? [],
    });
  }
  const sessions = indexBy(
    [...new Map(s.sessions.map((r) => [r.id, r])).values()],
    (r) => r.libraryEntryId,
  );
  const seasons = indexBy(s.seasons, (r) => r.titleId),
    episodes = indexBy(s.episodes, (r) => r.seasonId),
    tracking = indexBy(s.tracking, (r) => r.libraryEntryId),
    progress = indexBy(s.progress, (r) => r.libraryEntryId);
  const metadata = new Map(s.metadata.map((r) => [r.titleId, r]));
  const events: AnalyticsEvent[] = [];
  const television = new Map<string, ReturnType<typeof tvProgress>>();
  for (const item of items) {
    const { title: t, entry: e } = item;
    const allVisits = sessions.get(e.id) ?? [];
    const visits = allVisits.filter((v) => !v.episodeId);
    const first = visits.filter((v) => v.sessionType === "first_watch");
    // A completion date is a fallback event, never an extra first viewing.
    if (!first.length && e.status === "completed")
      events.push({
        id: `completion:${e.id}`,
        titleId: t.id,
        kind: t.mediaType === "movie" ? "movie" : "show",
        rewatch: false,
        date: e.completedAt,
        recorded: null,
        estimated: t.mediaType === "movie" ? t.runtimeMinutes : null,
      });
    const aggregateTvDuration =
      t.mediaType === "tv" && first.some((v) => v.durationMinutes !== null);
    for (const v of visits) {
      // Incomplete TV first-watch sessions are not evidence of a completed show.
      const isCompletion =
        t.mediaType === "movie" ||
        e.status === "completed" ||
        v.sessionType === "rewatch";
      events.push({
        id: v.id,
        titleId: t.id,
        kind: isCompletion
          ? t.mediaType === "movie"
            ? "movie"
            : "show"
          : "session",
        rewatch: v.sessionType === "rewatch",
        date: v.viewedDate,
        recorded: v.durationMinutes,
        estimated:
          v.durationMinutes === null && t.mediaType === "movie"
            ? t.runtimeMinutes
            : null,
      });
    }
    if (t.mediaType !== "tv") continue;
    const showSeasons = seasons.get(t.id) ?? [],
      showEpisodes = showSeasons.flatMap(
        (season) => episodes.get(season.id) ?? [],
      );
    const futureIds = new Set(
      showEpisodes
        .filter((ep) => ep.airDate !== null && ep.airDate > today)
        .map((ep) => ep.id),
    );
    const showTracking = tracking.get(e.id) ?? [],
      showProgress = (progress.get(e.id) ?? []).filter(
        (p) => !futureIds.has(p.episodeId),
      );
    const result = tvProgress(
      showSeasons,
      showEpisodes,
      showProgress,
      showTracking,
      metadata.get(t.id),
      today,
    );
    television.set(t.id, result);
    const episodeById = new Map(showEpisodes.map((ep) => [ep.id, ep]));
    const includedSeasons = new Set(result.seasons.map((r) => r.season.id));
    const episodeVisits = allVisits.filter(
      (v) =>
        v.episodeId &&
        episodeById.has(v.episodeId) &&
        includedSeasons.has(episodeById.get(v.episodeId)!.seasonId) &&
        !futureIds.has(v.episodeId),
    );
    const episodeFirstIds = new Set(
      episodeVisits
        .filter((v) => v.sessionType === "first_watch")
        .map((v) => v.episodeId!),
    );
    for (const v of episodeVisits) {
      const episode = episodeById.get(v.episodeId!)!;
      const rewatch = v.sessionType === "rewatch";
      events.push({
        id: v.id,
        titleId: t.id,
        kind: "episode",
        rewatch,
        date: v.viewedDate,
        recorded: aggregateTvDuration && !rewatch ? null : v.durationMinutes,
        estimated:
          v.durationMinutes !== null || (aggregateTvDuration && !rewatch)
            ? null
            : (episode.runtimeMinutes ?? t.runtimeMinutes),
      });
    }
    const watched = new Map(
      showProgress.filter((p) => p.watched).map((p) => [p.episodeId, p]),
    );
    for (const season of result.seasons) {
      if (season.approximate) {
        if (season.watched > 0 && !aggregateTvDuration)
          events.push({
            id: `approx:${season.season.id}`,
            titleId: t.id,
            kind: "episode",
            rewatch: false,
            date: unknown,
            recorded: null,
            estimated:
              t.runtimeMinutes === null
                ? null
                : Math.max(
                    0,
                    season.watched -
                      season.rows.filter((ep) => episodeFirstIds.has(ep.id))
                        .length,
                  ) * t.runtimeMinutes,
          });
        continue;
      }
      for (const episode of season.rows) {
        const p = watched.get(episode.id);
        if (
          !p ||
          episodeFirstIds.has(episode.id) ||
          (episode.airDate !== null && episode.airDate > today)
        )
          continue;
        events.push({
          id: p.id,
          titleId: t.id,
          kind: "episode",
          rewatch: false,
          date: p.watchedAt,
          recorded: null,
          estimated: aggregateTvDuration
            ? null
            : (episode.runtimeMinutes ?? t.runtimeMinutes),
        });
      }
    }
  }
  return { items, events, television };
}
export function ratingSummary(items: AnalyticsTitle[]) {
  const ratings = items
    .flatMap((r) =>
      r.entry.personalRating === null ? [] : [r.entry.personalRating],
    )
    .sort((a, b) => a - b);
  const count = ratings.length,
    mid = Math.floor(count / 2);
  return {
    count,
    average: mean(ratings),
    median: count
      ? count % 2
        ? ratings[mid]
        : (ratings[mid - 1] + ratings[mid]) / 2
      : null,
    highest: count ? ratings[count - 1] : null,
    lowest: count ? ratings[0] : null,
    above8: count ? (100 * ratings.filter((r) => r >= 8).length) / count : null,
    above9: count ? (100 * ratings.filter((r) => r >= 9).length) / count : null,
    histogram: Array.from({ length: 10 }, (_, i) => ({
      name: i === 0 ? "0–1" : `>${i}–${i + 1}`,
      count: ratings.filter((r) =>
        i === 0 ? r >= 0 && r <= 1 : r > i && r <= i + 1,
      ).length,
    })),
  };
}
export function overview(items: AnalyticsTitle[]) {
  return {
    total: items.length,
    movies: items.filter((r) => r.title.mediaType === "movie").length,
    shows: items.filter((r) => r.title.mediaType === "tv").length,
    moviesWatched: items.filter(
      (r) => r.title.mediaType === "movie" && r.entry.status === "completed",
    ).length,
    showsCompleted: items.filter(
      (r) => r.title.mediaType === "tv" && r.entry.status === "completed",
    ).length,
    watching: items.filter((r) => r.entry.status === "watching").length,
    watchlist: items.filter((r) => r.entry.status === "watchlist").length,
    favorites: items.filter((r) => r.entry.isFavorite).length,
    ...ratingSummary(items),
  };
}
export function groupStats(
  items: AnalyticsTitle[],
  keys: (item: AnalyticsTitle) => { id: string; name: string }[],
): GroupStat[] {
  const groups = new Map<string, { name: string; items: AnalyticsTitle[] }>();
  for (const item of items)
    for (const key of new Map(keys(item).map((k) => [k.id, k])).values()) {
      const group = groups.get(key.id) ?? { name: key.name, items: [] };
      group.items.push(item);
      groups.set(key.id, group);
    }
  return [...groups]
    .map(([id, g]) => ({
      id,
      name: g.name,
      count: g.items.length,
      completed: g.items.filter((i) => i.entry.status === "completed").length,
      movies: g.items.filter((i) => i.title.mediaType === "movie").length,
      shows: g.items.filter((i) => i.title.mediaType === "tv").length,
      rated: g.items.filter((i) => i.entry.personalRating !== null).length,
      average: mean(
        g.items.flatMap((i) =>
          i.entry.personalRating === null ? [] : [i.entry.personalRating],
        ),
      ),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}
export function activityByYear(events: AnalyticsEvent[]): ChartRow[] {
  const years = [
    ...new Set(
      events.flatMap((e) =>
        e.date.precision === "unknown" ? [] : [e.date.value.slice(0, 4)],
      ),
    ),
  ].sort();
  return years.map((year) =>
    activityRow(
      events.filter((e) => e.date.value?.startsWith(year)),
      year,
    ),
  );
}
function activityRow(events: AnalyticsEvent[], name: string) {
  return {
    name,
    movies: events.filter((e) => e.kind === "movie").length,
    shows: events.filter((e) => e.kind === "show" && !e.rewatch).length,
    episodes: events.filter(
      (e) => e.kind === "episode" && !e.id.startsWith("approx:"),
    ).length,
    rewatches: events.filter((e) => e.rewatch).length,
    unique: new Set(events.map((e) => e.titleId)).size,
    recordedHours: events.reduce((n, e) => n + (e.recorded ?? 0), 0) / 60,
    estimatedHours: events.reduce((n, e) => n + (e.estimated ?? 0), 0) / 60,
  };
}
export function activityByMonth(
  events: AnalyticsEvent[],
  year: number,
): ChartRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    return activityRow(
      events.filter(
        (e) =>
          (e.date.precision === "day" || e.date.precision === "month") &&
          e.date.value.startsWith(month),
      ),
      new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(year, i, 1)),
      ),
    );
  });
}
export function watchTime(events: AnalyticsEvent[]) {
  const known = events.filter(
    (e) => e.recorded !== null || e.estimated !== null,
  );
  return {
    recorded: known.reduce((n, e) => n + (e.recorded ?? 0), 0) / 60,
    estimated: known.reduce((n, e) => n + (e.estimated ?? 0), 0) / 60,
    hasData: known.length > 0,
    excluded: events.length - known.length,
    rewatch:
      known
        .filter((e) => e.rewatch)
        .reduce((n, e) => n + (e.recorded ?? e.estimated ?? 0), 0) / 60,
    rows: ["movie", "tv"].map((type) => ({
      name: type === "movie" ? "Movies" : "Television",
      recorded:
        known
          .filter((e) =>
            type === "movie" ? e.kind === "movie" : e.kind !== "movie",
          )
          .reduce((n, e) => n + (e.recorded ?? 0), 0) / 60,
      estimated:
        known
          .filter((e) =>
            type === "movie" ? e.kind === "movie" : e.kind !== "movie",
          )
          .reduce((n, e) => n + (e.estimated ?? 0), 0) / 60,
    })),
  };
}
function languageName(code: string | null) {
  if (!code) return "Unknown";
  try {
    const name = new Intl.DisplayNames("en", { type: "language" }).of(code);
    return name && name !== code ? name : `Language (${code})`;
  } catch {
    return `Language (${code})`;
  }
}
function countryName(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames("en", { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
export function calculateAnalytics(
  s: AnalyticsSnapshot,
  f: AnalyticsFilters = DEFAULT_FILTERS,
  today = new Date().toISOString().slice(0, 10),
) {
  const prepared = prepareAnalytics(s, today);
  const { items, events, bounds } = filterAnalytics(
    prepared.items,
    prepared.events,
    f,
    Number(today.slice(0, 4)),
  );
  const genresById = new Map(s.genres.map((g) => [g.id, g.name])),
    peopleById = new Map(s.people.map((p) => [p.id, p.name]));
  const genres = groupStats(items, (i) =>
    i.genreIds.map((id) => ({
      id,
      name: genresById.get(id) ?? "Unknown genre",
    })),
  );
  const person = (role: "director" | "creator") =>
    groupStats(items, (i) =>
      i.people
        .filter((p) => p.role === role)
        .map((p) => ({
          id: p.personId,
          name: peopleById.get(p.personId) ?? "Unknown person",
        })),
    );
  const decades = groupStats(items, (i) =>
    i.title.releaseYear === null
      ? []
      : [
          {
            id: String(Math.floor(i.title.releaseYear / 10) * 10),
            name: `${Math.floor(i.title.releaseYear / 10) * 10}s`,
          },
        ],
  ).sort((a, b) => Number(a.id) - Number(b.id));
  const releases = groupStats(items, (i) =>
    i.title.releaseYear === null
      ? []
      : [
          {
            id: String(i.title.releaseYear),
            name: String(i.title.releaseYear),
          },
        ],
  ).sort((a, b) => Number(a.id) - Number(b.id));
  const languages = groupStats(items, (i) => [
    {
      id: i.title.originalLanguage ?? "unknown",
      name: languageName(i.title.originalLanguage),
    },
  ]);
  const countries = groupStats(items, (i) =>
    (i.title.countries.length ? i.title.countries : ["Unknown"]).map(
      (name) => ({ id: name, name: countryName(name) }),
    ),
  );
  const shows = items.filter((i) => i.title.mediaType === "tv");
  const tvResults = shows.flatMap((i) => {
    const r = prepared.television.get(i.title.id);
    return r ? [r] : [];
  });
  const selectedSeasons = tvResults.flatMap((r) => r.seasons);
  const seasonRatings = selectedSeasons.flatMap((r) =>
    r.tracking?.personalRating == null ? [] : [r.tracking.personalRating],
  );
  const totalKnown = tvResults.reduce((n, r) => n + (r.total ?? 0), 0),
    watched = tvResults.reduce((n, r) => n + r.watched, 0);
  const years = activityByYear(events);
  const o = overview(items),
    time = watchTime(events);
  const rewatchItems = groupStats(items, (i) =>
    events.some((e) => e.titleId === i.title.id && e.rewatch)
      ? [{ id: i.title.id, name: i.title.title }]
      : [],
  )
    .map((r) => ({
      ...r,
      count: events.filter((e) => e.titleId === r.id && e.rewatch).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const insights: string[] = [];
  const watchedGenre = [...genres].sort(
    (a, b) => b.completed - a.completed || a.name.localeCompare(b.name),
  )[0];
  if (watchedGenre?.completed)
    insights.push(
      `${watchedGenre.name} leads completed genres with ${watchedGenre.completed} unique titles. Ties share the lead.`,
    );
  const bestGenre = genres
    .filter((g) => g.rated >= 5)
    .sort(
      (a, b) =>
        (b.average ?? 0) - (a.average ?? 0) || a.name.localeCompare(b.name),
    )[0];
  if (bestGenre)
    insights.push(
      `${bestGenre.name} has the highest genre average among groups with at least five ratings: ${displayNumber(bestGenre.average)}/10 from ${bestGenre.rated} titles. Ties share the lead.`,
    );
  const decade = [...decades].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )[0];
  if (decade)
    insights.push(
      `${decade.name} is a leading release decade in this selection (${decade.count} titles).`,
    );
  if (o.count)
    insights.push(
      `${o.count} of ${o.total} titles are rated; ${displayNumber(o.above8)}% received at least 8/10.`,
    );
  if (rewatchItems.length)
    insights.push(
      `${rewatchItems.length} unique ${rewatchItems.length === 1 ? "title has" : "titles have"} recorded rewatches (${events.filter((e) => e.rewatch).length} sessions).`,
    );
  const recent = events
    .filter((e) => e.kind !== "episode" && e.date.precision !== "unknown")
    .sort((a, b) => (b.date.value ?? "").localeCompare(a.date.value ?? ""));
  const recentIds = [...new Set(recent.map((e) => e.titleId))].slice(0, 5);
  return {
    items,
    events,
    bounds,
    overview: o,
    genres,
    directors: person("director"),
    creators: person("creator"),
    decades,
    releases,
    languages,
    countries,
    years,
    time,
    insights,
    recent: recentIds.flatMap((id) => items.filter((i) => i.title.id === id)),
    rewatchItems,
    undated: events.filter((e) => e.date.precision === "unknown").length,
    unknownRelease: items.filter((i) => i.title.releaseYear === null).length,
    reviewCount: items.filter((i) => i.entry.needsReview).length,
    tv: {
      shows: shows.length,
      knownSeasons: selectedSeasons.length,
      completedSeasons: tvResults.reduce((n, r) => n + r.completedSeasons, 0),
      knownEpisodes: totalKnown,
      watchedEpisodes: watched,
      unknownTotals: tvResults.filter((r) => r.total === null).length,
      approximate: tvResults.filter((r) => r.approximate).length,
      future: tvResults.reduce((n, r) => n + r.future, 0),
      percentage:
        tvResults.length &&
        tvResults.every((r) => r.total !== null) &&
        totalKnown > 0
          ? Math.min(100, (watched / totalKnown) * 100)
          : null,
      seasonAverage: mean(seasonRatings),
      seasonRatingCount: seasonRatings.length,
      showAverage: mean(
        shows.flatMap((i) =>
          i.entry.personalRating === null ? [] : [i.entry.personalRating],
        ),
      ),
      statuses: groupStats(shows, (i) => [
        { id: i.entry.status, name: i.entry.status.replaceAll("_", " ") },
      ]),
      ratings: Array.from({ length: 10 }, (_, i) => ({
        name: i === 0 ? "0–1" : `>${i}–${i + 1}`,
        seasons: seasonRatings.filter((r) =>
          i === 0 ? r >= 0 && r <= 1 : r > i && r <= i + 1,
        ).length,
        shows: shows.filter(
          (r) =>
            r.entry.personalRating !== null &&
            (i === 0
              ? r.entry.personalRating >= 0 && r.entry.personalRating <= 1
              : r.entry.personalRating > i && r.entry.personalRating <= i + 1),
        ).length,
      })),
    },
  };
}
export type AnalyticsResult = ReturnType<typeof calculateAnalytics>;
export function compareYear(
  items: AnalyticsTitle[],
  events: AnalyticsEvent[],
  year: number,
) {
  const selected = events.filter(
    (e) => e.date.value?.slice(0, 4) === String(year),
  );
  const ids = new Set(selected.map((e) => e.titleId));
  return {
    ...activityRow(selected, String(year)),
    average: ratingSummary(items.filter((i) => ids.has(i.title.id))).average,
    rated: items.filter(
      (i) => ids.has(i.title.id) && i.entry.personalRating !== null,
    ).length,
  };
}
