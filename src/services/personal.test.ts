import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { KinoquillDatabase } from "../db/database";
import { createCatalog } from "./catalog";
import { LocalDatabaseService } from "./localDatabase";
import { BackupService } from "./backup/service";
import { validateBackup, BACKUP_STORES } from "./backup/validation";
import { DEFAULT_LIBRARY_PREFERENCES } from "../utils/libraryState";
import { calculateAnalytics } from "../analytics/calculations";
import { readAnalytics } from "../analytics/data";
import { readDiary } from "./diaryService";
let db: KinoquillDatabase,
  c: ReturnType<typeof createCatalog>,
  backup: BackupService;
const extras: KinoquillDatabase[] = [];
beforeEach(async () => {
  db = new KinoquillDatabase(`kinoquill_personal_${crypto.randomUUID()}`);
  await new LocalDatabaseService(db).initialize();
  c = createCatalog(db);
  backup = new BackupService(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const item of [db, ...extras.splice(0)]) {
    item.close();
    await item.delete();
  }
});
const day = (value: string) => ({ precision: "day" as const, value });
async function movie(name = "A personal story") {
  const genre = (await c.genres.listGenres())[0];
  return c.library.importHistoricalLibraryTitle({
    title: {
      title: name,
      mediaType: "movie",
      mediaSubtype: "movie",
      runtimeMinutes: 120,
      releaseYear: 2014,
    },
    library: { status: "completed", personalRating: 8.7 },
    genreIds: [genre.id],
  });
}
async function show() {
  return c.library.importHistoricalLibraryTitle({
    title: {
      title: "A continuing story",
      mediaType: "tv",
      mediaSubtype: "tv_series",
      runtimeMinutes: 45,
    },
    library: { status: "completed", personalRating: 8.5 },
  });
}
async function fullFixture() {
  const m = await movie(),
    tv = await show();
  const person = await c.people.createPerson({ name: "A local director" });
  await c.people.attachPersonToTitle(m.title.id, person.id, "director");
  const category = await c.categories.createCategory({
    name: "For a quiet evening",
  });
  await c.categories.addCategory(m.entry.id, category.id);
  const season = await c.tv.createSeason({
    titleId: tv.title.id,
    seasonNumber: 1,
    episodeCount: 2,
  });
  const ep = await c.tv.createEpisode({
    seasonId: season.id,
    episodeNumber: 1,
    runtimeMinutes: 42,
    airDate: "2025-01-01",
  });
  await c.viewing.createViewingSession(
    {
      libraryEntryId: tv.entry.id,
      episodeId: ep.id,
      sessionType: "first_watch",
      viewedDate: day("2025-03-01"),
      sessionRating: 0,
    },
    { markWatched: true },
  );
  await db.seasonTracking.put({
    libraryEntryId: tv.entry.id,
    seasonId: season.id,
    mode: "exact",
    approximateWatched: 0,
    personalRating: 9,
    updatedAt: new Date().toISOString(),
  });
  await db.showMetadata.put({
    titleId: tv.title.id,
    lastAirDate: null,
    totalSeasons: 1,
    totalEpisodes: 2,
    includeSpecials: false,
  });
  await c.viewing.createViewingSession({
    libraryEntryId: m.entry.id,
    sessionType: "rewatch",
    viewedDate: { precision: "month", value: "2026-03" },
    sessionRating: 9.5,
    notes: "A second perspective",
    platform: "At home",
    context: "With family",
  });
  const list = await c.personal.createListWithTitles(
    { name: "Personal picks", description: "A mixed collection" },
    [m.title.id, tv.title.id],
  );
  const tag = await c.personal.saveTag("slow-burn");
  await c.personal.setTag(m.title.id, tag.id, true);
  await c.personal.saveView({
    name: "Tagged favorites",
    route: "/library",
    params: `tag=${tag.id}&minRating=8`,
    display: DEFAULT_LIBRARY_PREFERENCES,
  });
  await db.importBatches.add({
    id: "batch",
    originalFileName: "history.csv",
    importedAt: new Date().toISOString(),
    fileType: "csv",
    sheetNames: ["History"],
    totalRows: 1,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    warningsCount: 1,
    categoriesCreated: 0,
    movies: 1,
    shows: 0,
    status: "completed",
    entryIds: [m.entry.id],
  });
  await db.importRecords.add({
    id: "provenance",
    batchId: "batch",
    sheet: "History",
    row: 2,
    sourceTitle: m.title.title,
    action: "created",
    titleId: m.title.id,
    entryId: m.entry.id,
    ratedDate: { precision: "year", value: "2024" },
    legacyPosition: "1",
    warnings: ["Historical decimal rating"],
    errors: [],
  });
  return { m, tv, ep, season, list, tag };
}
it("logs, edits and deletes movie rewatches without duplicating titles or changing overall ratings", async () => {
  const m = await movie();
  const first = await c.viewing.createViewingSession({
    libraryEntryId: m.entry.id,
    sessionType: "first_watch",
    viewedDate: day("2025-01-01"),
    sessionRating: 9,
  });
  const revisit = await c.viewing.createViewingSession({
    libraryEntryId: m.entry.id,
    sessionType: "rewatch",
    viewedDate: { precision: "unknown", value: null },
    sessionRating: 0,
    notes: "Different this time",
  });
  await c.viewing.updateViewingSession(revisit.id, {
    notes: "Edited notes",
    platform: "Cinema",
  });
  expect(await db.titles.count()).toBe(1);
  expect((await db.libraryEntries.get(m.entry.id))!.personalRating).toBe(8.7);
  expect((await readDiary(db)).undated).toBe(1);
  await expect(
    c.viewing.createViewingSession({
      libraryEntryId: m.entry.id,
      sessionType: "first_watch",
    }),
  ).rejects.toThrow("already recorded");
  await c.viewing.deleteViewingSession(revisit.id);
  expect((await c.viewing.listViewingSessions()).map((s) => s.id)).toEqual([
    first.id,
  ]);
});
it("keeps episode sessions distinct from unique progress and avoids analytics double counting", async () => {
  const tv = await show(),
    season = await c.tv.createSeason({
      titleId: tv.title.id,
      seasonNumber: 1,
      episodeCount: 1,
    }),
    ep = await c.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
      runtimeMinutes: 42,
      airDate: "2025-01-01",
    });
  await c.viewing.createViewingSession(
    {
      libraryEntryId: tv.entry.id,
      episodeId: ep.id,
      sessionType: "first_watch",
      viewedDate: day("2025-02-01"),
    },
    { markWatched: true },
  );
  const progress = await db.episodeProgress.toArray();
  const repeat = await c.viewing.createViewingSession({
    libraryEntryId: tv.entry.id,
    episodeId: ep.id,
    sessionType: "rewatch",
    viewedDate: day("2026-02-01"),
    durationMinutes: 40,
  });
  let analytics = calculateAnalytics(await readAnalytics(db));
  expect(analytics.tv.watchedEpisodes).toBe(1);
  expect(analytics.events.filter((e) => e.kind === "episode")).toHaveLength(2);
  expect(analytics.time.recorded).toBeCloseTo(40 / 60);
  expect(analytics.time.estimated).toBeCloseTo(42 / 60);
  await c.viewing.deleteViewingSession(repeat.id);
  expect(await db.episodeProgress.toArray()).toEqual(progress);
  analytics = calculateAnalytics(await readAnalytics(db));
  expect(analytics.rewatchItems).toHaveLength(0);
  expect(analytics.events.filter((e) => e.kind === "episode")).toHaveLength(1);
});
it("persists mixed list ordering, prevents duplicate membership and deletes only the list", async () => {
  const a = await movie("First movie"),
    b = await show();
  const list = await c.personal.createListWithTitles(
    { name: "Ordered picks" },
    [a.title.id, b.title.id],
  );
  expect(
    (await c.personal.addToList(list.list.id, [a.title.id])).alreadyPresent,
  ).toBe(1);
  let details = await c.personal.listDetails(list.list.id);
  await c.personal.reorder(
    list.list.id,
    details.items.map((i) => i.row.id).reverse(),
  );
  details = await c.personal.listDetails(list.list.id);
  expect(details.items.map((i) => i.title!.id)).toEqual([
    b.title.id,
    a.title.id,
  ]);
  await expect(c.personal.reorder(list.list.id, ["bad"])).rejects.toThrow(
    "changed",
  );
  await c.personal.deleteList(list.list.id);
  expect(await db.listItems.count()).toBe(0);
  expect(await db.titles.count()).toBe(2);
});
it("saves live filters and display configuration, tags separately, and detects deleted filter references", async () => {
  const m = await movie(),
    tag = await c.personal.saveTag("comfort-watch");
  await c.personal.setTag(m.title.id, tag.id, true);
  const display = {
    ...DEFAULT_LIBRARY_PREFERENCES,
    view: "table" as const,
    sort: "rating_desc" as const,
  };
  const view = await c.personal.saveView({
    name: "Comfort stories",
    description: "Current ratings",
    route: "/library",
    params: `tag=${tag.id}&minRating=8`,
    display,
  });
  expect((await c.personal.views())[0]).toMatchObject({ id: view.id, display });
  expect(
    (await c.library.listLibraryEntries({ tagIds: [tag.id], minRating: 8 }))
      .total,
  ).toBe(1);
  await c.library.updateLibraryEntry(m.entry.id, { personalRating: 7 });
  expect(
    (await c.library.listLibraryEntries({ tagIds: [tag.id], minRating: 8 }))
      .total,
  ).toBe(0);
  await c.personal.deleteTag(tag.id);
  expect((await c.personal.inspectView(view)).missing).toEqual(["tag"]);
  expect(await db.titleTags.count()).toBe(0);
  expect(await db.genres.count()).toBeGreaterThan(0);
});
it("backs up and restores every important relationship, precision, null, ordering and provenance", async () => {
  const fixture = await fullFixture(),
    source = await backup.snapshot();
  expect(BACKUP_STORES.every((name) => Array.isArray(source.data[name]))).toBe(
    true,
  );
  expect(
    source.data.libraryEntries.find((e) => e.id === fixture.m.entry.id)!
      .personalRating,
  ).toBe(8.7);
  expect(JSON.stringify(source)).not.toMatch(
    /tmdbToken|accessToken|storage-check/,
  );
  const target = new KinoquillDatabase(
    `kinoquill_restore_${crypto.randomUUID()}`,
  );
  extras.push(target);
  await target.open();
  await new BackupService(target).restore(
    JSON.parse(JSON.stringify(source)),
    "REPLACE",
  );
  for (const name of BACKUP_STORES)
    expect(await target.table(name).toArray()).toEqual(
      await db.table(name).toArray(),
    );
  expect(
    (await createCatalog(target).personal.listDetails(fixture.list.list.id))
      .items,
  ).toHaveLength(2);
  expect((await readDiary(target)).total).toBe(2);
});
it("rejects incomplete, corrupted and future backups before writes and rolls back a late restore failure", async () => {
  await fullFixture();
  const source = await backup.snapshot();
  await movie("Must survive restore failure");
  const original = await db.libraryEntries.toArray(),
    originalTitles = await db.titles.toArray();
  const invalid = structuredClone(source);
  invalid.data.viewingSessions[0].libraryEntryId = "missing";
  await expect(backup.restore(invalid, "REPLACE")).rejects.toThrow(
    "missing reference",
  );
  expect(() => validateBackup({ ...source, backupVersion: 99 })).toThrow(
    "backupVersion",
  );
  const partial = structuredClone(source) as unknown as {
    data: Record<string, unknown>;
  };
  delete partial.data.listItems;
  expect(() => validateBackup(partial)).toThrow("listItems");
  const duplicate = structuredClone(source);
  duplicate.data.titles.push(duplicate.data.titles[0]);
  expect(() => validateBackup(duplicate)).toThrow("duplicate");
  const fail = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  db.appSettings.hook("creating", fail);
  try {
    await expect(backup.restore(source, "REPLACE")).rejects.toThrow();
  } finally {
    db.appSettings.hook("creating").unsubscribe(fail);
  }
  expect(await db.libraryEntries.toArray()).toEqual(original);
  expect(await db.titles.toArray()).toEqual(originalTitles);
  await expect(backup.clear("wrong")).rejects.toThrow("DELETE");
  expect(await db.titles.count()).toBe(3);
});
it("upgrades a genuine v4 database additively without creating diary sessions or altering legacy rows", async () => {
  const m = await movie();
  const session = await c.viewing.createViewingSession({
    libraryEntryId: m.entry.id,
    sessionType: "first_watch",
    viewedDate: { precision: "unknown", value: null },
  });
  const name = `kinoquill_v4_${crypto.randomUUID()}`,
    old = new Dexie(name),
    newStores = ["customLists", "listItems", "savedViews", "tags", "titleTags"];
  const schema = Object.fromEntries(
    db.tables
      .filter((t) => !newStores.includes(t.name))
      .map((t) => [
        t.name,
        t.name === "viewingSessions"
          ? "&id,libraryEntryId"
          : [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(
              ",",
            ),
      ]),
  );
  old.version(4).stores(schema);
  await old.open();
  for (const table of db.tables.filter((t) => t.name in schema)) {
    const rows = await table.toArray();
    if (rows.length) await old.table(table.name).bulkPut(rows);
  }
  const legacy = {
    id: session.id,
    libraryEntryId: session.libraryEntryId,
    sessionType: session.sessionType,
    viewedDate: session.viewedDate,
    durationMinutes: session.durationMinutes,
    notes: session.notes,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
  await old.table("viewingSessions").put(legacy);
  old.close();
  const upgraded = new KinoquillDatabase(name);
  extras.push(upgraded);
  await upgraded.open();
  expect(upgraded.verno).toBe(5);
  expect(await upgraded.viewingSessions.toArray()).toEqual([legacy]);
  expect(await upgraded.libraryEntries.get(m.entry.id)).toEqual(m.entry);
  expect(await upgraded.customLists.count()).toBe(0);
});
