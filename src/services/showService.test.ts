import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { KinoquillDatabase } from "../db/database";
import { ShowService } from "./showService";
import type { ShowSaveInput } from "./showService";
import { TvProgressService } from "./tvProgressService";
import { MovieService } from "./movieService";
import { UNKNOWN_DATE } from "../utils/dates";
import { initialMovieValues } from "../utils/movieForm";
import { configureTmdbToken, removeTmdbToken } from "./tmdb/client";

let db: KinoquillDatabase, shows: ShowService, tv: TvProgressService;
beforeEach(() => {
  db = new KinoquillDatabase(`kinoquill_test_shows_${crypto.randomUUID()}`);
  shows = new ShowService(db);
  tv = new TvProgressService(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  removeTmdbToken();
  db.close();
  await db.delete();
});
const input = (): ShowSaveInput => ({
  metadata: {
    title: "Show fixture",
    mediaType: "tv",
    mediaSubtype: "tv_series",
  },
  library: { status: "watching", personalRating: null },
  genreNames: ["Drama"],
  directors: [{ name: "Creator fixture" }],
  categoryNames: ["K-Dramas"],
  watchedDate: UNKNOWN_DATE,
  dateChanged: false,
  show: {
    lastAirDate: null,
    totalEpisodes: null,
    totalSeasons: null,
    includeSpecials: false,
  },
});
async function fixture() {
  const record = await shows.saveShow(input());
  const season = await tv.createSeason({
    titleId: record.title.id,
    seasonNumber: 1,
    episodeCount: 2,
  });
  const first = await tv.createEpisode({
    seasonId: season.id,
    episodeNumber: 1,
    airDate: "2020-01-01",
  });
  const second = await tv.createEpisode({
    seasonId: season.id,
    episodeNumber: 2,
    airDate: "2020-01-02",
  });
  return { record, season, first, second };
}
it("creates TV records with optional metadata and requires a rating only for ordinary completion", async () => {
  await expect(
    shows.saveShow({ ...input(), library: { status: "completed" } }),
  ).rejects.toThrow("rating");
  expect(await db.titles.count()).toBe(0);
  expect(await db.people.count()).toBe(0);
  const record = await shows.saveShow({
    ...input(),
    metadata: {
      ...input().metadata,
      mediaSubtype: "tv_miniseries",
      releaseDate: "2020-01-01",
      releaseYear: 2020,
    },
    library: { status: "completed", personalRating: 0 },
    show: {
      lastAirDate: "2020-01-10",
      totalSeasons: 1,
      totalEpisodes: 10,
      includeSpecials: false,
    },
  });
  expect((await shows.getShow(record.title.id)).entry.personalRating).toBe(0);
  expect(record.title.mediaSubtype).toBe("tv_miniseries");
  expect(record.show.totalEpisodes).toBe(10);
  expect((await db.titlePeople.toArray())[0].role).toBe("creator");
  expect(await db.episodes.count()).toBe(0);
});
it("updates unique episode states and whole seasons, keeping dates, status, IDs, ratings, and archive history", async () => {
  const { record, season, first } = await fixture();
  await shows.watchEpisode(record.entry.id, first.id, true, "2020-02-01");
  await shows.watchEpisode(record.entry.id, first.id, true);
  expect(await db.episodeProgress.count()).toBe(1);
  await expect(
    shows.quickProgress(record.entry.id, season.id, 2, "exact", false),
  ).rejects.toThrow("Confirm");
  await shows.quickProgress(record.entry.id, season.id, 2, "exact", true);
  let tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.percentage).toBe(100);
  expect(tracked.entry.status).toBe("watching");
  expect(
    tracked.progress.find((row) => row.episodeId === first.id)?.watchedAt,
  ).toEqual({ precision: "day", value: "2020-02-01" });
  await shows.rateSeason(record.entry.id, season.id, 8.5);
  const edit = await shows.getShow(record.title.id);
  const changed = await shows.saveShow(
    {
      ...initialMovieValues(edit, undefined, "tv"),
      library: {
        ...initialMovieValues(edit, undefined, "tv").library,
        personalRating: 9,
        personalReview: "Kept",
      },
    },
    {
      titleId: edit.title.id,
      titleRevision: edit.title.revision,
      entryRevision: edit.entry.revision,
    },
  );
  expect(changed.entry.id).toBe(record.entry.id);
  expect(changed.entry.dateAdded).toBe(record.entry.dateAdded);
  await shows.softDelete(record.title.id);
  await expect(
    shows.watchEpisode(record.entry.id, first.id, false),
  ).rejects.toThrow("Restore");
  await shows.restore(record.title.id);
  tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.watched).toBe(2);
  expect(tracked.tracking[0].personalRating).toBe(8.5);
  expect(tracked.entry.personalRating).toBe(9);
  expect(tracked.entry.personalReview).toBe("Kept");
});
it("keeps approximate counts exclusive, excludes specials, and avoids unknown or future next-episode claims", async () => {
  const { record, season, first, second } = await fixture();
  await shows.watchEpisode(record.entry.id, first.id, true);
  const special = await tv.createSeason({
    titleId: record.title.id,
    seasonNumber: 0,
    episodeCount: 10,
  });
  await shows.quickProgress(
    record.entry.id,
    special.id,
    5,
    "approximate",
    true,
  );
  let tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.watched).toBe(1);
  expect(tracked.summary.next?.id).toBe(second.id);
  await shows.quickProgress(record.entry.id, season.id, 2, "approximate", true);
  tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.watched).toBe(2);
  expect(tracked.summary.approximate).toBe(true);
  expect((await tv.getShowProgress(record.entry.id)).watchedEpisodes).toBe(2);
  expect(tracked.summary.next).toBeNull();
  expect(await db.episodeProgress.count()).toBe(1);
  await expect(
    shows.watchEpisode(record.entry.id, second.id, true),
  ).rejects.toThrow("exact tracking");
  await shows.useExact(record.entry.id, season.id);
  await tv.updateEpisode(second.id, { airDate: "9999-01-01" });
  tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.watched).toBe(1);
  expect(tracked.summary.next).toBeNull();
  expect(tracked.summary.future).toBe(1);
  await shows.includeSpecials(record.title.id, true);
  tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.watched).toBe(6);
  await tv.updateSeason(season.id, { episodeCount: null });
  tracked = await shows.tracking(record.title.id);
  expect(tracked.summary.percentage).toBeNull();
});
it("blocks strong duplicates and rolls back a failed season save with its parent show and associations", async () => {
  const record = await shows.saveShow({
    ...input(),
    metadata: { ...input().metadata, tmdbId: 99 },
  });
  await expect(
    shows.saveShow({
      ...input(),
      metadata: { ...input().metadata, tmdbId: 99 },
    }),
  ).rejects.toThrow();
  vi.spyOn(db.seasons, "add").mockRejectedValueOnce(
    new Error("Injected disk failure"),
  );
  await expect(
    shows.saveShow({
      ...input(),
      metadata: { ...input().metadata, title: "Different show" },
      genreNames: ["New genre"],
      seasons: [{ number: 1, name: "One", episodeCount: 8, airDate: null }],
    }),
  ).rejects.toThrow("Injected disk failure");
  expect(await db.titles.count()).toBe(1);
  expect(await db.showMetadata.count()).toBe(1);
  expect(
    (await db.genres.toArray()).some((genre) => genre.name === "New genre"),
  ).toBe(false);
  expect((await shows.getShow(record.title.id)).entry.status).toBe("watching");
});
it("upgrades v2 additively while preserving movies, settings and existing TV progress", async () => {
  const movie = await new MovieService(db).saveMovie({
    ...input(),
    metadata: {
      title: "Movie retained",
      mediaType: "movie",
      mediaSubtype: "movie",
    },
  });
  const { record, first } = await fixture();
  await shows.watchEpisode(record.entry.id, first.id, true);
  await db.appSettings.put({ id: "preferences", sidebarCollapsed: true });
  const snapshot = await db.episodeProgress.toArray();
  // Recreate an isolated v2 database using the retained v2 schema, then upgrade.
  const name = `kinoquill_test_upgrade_${crypto.randomUUID()}`,
    old = new Dexie(name);
  const schema = Object.fromEntries(
    db.tables
      .filter(
        (table) => !["showMetadata", "seasonTracking"].includes(table.name),
      )
      .map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ].join(","),
      ]),
  );
  old.version(2).stores(schema);
  await old.open();
  for (const table of db.tables.filter((table) => table.name in schema)) {
    const rows = await table.toArray();
    if (rows.length) await old.table(table.name).bulkAdd(rows);
  }
  old.close();
  const upgraded = new KinoquillDatabase(name);
  try {
    await upgraded.open();
    expect(await upgraded.titles.get(movie.title.id)).toEqual(movie.title);
    expect(await upgraded.episodeProgress.toArray()).toEqual(snapshot);
    expect(
      (await upgraded.appSettings.get("preferences"))?.sidebarCollapsed,
    ).toBe(true);
    expect(await upgraded.seasonTracking.count()).toBe(0);
    expect(
      (await new ShowService(upgraded).tracking(record.title.id)).summary
        .watched,
    ).toBe(1);
  } finally {
    upgraded.close();
    await upgraded.delete();
  }
});
it("fetches one requested TMDB season before writes and preserves existing episode metadata and progress", async () => {
  const record = await shows.saveShow({
    ...input(),
    metadata: { ...input().metadata, tmdbId: 42 },
  });
  const season = await tv.createSeason({
    titleId: record.title.id,
    seasonNumber: 0,
    episodeCount: 1,
  });
  const first = await tv.createEpisode({
    seasonId: season.id,
    episodeNumber: 1,
    name: "My correction",
  });
  await shows.watchEpisode(record.entry.id, first.id, true);
  configureTmdbToken("test-only-token");
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          season_number: 0,
          episodes: [
            { episode_number: 1, name: "Remote name" },
            {
              episode_number: 2,
              name: "New episode",
              air_date: "2020-01-01",
              runtime: 42,
            },
          ],
        }),
        { status: 200 },
      ),
  );
  expect(await shows.loadSeason(record.entry.id, season.id)).toBe(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain("/tv/42/season/0");
  expect((await tv.getEpisode(first.id)).name).toBe("My correction");
  expect(await db.episodeProgress.count()).toBe(1);
  expect(await shows.loadSeason(record.entry.id, season.id)).toBe(0);
  expect(await db.episodes.count()).toBe(2);
});
