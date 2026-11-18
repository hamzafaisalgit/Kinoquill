import { describe, expect, it } from "vitest";
import {
  calculateAnalytics,
  activityByMonth,
  compareYear,
} from "./calculations";
import { DEFAULT_FILTERS, type AnalyticsSnapshot } from "./types";
import type {
  LibraryEntry,
  Title,
  DateValue,
  ViewingSession,
} from "../types/domain";
const unknown: DateValue = { precision: "unknown", value: null };
const day = (value: string): DateValue => ({ precision: "day", value });
const stamp = "2026-01-01T00:00:00Z";
function fixture(): AnalyticsSnapshot {
  return {
    titles: [],
    entries: [],
    genres: [],
    people: [],
    categories: [],
    titleGenres: [],
    titlePeople: [],
    libraryCategories: [],
    sessions: [],
    seasons: [],
    episodes: [],
    progress: [],
    metadata: [],
    tracking: [],
  };
}
function add(
  s: AnalyticsSnapshot,
  id: string,
  rating: number | null,
  patch: Partial<Title> = {},
  personal: Partial<LibraryEntry> = {},
) {
  const title: Title = {
    id,
    revision: 1,
    title: id,
    normalizedTitle: id,
    originalTitle: null,
    mediaType: "movie",
    mediaSubtype: "movie",
    releaseYear: 2014,
    releaseDate: null,
    runtimeMinutes: 120,
    overview: null,
    originalLanguage: null,
    countries: [],
    posterPath: null,
    backdropPath: null,
    tmdbId: null,
    imdbId: null,
    metadataSource: "manual",
    metadataLastSyncedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  };
  const entry: LibraryEntry = {
    id: `entry:${id}`,
    titleId: id,
    status: "completed",
    personalRating: rating,
    personalReview: null,
    isFavorite: false,
    startedAt: unknown,
    completedAt: unknown,
    needsReview: false,
    reviewReasons: [],
    ratingPolicy: "historical",
    dateAdded: stamp,
    updatedAt: stamp,
    deletedAt: null,
    revision: 1,
    ...personal,
  };
  s.titles.push(title);
  s.entries.push(entry);
  return { title, entry };
}
function session(
  id: string,
  entryId: string,
  type: "first_watch" | "rewatch",
  date: DateValue,
  duration: number | null,
): ViewingSession {
  return {
    id,
    libraryEntryId: entryId,
    sessionType: type,
    viewedDate: date,
    durationMinutes: duration,
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
describe("local analytics definitions", () => {
  it("includes zero, excludes null/archive, deduplicates title identities and preserves decimal buckets", () => {
    const s = fixture();
    add(s, "zero", 0);
    add(s, "historical", 8.7);
    add(s, "unrated", null);
    add(s, "archived", 10, {}, { deletedAt: stamp });
    s.entries.push({ ...s.entries[0], id: "duplicate" });
    const r = calculateAnalytics(s);
    expect(r.overview.total).toBe(3);
    expect(r.overview.count).toBe(2);
    expect(r.overview.average).toBe(4.35);
    expect(r.overview.median).toBe(4.35);
    expect(r.overview.histogram.reduce((n, r) => n + r.count, 0)).toBe(2);
    expect(r.overview.histogram[8].count).toBe(1);
  });
  it("uses viewing years, separates rewatches, and never doubles completion runtime", () => {
    const s = fixture();
    const { entry } = add(
      s,
      "film",
      8.7,
      {},
      { completedAt: day("2025-03-01") },
    );
    s.sessions.push(
      session("first", entry.id, "first_watch", day("2025-03-01"), 90),
      session("again", entry.id, "rewatch", day("2026-02-01"), null),
    );
    s.sessions.push({ ...s.sessions[0] });
    const r = calculateAnalytics(s);
    expect(r.overview.total).toBe(1);
    expect(r.events).toHaveLength(2);
    expect(r.years.map((y) => y.name)).toEqual(["2025", "2026"]);
    expect(r.time.recorded).toBe(1.5);
    expect(r.time.estimated).toBe(2);
    expect(r.time.rewatch).toBe(2);
    expect(r.rewatchItems[0].count).toBe(1);
    expect(compareYear(r.items, r.events, 2025).average).toBe(8.7);
  });
  it("counts multiple genres once each and keeps same-name people separate", () => {
    const s = fixture();
    add(s, "film", 9);
    s.genres = [
      { id: "a", name: "Drama", normalizedName: "drama", createdAt: stamp },
      {
        id: "b",
        name: "Adventure",
        normalizedName: "adventure",
        createdAt: stamp,
      },
    ];
    s.titleGenres = [
      { titleId: "film", genreId: "a" },
      { titleId: "film", genreId: "b" },
      { titleId: "film", genreId: "a" },
    ];
    s.people = ["one", "two"].map((id) => ({
      id,
      name: "Same name",
      normalizedName: "same name",
      createdAt: stamp,
      updatedAt: stamp,
    }));
    s.titlePeople = s.people.map((p) => ({
      titleId: "film",
      personId: p.id,
      role: "director",
    }));
    const r = calculateAnalytics(s);
    expect(r.genres.map((g) => g.count)).toEqual([1, 1]);
    expect(r.directors).toHaveLength(2);
    expect(r.insights.some((t) => t.includes("highest genre average"))).toBe(
      false,
    );
  });
  it("filters personal dates conservatively, never uses release/add dates, and preserves month precision", () => {
    const s = fixture();
    add(
      s,
      "year",
      0,
      {},
      { completedAt: { precision: "year", value: "2025" } },
    );
    add(
      s,
      "month",
      null,
      {},
      { completedAt: { precision: "month", value: "2025-03" } },
    );
    add(s, "unknown", 9, { releaseYear: 2025 });
    const whole = calculateAnalytics(s, {
      ...DEFAULT_FILTERS,
      date: "year",
      year: "2025",
    });
    expect(whole.items).toHaveLength(2);
    expect(activityByMonth(whole.events, 2025)[2].movies).toBe(1);
    const range = calculateAnalytics(s, {
      ...DEFAULT_FILTERS,
      date: "range",
      from: "2025-03-01",
      to: "2025-03-31",
    });
    expect(range.items.map((i) => i.title.id)).toEqual(["month"]);
    expect(
      calculateAnalytics(s, {
        ...DEFAULT_FILTERS,
        minRating: "0",
        maxRating: "0",
      }).items.map((i) => i.title.id),
    ).toEqual(["year"]);
  });
  it("handles unknown TV totals, modes, specials, future episodes and separate season ratings", () => {
    const s = fixture();
    const { entry } = add(s, "show", 8, {
      mediaType: "tv",
      mediaSubtype: "tv_miniseries",
      runtimeMinutes: 45,
    });
    s.seasons = [
      {
        id: "season",
        titleId: "show",
        seasonNumber: 1,
        name: null,
        episodeCount: 3,
        releaseDate: null,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "special",
        titleId: "show",
        seasonNumber: 0,
        name: null,
        episodeCount: 1,
        releaseDate: null,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];
    s.episodes = ["old", "future"].map((id, i) => ({
      id,
      seasonId: "season",
      episodeNumber: i + 1,
      name: null,
      runtimeMinutes: 40,
      airDate: i ? "2028-01-01" : "2025-01-01",
      createdAt: stamp,
      updatedAt: stamp,
    }));
    s.progress = s.episodes.map((ep) => ({
      id: `p:${ep.id}`,
      episodeId: ep.id,
      libraryEntryId: entry.id,
      watched: true,
      watchedAt: day("2025-02-01"),
      updatedAt: stamp,
    }));
    s.tracking = [
      {
        seasonId: "season",
        libraryEntryId: entry.id,
        mode: "exact",
        approximateWatched: 0,
        personalRating: 0,
        updatedAt: stamp,
      },
    ];
    const exact = calculateAnalytics(s, DEFAULT_FILTERS, "2026-11-18");
    expect(exact.tv.watchedEpisodes).toBe(1);
    expect(exact.tv.knownSeasons).toBe(1);
    expect(exact.tv.seasonAverage).toBe(0);
    expect(exact.tv.showAverage).toBe(8);
    expect(exact.time.estimated).toBeCloseTo(40 / 60);
    s.tracking[0].mode = "approximate";
    s.tracking[0].approximateWatched = 2;
    const approximate = calculateAnalytics(s, DEFAULT_FILTERS, "2026-11-18");
    expect(approximate.tv.watchedEpisodes).toBe(2);
    expect(approximate.time.estimated).toBe(1.5);
    expect(
      approximate.events.filter((e) => e.id.startsWith("p:")),
    ).toHaveLength(0);
    s.seasons = [];
    s.episodes = [];
    s.progress = [];
    s.tracking = [];
    const unknown = calculateAnalytics(s);
    expect(unknown.tv.percentage).toBeNull();
    expect(unknown.tv.unknownTotals).toBe(1);
    expect(unknown.time.hasData).toBe(false);
  });
  it("does not invent dates, rating samples, durations or completions for watchlist and incomplete records", () => {
    const s = fixture();
    add(
      s,
      "watchlist",
      null,
      { runtimeMinutes: null },
      { status: "watchlist" },
    );
    add(s, "undated", null, { runtimeMinutes: null });
    const r = calculateAnalytics(s);
    expect(r.years).toEqual([]);
    expect(r.overview.average).toBeNull();
    expect(r.time.hasData).toBe(false);
    expect(r.overview.moviesWatched).toBe(1);
    expect(r.undated).toBe(1);
    expect(compareYear(r.items, r.events, 2025).average).toBeNull();
    expect(
      calculateAnalytics(s, { ...DEFAULT_FILTERS, date: "this" }).items,
    ).toHaveLength(0);
  });
});
