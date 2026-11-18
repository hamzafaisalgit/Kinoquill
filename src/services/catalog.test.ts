import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie, { liveQuery } from "dexie";
import { KinoquillDatabase } from "../db/database";
import { INITIAL_GENRES, seedGenres } from "../db/seed";
import { createCatalog } from "./catalog";
import { LocalDatabaseService } from "./localDatabase";
import {
  ConflictError,
  DuplicateTitleError,
  RecordNotFoundError,
  ReferentialIntegrityError,
  ValidationError,
} from "../utils/errors";
import type { LibraryInput, TitleInput } from "../utils/validation";
import {
  titleCreateSchema,
  libraryCreateSchema,
  seasonCreateSchema,
  episodeCreateSchema,
  dateSchema,
  validate,
} from "../utils/validation";
import { UNKNOWN_DATE } from "../utils/dates";

let db: KinoquillDatabase;
let services: ReturnType<typeof createCatalog>;
let genreId: string;
let sequence = 0;
const titleInput = (patch: Partial<TitleInput> = {}): TitleInput => ({
  title: `A film ${++sequence}`,
  mediaType: "movie",
  mediaSubtype: "movie",
  ...patch,
});
const tvInput = (): TitleInput =>
  titleInput({ mediaType: "tv", mediaSubtype: "tv_series" });
const addMovie = (
  title: Partial<TitleInput> = {},
  library: Partial<LibraryInput> = {},
) =>
  services.library.createLibraryTitle({
    title: titleInput(title),
    genreIds: [genreId],
    library: { status: "completed", personalRating: 8, ...library },
  });
const addShow = () =>
  services.library.createLibraryTitle({
    title: tvInput(),
    genreIds: [genreId],
    library: { status: "watching" },
  });

beforeEach(async () => {
  db = new KinoquillDatabase(`kinoquill_test_${crypto.randomUUID()}`);
  services = createCatalog(db);
  await db.open();
  genreId = (await services.genres.createGenre({ name: "Drama" })).id;
});
afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await db.delete();
});

