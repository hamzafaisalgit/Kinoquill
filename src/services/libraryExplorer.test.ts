import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KinoquillDatabase } from "../db/database";
import { createCatalog } from "./catalog";
import { LocalDatabaseService } from "./localDatabase";
import { libraryPreferences, parseLibraryParams } from "../utils/libraryState";
import Dexie from "dexie";
import type { LibrarySort } from "../types/domain";
let db: KinoquillDatabase, catalog: ReturnType<typeof createCatalog>;
beforeEach(() => {
  db = new KinoquillDatabase(`kinoquill_test_explorer_${crypto.randomUUID()}`);
  catalog = createCatalog(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await db.delete();
});
async function fixtures() {
  const drama = await catalog.genres.createGenre({ name: "Drama" }),
    thriller = await catalog.genres.createGenre({ name: "Thriller" }),
    category = await catalog.categories.createCategory({
      name: "Must Rewatch",
    }),
    other = await catalog.categories.createCategory({ name: "Family Picks" }),
    person = await catalog.people.createPerson({ name: "José Creator" });
  const movie = await catalog.library.createLibraryTitle({
    title: {
      title: "Alpha film",
      originalTitle: "Original Lantern",
      mediaType: "movie",
      mediaSubtype: "movie",
      releaseYear: 2010,
      runtimeMinutes: 90,
      originalLanguage: "en",
      countries: ["US"],
    },
    library: {
      status: "completed",
      personalRating: 0,
      personalReview: "An unforgettable voyage",
      completedAt: { precision: "year", value: "2020" },
    },
    genreIds: [drama.id, thriller.id],
    categoryIds: [category.id, other.id],
    people: [{ personId: person.id, role: "director" }],
  });
  const show = await catalog.library.createLibraryTitle({
    title: {
      title: "Beta series",
      mediaType: "tv",
      mediaSubtype: "tv_miniseries",
      releaseYear: 2024,
      runtimeMinutes: 45,
      originalLanguage: "ko",
      countries: ["KR"],
    },
    library: { status: "watchlist" },
    genreIds: [drama.id],
    categoryIds: [category.id],
  });
  return { drama, thriller, category, other, movie, show };
}
it("unifies active movies and shows and searches normalized local metadata, people, genres, categories, reviews and notes", async () => {
  const { movie, show } = await fixtures();
  expect((await catalog.library.listLibraryEntries()).total).toBe(2);
  for (const search of [
    "original lantern",
    "JOSE",
    "thriller",
    "unforgettable voyage",
    "must rewatch",
  ])
    expect(
      (await catalog.library.listLibraryEntries({ search })).items.some(
        (item) => item.entry.id === movie.entry.id,
      ),
    ).toBe(true);
  await catalog.viewing.createViewingSession({
    libraryEntryId: show.entry.id,
    sessionType: "first_watch",
    notes: "Rainy evening",
  });
  expect(
    (await catalog.library.listLibraryEntries({ search: "rainy evening" }))
      .items[0].title.id,
  ).toBe(show.title.id);
  await catalog.library.softDeleteLibraryEntry(movie.entry.id);
  expect(
    (await catalog.library.listLibraryEntries()).items.map(
      (item) => item.title.id,
    ),
  ).toEqual([show.title.id]);
});
it("combines any/all associations, zero versus unrated, ranges, language, country and date precision without invented dates", async () => {
  const { drama, thriller, category, other, movie, show } = await fixtures();
  expect(
    (
      await catalog.library.listLibraryEntries({
        genreIds: [drama.id, thriller.id],
        genreMatch: "any",
      })
    ).total,
  ).toBe(2);
  const result = await catalog.library.listLibraryEntries({
    genreIds: [drama.id, thriller.id],
    genreMatch: "all",
    categoryIds: [category.id, other.id],
    categoryMatch: "all",
    minRating: 0,
    maxRating: 0,
    minYear: 2000,
    maxYear: 2020,
    languages: ["EN"],
    countries: ["us"],
    watchedFrom: "2020-06-01",
    watchedTo: "2020-06-30",
  });
  expect(result.items.map((item) => item.title.id)).toEqual([movie.title.id]);
  expect(result.items[0].watchedDate).toEqual({
    precision: "year",
    value: "2020",
  });
  expect(
    (await catalog.library.listLibraryEntries({ unrated: true })).items[0].title
      .id,
  ).toBe(show.title.id);
  expect(
    (await catalog.library.listLibraryEntries({ watchedFrom: "2021-01-01" }))
      .total,
  ).toBe(0);
  expect(
    (
      await catalog.library.listLibraryEntries({
        categoryIds: ["deleted-reference"],
      })
    ).total,
  ).toBe(2);
  await expect(
    catalog.library.listLibraryEntries({ minRating: 9, maxRating: 1 }),
  ).rejects.toThrow("minimum");
});
it("sorts stably with unknown values last and keeps runtime and viewing dates distinct from release years", async () => {
  const { movie, show } = await fixtures();
  const ids = async (sort: LibrarySort) =>
    (await catalog.library.listLibraryEntries({ sort })).items.map(
      (item) => item.title.id,
    );
  expect(await ids("title_asc")).toEqual([movie.title.id, show.title.id]);
  expect(await ids("year_desc")).toEqual([show.title.id, movie.title.id]);
  expect(await ids("runtime_desc")).toEqual([movie.title.id, show.title.id]);
  expect(await ids("rating_asc")).toEqual([movie.title.id, show.title.id]);
  expect(await ids("watched_desc")).toEqual([movie.title.id, show.title.id]);
  expect(await ids("watched_asc")).toEqual([movie.title.id, show.title.id]);
  expect(await ids("title_asc")).toEqual(await ids("title_asc"));
});
it("uses the existing status and favorite flag for watchlist and favorites without duplicating identities", async () => {
  const { movie, show } = await fixtures();
  await catalog.library.quickUpdate(
    { id: show.entry.id, revision: show.entry.revision },
    { isFavorite: true, status: "watching" },
  );
  expect(
    (await catalog.library.listLibraryEntries({ status: "watchlist" })).total,
  ).toBe(0);
  expect(
    (await catalog.library.listLibraryEntries({ favorite: true })).items[0]
      .title.id,
  ).toBe(show.title.id);
  expect(await db.libraryEntries.count()).toBe(2);
  expect((await db.libraryEntries.get(movie.entry.id))?.personalRating).toBe(0);
});
it("assigns categories idempotently in bulk, protects stale edits, and safely renames or removes category associations", async () => {
  const { movie, show, category } = await fixtures();
  const fresh = async () =>
    Promise.all(
      [movie.entry.id, show.entry.id].map(async (id) => {
        const row = await db.libraryEntries.get(id);
        return { id, revision: row!.revision };
      }),
    );
  await catalog.library.bulkUpdate(await fresh(), {
    kind: "category_add",
    categoryId: category.id,
  });
  expect(
    await db.libraryCategories.where("categoryId").equals(category.id).count(),
  ).toBe(2);
  const stale = await fresh();
  await catalog.categories.updateCategory(category.id, {
    name: "Worth Another Watch",
  });
  await expect(
    catalog.library.bulkUpdate(stale, { kind: "favorite", value: true }),
  ).rejects.toThrow("changed");
  await catalog.library.bulkUpdate(await fresh(), {
    kind: "category_remove",
    categoryId: category.id,
  });
  expect(
    await db.libraryCategories.where("categoryId").equals(category.id).count(),
  ).toBe(0);
  await catalog.categories.deleteCategory(category.id);
  expect(await db.titles.count()).toBe(2);
  expect(await db.libraryEntries.count()).toBe(2);
});
it("rolls back invalid bulk completion and late storage failures while preserving unrelated data and TV progress", async () => {
  const { movie, show } = await fixtures();
  const targets = [movie.entry, show.entry].map((entry) => ({
    id: entry.id,
    revision: entry.revision,
  }));
  await expect(
    catalog.library.bulkUpdate(targets, { kind: "status", value: "completed" }),
  ).rejects.toThrow("rating");
  expect((await db.libraryEntries.get(show.entry.id))?.status).toBe(
    "watchlist",
  );
  expect((await db.libraryEntries.get(movie.entry.id))?.revision).toBe(
    movie.entry.revision,
  );
  const real = db.libraryEntries.put.bind(db.libraryEntries);
  let calls = 0;
  vi.spyOn(db.libraryEntries, "put").mockImplementation((...args) => {
    if (++calls === 2)
      return Dexie.Promise.reject(new Error("Injected late failure"));
    return real(...args);
  });
  await expect(
    catalog.library.bulkUpdate(targets, { kind: "favorite", value: true }),
  ).rejects.toThrow("Injected late failure");
  expect(
    (await db.libraryEntries.toArray()).every((entry) => !entry.isFavorite),
  ).toBe(true);
  vi.restoreAllMocks();
  const season = await catalog.tv.createSeason({
      titleId: show.title.id,
      seasonNumber: 1,
      episodeCount: 1,
    }),
    episode = await catalog.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
  await catalog.tv.setEpisodeProgress({
    libraryEntryId: show.entry.id,
    episodeId: episode.id,
    watched: true,
  });
  await catalog.library.bulkUpdate(targets, { kind: "archive" });
  expect((await catalog.library.listLibraryEntries()).total).toBe(0);
  expect(await db.episodeProgress.count()).toBe(1);
});
it("persists display preferences through the existing store and safely restores malformed URL/preferences", async () => {
  const storage = new LocalDatabaseService(db);
  await storage.initialize();
  await storage.updateSettings({
    library: {
      view: "table",
      sort: "watched_desc",
      columns: ["title", "rating"],
    },
  });
  const restored = new LocalDatabaseService(db);
  await restored.initialize();
  expect(restored.getSnapshot().settings.library?.view).toBe("table");
  expect(restored.getSnapshot().settings.library?.columns).toEqual([
    "title",
    "rating",
  ]);
  expect(
    libraryPreferences({ view: "bad", sort: "bad", columns: ["unknown"] }),
  ).toMatchObject({ view: "grid", sort: "newest", columns: ["title"] });
  expect(
    parseLibraryParams(
      new URLSearchParams(
        "page=NaN&type=bad&sort=bad&minRating=99&watchedFrom=2020-02-31",
      ),
    ),
  ).toMatchObject({ page: 1, minRating: undefined, sort: undefined });
});