describe("schema and migration integrity", () => {
  it("does not resurrect seeded genres the user explicitly deleted", async () => {
    await seedGenres(db);
    const genre = await db.genres
      .where("normalizedName")
      .equals("action")
      .first();
    await services.genres.deleteGenre(genre!.id);
    await seedGenres(db);
    expect(
      await db.genres.where("normalizedName").equals("action").count(),
    ).toBe(0);
  });
  it("retains existing stores with additive personal journal stores", () => {
    expect(db.verno).toBe(5);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        "appSettings",
        "localMetadata",
        "titles",
        "genres",
        "people",
        "titleGenres",
        "titlePeople",
        "categories",
        "libraryCategories",
        "libraryEntries",
        "viewingSessions",
        "seasons",
        "episodes",
        "episodeProgress",
        "showMetadata",
        "seasonTracking",
        "importBatches",
        "importRecords",
        "customLists",
        "listItems",
        "savedViews",
        "tags",
        "titleTags",
      ].sort(),
    );
  });
  it("upgrades a real v1 database while preserving settings and metadata", async () => {
    const name = `kinoquill_test_migration_${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({ appSettings: "&id", localMetadata: "&key" });
    await old.open();
    await old
      .table("appSettings")
      .put({ id: "preferences", sidebarCollapsed: true });
    await old
      .table("localMetadata")
      .put({ key: "preserve-me", value: "unaltered" });
    old.close();
    const upgraded = new KinoquillDatabase(name);
    try {
      const service = new LocalDatabaseService(upgraded);
      await service.initialize();
      expect(service.getSnapshot().phase).toBe("ready");
      expect(service.getSnapshot().settings.sidebarCollapsed).toBe(true);
      expect((await upgraded.localMetadata.get("preserve-me"))?.value).toBe(
        "unaltered",
      );
      expect(await upgraded.genres.count()).toBe(INITIAL_GENRES.length);
    } finally {
      upgraded.close();
      await upgraded.delete();
    }
  });
  it("seeds idempotently and preserves user genres", async () => {
    await services.genres.createGenre({ name: "Personal genre" });
    await seedGenres(db);
    await seedGenres(db);
    expect(await db.genres.count()).toBe(INITIAL_GENRES.length + 1);
    expect(
      await db.genres.where("normalizedName").equals("personal genre").count(),
    ).toBe(1);
  });
  it("persists catalog data across database instance reopening", async () => {
    const { entry, title } = await addMovie();
    db.close();
    const reopened = new KinoquillDatabase(db.name);
    try {
      await reopened.open();
      expect(
        (await reopened.libraryEntries.get(entry.id))?.personalRating,
      ).toBe(8);
      expect((await reopened.titles.get(title.id))?.id).toBe(title.id);
    } finally {
      reopened.close();
    }
  });
});

describe("titles and duplicate resolution", () => {
  it("allows unrelated metadata edits after a duplicate was explicitly accepted", async () => {
    await services.titles.createTitle(
      titleInput({ title: "Twins", releaseYear: 2000 }),
    );
    const second = await services.titles.createTitle(
      titleInput({ title: "Twins", releaseYear: 2000 }),
      { confirmPossibleDuplicate: true },
    );
    expect(
      (
        await services.titles.updateTitle(second.id, {
          overview: "My distinct production",
        })
      ).overview,
    ).toBe("My distinct production");
  });
  it("treats undefined patch values as omitted and null as an explicit clear", async () => {
    const title = await services.titles.createTitle(
      titleInput({ runtimeMinutes: 120 }),
    );
    expect(
      (
        await services.titles.updateTitle(title.id, {
          runtimeMinutes: undefined,
        })
      ).runtimeMinutes,
    ).toBe(120);
    expect(
      (await services.titles.updateTitle(title.id, { runtimeMinutes: null }))
        .runtimeMinutes,
    ).toBeNull();
  });
  it.each(["movie", "tv_series", "tv_miniseries"] as const)(
    "creates and retrieves %s",
    async (mediaSubtype) => {
      const title = await services.titles.createTitle(
        titleInput({
          mediaSubtype,
          mediaType: mediaSubtype === "movie" ? "movie" : "tv",
        }),
      );
      expect(await services.titles.getTitleById(title.id)).toEqual(title);
      expect(title.releaseYear).toBeNull();
      expect(title.runtimeMinutes).toBeNull();
    },
  );
  it("normalizes case and whitespace while retaining punctuation and accents", async () => {
    const title = await services.titles.createTitle(
      titleInput({ title: "  Amélie   Returns! " }),
    );
    expect(title.title).toBe("Amélie   Returns!");
    expect(title.normalizedTitle).toBe("amélie returns!");
  });
  it("patches one title field without erasing other metadata", async () => {
    const title = await services.titles.createTitle(
      titleInput({
        runtimeMinutes: 123,
        releaseYear: 2020,
        overview: "Keep me",
      }),
    );
    const updated = await services.titles.updateTitle(title.id, {
      title: "Updated title",
    });
    expect(updated).toMatchObject({
      runtimeMinutes: 123,
      releaseYear: 2020,
      overview: "Keep me",
      createdAt: title.createdAt,
      revision: 2,
    });
  });
  it("allows same names with different known release years", async () => {
    await services.titles.createTitle(
      titleInput({ title: "Same", releaseYear: 2000 }),
    );
    await services.titles.createTitle(
      titleInput({ title: "Same", releaseYear: 2020 }),
    );
    expect(await db.titles.count()).toBe(2);
  });
  it("returns structured possible duplicates and requires explicit confirmation", async () => {
    await services.titles.createTitle(
      titleInput({ title: "Arrival", releaseYear: 2016 }),
    );
    const input = titleInput({ title: " arrival ", releaseYear: 2016 });
    await expect(services.titles.createTitle(input)).rejects.toBeInstanceOf(
      DuplicateTitleError,
    );
    expect(
      (
        await services.titles.findDuplicates({
          title: "ARRIVAL",
          mediaType: "movie",
          releaseYear: 2016,
        })
      )[0].strength,
    ).toBe("possible");
    await services.titles.createTitle(input, {
      confirmPossibleDuplicate: true,
    });
    expect(await db.titles.count()).toBe(2);
  });
  it("scopes TMDB IDs to media type and forbids a strong-conflict override", async () => {
    await services.titles.createTitle(titleInput({ tmdbId: 123 }));
    await services.titles.createTitle({ ...tvInput(), tmdbId: 123 });
    await expect(
      services.titles.createTitle(titleInput({ tmdbId: 123 }), {
        confirmPossibleDuplicate: true,
      }),
    ).rejects.toBeInstanceOf(DuplicateTitleError);
    expect(await db.titles.count()).toBe(2);
  });
  it("protects IMDb identities as well", async () => {
    await services.titles.createTitle(titleInput({ imdbId: "tt123456" }));
    await expect(
      services.titles.createTitle(titleInput({ imdbId: "tt123456" })),
    ).rejects.toBeInstanceOf(DuplicateTitleError);
  });
  it("does not change existing data when an update has a duplicate external ID", async () => {
    await services.titles.createTitle(titleInput({ tmdbId: 44 }));
    const title = await services.titles.createTitle(titleInput());
    await expect(
      services.titles.updateTitle(title.id, { tmdbId: 44 }),
    ).rejects.toBeInstanceOf(DuplicateTitleError);
    expect(await db.titles.get(title.id)).toEqual(title);
  });
  it("rejects stale title revisions and missing titles", async () => {
    const title = await services.titles.createTitle(titleInput());
    await services.titles.updateTitle(
      title.id,
      { overview: "new" },
      { expectedRevision: 1 },
    );
    await expect(
      services.titles.updateTitle(
        title.id,
        { overview: "stale" },
        { expectedRevision: 1 },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(services.titles.getTitleById("absent")).rejects.toBeInstanceOf(
      RecordNotFoundError,
    );
  });
  it("prevents media-type mutation after creation", async () => {
    const title = await services.titles.createTitle(titleInput());
    await expect(
      services.titles.updateTitle(title.id, {
        mediaType: "tv",
        mediaSubtype: "tv_series",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("centralized input validation", () => {
  it.each([
    { title: "" },
    { title: "  " },
    { runtimeMinutes: -1 },
    { runtimeMinutes: 0 },
    { releaseDate: "2023-02-29" },
    { releaseDate: "2020-13-01" },
    { releaseYear: 0 },
    { releaseYear: 2020, releaseDate: "2021-01-01" },
    { mediaSubtype: "tv_series" },
  ])("rejects invalid title fields %j", (patch) => {
    expect(() =>
      validate(titleCreateSchema, { ...titleInput(), ...patch }),
    ).toThrow(ValidationError);
  });
  it("rejects a missing media type", () => {
    expect(() =>
      validate(titleCreateSchema, { title: "Test", mediaSubtype: "movie" }),
    ).toThrow(ValidationError);
  });
  it.each([-0.5, 10.5, 8.7, NaN, Infinity])(
    "rejects invalid manual rating %s",
    (personalRating) => {
      expect(() =>
        validate(libraryCreateSchema, { status: "completed", personalRating }),
      ).toThrow(ValidationError);
    },
  );
  it.each([0, 7.5, 10])("accepts manual rating %s", async (personalRating) => {
    expect((await addMovie({}, { personalRating })).entry.personalRating).toBe(
      personalRating,
    );
  });
  it("requires rating for completion but not a watchlist or watching entry", async () => {
    await expect(addMovie({}, { personalRating: null })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(
      (await addMovie({}, { status: "watchlist", personalRating: null })).entry
        .personalRating,
    ).toBeNull();
    expect((await addShow()).entry.personalRating).toBeNull();
  });
  it("requires genres for manual library entries and accepts no director", async () => {
    await expect(
      services.library.createLibraryTitle({
        title: titleInput(),
        library: { status: "watchlist" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.titles.count()).toBe(0);
    await addMovie();
    expect(await db.titlePeople.count()).toBe(0);
  });
  it("rejects invalid and unknown manual statuses", () => {
    expect(() => validate(libraryCreateSchema, { status: "bad" })).toThrow(
      ValidationError,
    );
    expect(() => validate(libraryCreateSchema, { status: "unknown" })).toThrow(
      ValidationError,
    );
  });
  it.each([
    { precision: "year", value: "2023" },
    { precision: "month", value: "2023-09" },
    { precision: "day", value: "2024-02-29" },
    { precision: "unknown", value: null },
  ])("preserves exact date precision %j", (value) =>
    expect(validate(dateSchema, value)).toEqual(value),
  );
  it("does not treat an unknown date as a day or allow impossible dates", () => {
    expect(() =>
      validate(dateSchema, { precision: "day", value: "2023" }),
    ).toThrow(ValidationError);
    expect(() =>
      validate(dateSchema, { precision: "unknown", value: "2023" }),
    ).toThrow(ValidationError);
  });
  it("rejects unambiguous reversed personal dates without confusing release dates", async () => {
    await expect(
      addMovie(
        { releaseDate: "2000-01-01" },
        {
          startedAt: { precision: "day", value: "2024-01-02" },
          completedAt: { precision: "day", value: "2024-01-01" },
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    const result = await addMovie({ releaseDate: "2000-01-01" });
    expect(result.entry.completedAt).toEqual(UNKNOWN_DATE);
  });
  it("rejects invalid season and episode numbers", () => {
    for (const seasonNumber of [-1, 1.5])
      expect(() =>
        validate(seasonCreateSchema, { titleId: "show", seasonNumber }),
      ).toThrow(ValidationError);
    for (const episodeNumber of [0, -1, 1.5])
      expect(() =>
        validate(episodeCreateSchema, { seasonId: "season", episodeNumber }),
      ).toThrow(ValidationError);
  });
});

describe("library editing and historical intake", () => {
  it("updates status, rating and favorites without erasing review or dates", async () => {
    const { entry } = await addMovie(
      {},
      {
        status: "watchlist",
        personalRating: null,
        personalReview: "Keep this",
        startedAt: { precision: "year", value: "2023" },
      },
    );
    await services.library.updateLibraryEntry(entry.id, {
      status: "completed",
      personalRating: 9.5,
    });
    await services.library.setFavorite(entry.id, true);
    expect(await services.library.getLibraryEntry(entry.id)).toMatchObject({
      personalRating: 9.5,
      status: "completed",
      isFavorite: true,
      personalReview: "Keep this",
      startedAt: { precision: "year", value: "2023" },
    });
    await services.library.setFavorite(entry.id, false);
    expect((await services.library.getLibraryEntry(entry.id)).isFavorite).toBe(
      false,
    );
  });
  it("preserves incomplete historical completion with review flags", async () => {
    const { entry } = await services.library.importHistoricalLibraryTitle({
      title: titleInput(),
      library: { status: "completed" },
    });
    expect(entry).toMatchObject({
      personalRating: null,
      needsReview: true,
      ratingPolicy: "historical",
    });
    expect(entry.reviewReasons).toHaveLength(2);
    expect(
      (
        await services.library.updateLibraryEntry(entry.id, {
          personalReview: "Imported history",
        })
      ).personalRating,
    ).toBeNull();
  });
  it("does not assume a missing historical status means completion", async () => {
    const { entry } = await services.library.importHistoricalLibraryTitle({
      title: titleInput({ releaseDate: "2010-06-15" }),
      library: {},
    });
    expect(entry.status).toBe("unknown");
    expect(entry.completedAt).toEqual(UNKNOWN_DATE);
  });
  it("preserves historical decimals on unrelated edits but validates newly entered ratings", async () => {
    const { entry } = await services.library.importHistoricalLibraryTitle({
      title: titleInput(),
      genreIds: [genreId],
      library: { status: "completed", personalRating: 8.7 },
    });
    await services.library.setFavorite(entry.id, true);
    expect(
      (await services.library.getLibraryEntry(entry.id)).personalRating,
    ).toBe(8.7);
    await expect(
      services.library.updateLibraryEntry(entry.id, { personalRating: 8.6 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await services.library.updateLibraryEntry(entry.id, { personalRating: 9 });
    expect(
      (await services.library.getLibraryEntry(entry.id)).personalRating,
    ).toBe(9);
  });
  it("validates historical ratings and references rather than bypassing them", async () => {
    await expect(
      services.library.importHistoricalLibraryTitle({
        title: titleInput(),
        library: { personalRating: 20 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      services.library.importHistoricalLibraryTitle({
        title: titleInput(),
        genreIds: ["missing"],
        library: {},
      }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    expect(await db.titles.count()).toBe(0);
  });
  it("rejects duplicate entries, stale edits and invalid completed transitions", async () => {
    const { entry, title } = await addMovie(
      {},
      { status: "watchlist", personalRating: null },
    );
    await expect(
      services.library.createLibraryEntry(title.id, { status: "watchlist" }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      services.library.updateLibraryEntry(entry.id, { status: "completed" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await services.library.setFavorite(entry.id, true);
    await expect(
      services.library.updateLibraryEntry(
        entry.id,
        { personalReview: "stale" },
        1,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it("supports adding an existing title with its existing genres", async () => {
    const title = await services.titles.createTitle(titleInput());
    await services.genres.assignGenres(title.id, [genreId]);
    const result = await services.library.createLibraryEntry(title.id, {
      status: "watchlist",
    });
    expect(result.title.id).toBe(title.id);
    expect(await db.titles.count()).toBe(1);
  });
});

describe("genres, people and categories", () => {
  it("prevents duplicate normalized genres without conflating different concepts", async () => {
    await expect(
      services.genres.createGenre({ name: "  DRAMA  " }),
    ).rejects.toBeInstanceOf(ConflictError);
    await services.genres.createGenre({ name: "Music" });
    await services.genres.createGenre({ name: "Musical" });
    expect(await db.genres.count()).toBe(3);
  });
  it("assigns multiple genres and removes deleted-genre links without deleting titles", async () => {
    const { title, entry } = await addMovie();
    const other = await services.genres.createGenre({ name: "Action" });
    await services.genres.assignGenres(title.id, [genreId, other.id]);
    expect(await db.titleGenres.count()).toBe(2);
    expect(await services.genres.getTitleGenres(title.id)).toHaveLength(2);
    await services.genres.deleteGenre(genreId);
    expect(await db.titles.count()).toBe(1);
    expect(await db.titleGenres.count()).toBe(1);
    await services.genres.deleteGenre(other.id);
    expect((await db.libraryEntries.get(entry.id))?.needsReview).toBe(true);
  });
  it("rejects duplicate and missing genre associations atomically", async () => {
    const { title } = await addMovie();
    await expect(
      services.genres.assignGenres(title.id, [genreId, genreId]),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      services.genres.assignGenres(title.id, ["missing"]),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    expect(await db.titleGenres.count()).toBe(1);
  });
  it("supports distinct people sharing a name, multiple directors, and creators", async () => {
    const { title } = await addMovie();
    const director = await services.people.createPerson({ name: "Same Name" });
    const other = await services.people.createPerson({ name: "Same Name" });
    expect(other.id).not.toBe(director.id);
    await services.people.attachPersonToTitle(
      title.id,
      director.id,
      "director",
    );
    await services.people.attachPersonToTitle(title.id, other.id, "director");
    const show = await addShow();
    await services.people.attachPersonToTitle(
      show.title.id,
      director.id,
      "creator",
    );
    await expect(
      services.people.attachPersonToTitle(title.id, director.id, "director"),
    ).rejects.toBeInstanceOf(ConflictError);
    await services.people.detachPersonFromTitle(
      title.id,
      director.id,
      "director",
    );
    expect(await db.people.count()).toBe(2);
    expect(await db.titlePeople.count()).toBe(2);
    expect((await services.people.getTitlePeople(title.id))[0].person.id).toBe(
      other.id,
    );
  });
  it("keeps manual directors and categories through metadata edits", async () => {
    const person = await services.people.createPerson({ name: "A Director" });
    const category = await services.categories.createCategory({
      name: "Family Picks",
    });
    const { title, entry } = await services.library.createLibraryTitle({
      title: titleInput(),
      genreIds: [genreId],
      categoryIds: [category.id],
      people: [{ personId: person.id, role: "director" }],
      library: { status: "watchlist" },
    });
    await services.titles.updateTitle(title.id, {
      overview: "New metadata",
      metadataSource: "tmdb",
    });
    expect(
      await db.titlePeople.get([title.id, person.id, "director"]),
    ).toBeDefined();
    expect(
      await db.libraryCategories.get([entry.id, category.id]),
    ).toBeDefined();
  });
  it("creates, renames, attaches, detaches and deletes categories safely", async () => {
    const { entry } = await addMovie();
    const category = await services.categories.createCategory({
      name: "Family",
      description: "Keep description",
    });
    await services.categories.addCategory(entry.id, category.id);
    await expect(
      services.categories.addCategory(entry.id, category.id),
    ).rejects.toBeInstanceOf(ConflictError);
    await services.categories.updateCategory(category.id, {
      name: "Family Picks",
    });
    expect((await services.categories.getEntryCategories(entry.id))[0].id).toBe(
      category.id,
    );
    expect(
      (await services.categories.getCategory(category.id)).description,
    ).toBe("Keep description");
    expect(await db.libraryCategories.count()).toBe(1);
    await expect(
      services.categories.createCategory({ name: "family   picks" }),
    ).rejects.toBeInstanceOf(ConflictError);
    await services.categories.removeCategory(entry.id, category.id);
    expect(await db.libraryCategories.count()).toBe(0);
    await services.categories.addCategory(entry.id, category.id);
    await services.categories.deleteCategory(category.id);
    expect(await db.libraryCategories.count()).toBe(0);
    expect(await db.titles.count()).toBe(1);
  });
});

describe("atomic transactions and archival", () => {
  it("commits every related record for a composite creation", async () => {
    const category = await services.categories.createCategory({ name: "Keep" });
    const person = await services.people.createPerson({ name: "Director" });
    await services.library.createLibraryTitle({
      title: titleInput(),
      library: { status: "completed", personalRating: 8 },
      genreIds: [genreId],
      categoryIds: [category.id],
      people: [{ personId: person.id, role: "director" }],
    });
    for (const table of [
      db.titles,
      db.libraryEntries,
      db.titleGenres,
      db.titlePeople,
      db.libraryCategories,
    ])
      expect(await table.count()).toBe(1);
  });
  it("rolls back a title, links and library entry when a late category reference fails", async () => {
    await expect(
      services.library.createLibraryTitle({
        title: titleInput(),
        genreIds: [genreId],
        categoryIds: ["absent"],
        library: { status: "watchlist" },
      }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    for (const table of [
      db.titles,
      db.libraryEntries,
      db.titleGenres,
      db.libraryCategories,
    ])
      expect(await table.count()).toBe(0);
  });
  it("rolls back all writes if the storage engine rejects a late write", async () => {
    const category = await services.categories.createCategory({ name: "Test" });
    vi.spyOn(db.libraryCategories, "add").mockRejectedValueOnce(
      new Error("Simulated disk failure"),
    );
    await expect(
      services.library.createLibraryTitle({
        title: titleInput(),
        genreIds: [genreId],
        categoryIds: [category.id],
        library: { status: "watchlist" },
      }),
    ).rejects.toThrow("Simulated disk failure");
    expect(await db.titles.count()).toBe(0);
    expect(await db.libraryEntries.count()).toBe(0);
    expect(await db.titleGenres.count()).toBe(0);
  });
  it("rejects repeated association inputs before making writes", async () => {
    await expect(
      services.library.createLibraryTitle({
        title: titleInput(),
        genreIds: [genreId, genreId],
        library: { status: "watchlist" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.titles.count()).toBe(0);
  });
  it("serializes concurrent identical external-ID creation", async () => {
    const results = await Promise.allSettled([
      services.titles.createTitle(titleInput({ tmdbId: 99 })),
      services.titles.createTitle(titleInput({ tmdbId: 99 })),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await db.titles.count()).toBe(1);
  });
  it("soft-deletes and restores ratings, categories, dates and viewing history", async () => {
    const { entry, title } = await addMovie(
      {},
      {
        personalReview: "Keep",
        completedAt: { precision: "year", value: "2023" },
      },
    );
    const category = await services.categories.createCategory({ name: "Keep" });
    await services.categories.addCategory(entry.id, category.id);
    await services.viewing.createViewingSession({
      libraryEntryId: entry.id,
      sessionType: "first_watch",
    });
    await services.library.softDeleteLibraryEntry(entry.id);
    expect((await services.library.listLibraryEntries()).total).toBe(0);
    expect(await services.viewing.listViewingSessions()).toHaveLength(0);
    expect(await db.viewingSessions.count()).toBe(1);
    expect(await services.library.listDeletedEntries()).toHaveLength(1);
    await expect(
      services.library.updateLibraryEntry(entry.id, { personalRating: 9 }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      services.library.createLibraryEntry(title.id, { status: "watchlist" }),
    ).rejects.toBeInstanceOf(ConflictError);
    const restored = await services.library.restoreLibraryEntry(entry.id);
    expect(restored).toMatchObject({
      personalRating: 8,
      personalReview: "Keep",
      completedAt: { precision: "year", value: "2023" },
      dateAdded: entry.dateAdded,
      deletedAt: null,
    });
    expect(await db.libraryCategories.count()).toBe(1);
    expect(await services.viewing.listViewingSessions()).toHaveLength(1);
  });
  it("failed library updates leave the full previous record untouched", async () => {
    const { entry } = await addMovie();
    await expect(
      services.library.updateLibraryEntry(entry.id, {
        personalRating: 20,
        personalReview: "Do not save",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.libraryEntries.get(entry.id)).toEqual(entry);
  });
});

describe("viewing sessions and TV progress", () => {
  it("preserves recorded watch dates on repeated watched updates and clears them when unwatched", async () => {
    const { title, entry } = await addShow();
    const season = await services.tv.createSeason({
      titleId: title.id,
      seasonNumber: 1,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
    const watchedAt = { precision: "year" as const, value: "2023" };
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: true,
      watchedAt,
    });
    expect(
      (
        await services.tv.setEpisodeProgress({
          libraryEntryId: entry.id,
          episodeId: episode.id,
          watched: true,
        })
      ).watchedAt,
    ).toEqual(watchedAt);
    expect(
      (
        await services.tv.setEpisodeProgress({
          libraryEntryId: entry.id,
          episodeId: episode.id,
          watched: false,
        })
      ).watchedAt,
    ).toEqual(UNKNOWN_DATE);
  });
  it("updates season and episode metadata without discarding existing progress", async () => {
    const { title, entry } = await addShow();
    const season = await services.tv.createSeason({
      titleId: title.id,
      seasonNumber: 1,
      episodeCount: 3,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 2,
      runtimeMinutes: 45,
    });
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: true,
    });
    await expect(
      services.tv.updateSeason(season.id, { episodeCount: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(
      (await services.tv.updateEpisode(episode.id, { name: "A new name" }))
        .runtimeMinutes,
    ).toBe(45);
    expect(
      (await services.tv.updateSeason(season.id, { name: "Season One" }))
        .episodeCount,
    ).toBe(3);
    expect((await services.tv.getShowProgress(entry.id)).watchedEpisodes).toBe(
      1,
    );
  });
  it("stores multiple sessions for one title without inventing dates or durations", async () => {
    const { entry } = await addMovie({ runtimeMinutes: 100 });
    const first = await services.viewing.createViewingSession({
      libraryEntryId: entry.id,
      sessionType: "first_watch",
    });
    await services.viewing.createViewingSession({
      libraryEntryId: entry.id,
      sessionType: "rewatch",
      viewedDate: { precision: "year", value: "2023" },
      durationMinutes: 90,
    });
    expect(first.viewedDate).toEqual(UNKNOWN_DATE);
    expect(first.durationMinutes).toBeNull();
    expect(await services.viewing.listViewingSessions(entry.id)).toHaveLength(
      2,
    );
    expect(await db.titles.count()).toBe(1);
    await expect(
      services.viewing.createViewingSession({
        libraryEntryId: entry.id,
        sessionType: "rewatch",
        durationMinutes: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it("rejects viewing sessions and associations with missing references", async () => {
    await expect(
      services.viewing.createViewingSession({
        libraryEntryId: "missing",
        sessionType: "first_watch",
      }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
    const { title } = await addMovie();
    await expect(
      services.people.attachPersonToTitle(title.id, "missing", "director"),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });
  it("allows season zero and rejects seasons on movies", async () => {
    const show = await addShow();
    expect(
      (
        await services.tv.createSeason({
          titleId: show.title.id,
          seasonNumber: 0,
        })
      ).seasonNumber,
    ).toBe(0);
    const movie = await addMovie();
    await expect(
      services.tv.createSeason({ titleId: movie.title.id, seasonNumber: 1 }),
    ).rejects.toBeInstanceOf(ReferentialIntegrityError);
    await expect(
      services.tv.createSeason({ titleId: show.title.id, seasonNumber: 0 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it("creates unique episodes and updates watched/unwatched progress in place", async () => {
    const { title, entry } = await addShow();
    const season = await services.tv.createSeason({
      titleId: title.id,
      seasonNumber: 1,
      episodeCount: 2,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
    await expect(
      services.tv.createEpisode({ seasonId: season.id, episodeNumber: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: true,
      watchedAt: { precision: "day", value: "2024-01-01" },
    });
    expect(await services.tv.getShowProgress(entry.id)).toMatchObject({
      watchedEpisodes: 1,
      totalKnownEpisodes: 2,
      percentage: 50,
    });
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: false,
    });
    expect(await db.episodeProgress.count()).toBe(1);
    expect(await services.tv.getShowProgress(entry.id)).toMatchObject({
      watchedEpisodes: 0,
      percentage: 0,
    });
  });
  it("does not invent totals for seasons with unknown episode counts", async () => {
    const { title, entry } = await addShow();
    const season = await services.tv.createSeason({
      titleId: title.id,
      seasonNumber: 1,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: true,
    });
    expect(await services.tv.getShowProgress(entry.id)).toMatchObject({
      watchedEpisodes: 1,
      totalKnownEpisodes: null,
      percentage: null,
    });
  });
  it("rejects progress belonging to a different show or a movie", async () => {
    const first = await addShow(),
      second = await addShow(),
      movie = await addMovie();
    const season = await services.tv.createSeason({
      titleId: first.title.id,
      seasonNumber: 1,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
    for (const entryId of [second.entry.id, movie.entry.id])
      await expect(
        services.tv.setEpisodeProgress({
          libraryEntryId: entryId,
          episodeId: episode.id,
          watched: true,
        }),
      ).rejects.toBeInstanceOf(ReferentialIntegrityError);
    expect(await db.episodeProgress.count()).toBe(0);
  });
  it("archives without erasing progress, then restores it", async () => {
    const { title, entry } = await addShow();
    const season = await services.tv.createSeason({
      titleId: title.id,
      seasonNumber: 1,
      episodeCount: 1,
    });
    const episode = await services.tv.createEpisode({
      seasonId: season.id,
      episodeNumber: 1,
    });
    await services.tv.setEpisodeProgress({
      libraryEntryId: entry.id,
      episodeId: episode.id,
      watched: true,
    });
    await services.library.softDeleteLibraryEntry(entry.id);
    expect(await db.episodeProgress.count()).toBe(1);
    await expect(services.tv.getShowProgress(entry.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await services.library.restoreLibraryEntry(entry.id);
    expect((await services.tv.getShowProgress(entry.id)).percentage).toBe(100);
  });
});

describe("queries, pagination and live data", () => {
  it("paginates a realistic 5,000-title isolated collection", async () => {
    const { title, entry } = await addMovie({ title: "Benchmark base" });
    const generated = Array.from({ length: 4999 }, (_, index) => {
      const id = crypto.randomUUID();
      return {
        title: {
          ...title,
          id,
          title: `Benchmark ${index}`,
          normalizedTitle: `benchmark ${index}`,
        },
        entry: { ...entry, id: crypto.randomUUID(), titleId: id },
      };
    });
    await db.transaction(
      "rw",
      [db.titles, db.libraryEntries, db.titleGenres],
      async () => {
        await db.titles.bulkAdd(generated.map((item) => item.title));
        await db.libraryEntries.bulkAdd(generated.map((item) => item.entry));
        await db.titleGenres.bulkAdd(
          generated.map((item) => ({ titleId: item.title.id, genreId })),
        );
      },
    );
    const page = await services.library.listLibraryEntries({
      search: "benchmark",
      page: 20,
      pageSize: 100,
    });
    expect(page.total).toBe(5000);
    expect(page.items).toHaveLength(100);
    expect(page.totalPages).toBe(50);
    expect((await services.library.getSummary()).movies).toBe(5002);
  });
  beforeEach(async () => {
    const category = await services.categories.createCategory({
      name: "Selected",
    });
    const alpha = await addMovie(
      { title: "Alpha", releaseYear: 1990 },
      { status: "completed", personalRating: 0, isFavorite: true },
    );
    await services.categories.addCategory(alpha.entry.id, category.id);
    const beta = await addMovie(
      { title: "Beta", releaseYear: 2020 },
      { status: "watchlist", personalRating: null },
    );
    await addShow();
    await services.library.updateLibraryEntry(beta.entry.id, {
      personalReview: "No rating",
    });
  });
  it("filters movies, shows, watchlist, favorites and subtype", async () => {
    expect(
      (await services.library.listLibraryEntries({ mediaType: "movie" })).total,
    ).toBe(2);
    expect(
      (await services.library.listLibraryEntries({ mediaType: "tv" })).total,
    ).toBe(1);
    expect(
      (await services.library.listLibraryEntries({ status: "watchlist" }))
        .total,
    ).toBe(1);
    expect(
      (await services.library.listLibraryEntries({ favorite: true })).total,
    ).toBe(1);
    expect(
      (await services.library.listLibraryEntries({ mediaSubtype: "tv_series" }))
        .total,
    ).toBe(1);
  });
  it("filters genres, categories, release years and ratings while keeping null distinct from zero", async () => {
    const category = (await services.categories.listCategories())[0];
    expect((await services.library.listLibraryEntries({ genreId })).total).toBe(
      3,
    );
    expect(
      (await services.library.listLibraryEntries({ categoryId: category.id }))
        .total,
    ).toBe(1);
    expect(
      (await services.library.listLibraryEntries({ releaseYear: 1990 })).total,
    ).toBe(1);
    expect(
      (
        await services.library.listLibraryEntries({
          minRating: 0,
          maxRating: 0,
        })
      ).total,
    ).toBe(1);
  });
  it("sorts titles and numeric fields with unknown values last", async () => {
    expect(
      (await services.library.listLibraryEntries({ sort: "title_asc" }))
        .items[0].title.title,
    ).toBe("A film " + sequence);
    expect(
      (await services.library.listLibraryEntries({ sort: "title_desc" }))
        .items[0].title.title,
    ).toBe("Beta");
    expect(
      (await services.library.listLibraryEntries({ sort: "rating_asc" }))
        .items[0].entry.personalRating,
    ).toBe(0);
    expect(
      (await services.library.listLibraryEntries({ sort: "year_desc" }))
        .items[0].title.title,
    ).toBe("Beta");
    expect(
      (await services.library.listLibraryEntries({ sort: "year_asc" })).items[0]
        .title.title,
    ).toBe("Alpha");
  });
  it("sorts by actual dateAdded and supports partial normalized title search", async () => {
    const oldest = (await db.libraryEntries.toArray())[0];
    await db.libraryEntries.update(oldest.id, {
      dateAdded: "2000-01-01T00:00:00.000Z",
    });
    expect(
      (await services.library.listLibraryEntries({ sort: "oldest" })).items[0]
        .entry.id,
    ).toBe(oldest.id);
    expect(
      (await services.library.listLibraryEntries({ search: "  ALP  " }))
        .items[0].title.title,
    ).toBe("Alpha");
    expect((await services.titles.listTitles({ search: " BET " })).total).toBe(
      1,
    );
  });
  it("paginates consistently with accurate totals", async () => {
    const page = await services.library.listLibraryEntries({
      page: 2,
      pageSize: 2,
    });
    expect(page).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 2,
      totalPages: 2,
    });
    expect(page.items).toHaveLength(1);
    await expect(
      services.library.listLibraryEntries({ pageSize: 0 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it("counts real active records and excludes archived entries", async () => {
    expect(await services.library.getSummary()).toEqual({
      movies: 2,
      shows: 1,
      watchlist: 1,
      favorites: 1,
    });
    const favorite = (
      await services.library.listLibraryEntries({ favorite: true })
    ).items[0];
    await services.library.softDeleteLibraryEntry(favorite.entry.id);
    expect(await services.library.getSummary()).toEqual({
      movies: 1,
      shows: 1,
      watchlist: 1,
      favorites: 0,
    });
  });
  it("publishes reactive summary updates after writes without polling", async () => {
    const observations: number[] = [];
    let resolveUpdated: () => void = () => {};
    const updated = new Promise<void>((resolve) => {
      resolveUpdated = resolve;
    });
    const subscription = liveQuery(() =>
      services.library.getSummary(),
    ).subscribe((summary) => {
      observations.push(summary.movies);
      if (summary.movies === 3) resolveUpdated();
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await addMovie();
      await Promise.race([
        updated,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("No reactive update")), 2000),
        ),
      ]);
      expect(observations).toContain(3);
    } finally {
      subscription.unsubscribe();
    }
  });
});
