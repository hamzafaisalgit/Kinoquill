import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KinoquillDatabase } from "../db/database";
import { MovieService } from "./movieService";
import { LibraryService } from "./libraryService";
import { ViewingService } from "./viewingService";
import { initialMovieValues } from "../utils/movieForm";
import type { MovieSaveInput, MovieRecord } from "./movieService";
import { UNKNOWN_DATE } from "../utils/dates";
import { DuplicateTitleError, ValidationError } from "../utils/errors";

let db: KinoquillDatabase;
let movies: MovieService;
beforeEach(() => {
  db = new KinoquillDatabase(`kinoquill_test_movies_${crypto.randomUUID()}`);
  movies = new MovieService(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  db.close();
  await db.delete();
});
function input(): MovieSaveInput {
  return {
    metadata: {
      title: "Movie test fixture",
      mediaType: "movie",
      mediaSubtype: "movie",
    },
    library: { status: "completed", personalRating: 8 },
    genreNames: ["Drama"],
    directors: [{ name: "Director fixture" }],
    categoryNames: ["Personal picks"],
    watchedDate: UNKNOWN_DATE,
    dateChanged: false,
  };
}
function identity(movie: MovieRecord) {
  return {
    titleId: movie.title.id,
    titleRevision: movie.title.revision,
    entryRevision: movie.entry.revision,
  };
}

it("requires a rating for watched movies, accepts zero, and leaves no partial records on failure", async () => {
  await expect(
    movies.saveMovie({
      ...input(),
      library: { status: "completed", personalRating: null },
    }),
  ).rejects.toBeInstanceOf(ValidationError);
  expect(await db.titles.count()).toBe(0);
  expect(await db.genres.count()).toBe(0);
  expect(await db.people.count()).toBe(0);
  const movie = await movies.saveMovie({
    ...input(),
    library: { status: "completed", personalRating: 0 },
  });
  expect(movie.entry.personalRating).toBe(0);
  expect(await db.viewingSessions.count()).toBe(0);
});
it("persists unrated watchlist movies and all selected metadata and associations", async () => {
  const movie = await movies.saveMovie({
    ...input(),
    metadata: {
      ...input().metadata,
      tmdbId: 123,
      imdbId: "tt123",
      posterPath: "/poster.jpg",
      runtimeMinutes: 123,
      releaseYear: 2020,
    },
    library: {
      status: "watchlist",
      personalRating: null,
      personalReview: "My notes",
      isFavorite: true,
    },
  });
  expect(movie.title).toMatchObject({
    tmdbId: 123,
    imdbId: "tt123",
    posterPath: "/poster.jpg",
    runtimeMinutes: 123,
    releaseYear: 2020,
  });
  expect(movie.entry).toMatchObject({
    status: "watchlist",
    personalRating: null,
    personalReview: "My notes",
    isFavorite: true,
  });
  expect(movie.directors[0].name).toBe("Director fixture");
  expect(movie.categories[0].name).toBe("Personal picks");
  expect((await movies.getMovie(movie.title.id)).entry.id).toBe(movie.entry.id);
});
it("edits the same IDs and preserves historical precision, dates added, and unrelated metadata", async () => {
  const history = await new LibraryService(db).importHistoricalLibraryTitle({
    title: input().metadata,
    library: { status: "completed", personalRating: 8.7 },
  });
  const before = await movies.getMovie(history.title.id);
  const values = initialMovieValues(before);
  values.metadata.overview = "Updated overview";
  values.library.personalReview = "Unrounded history";
  const after = await movies.saveMovie(values, identity(before));
  expect(after.title.id).toBe(before.title.id);
  expect(after.entry.id).toBe(before.entry.id);
  expect(after.entry.dateAdded).toBe(before.entry.dateAdded);
  expect(after.entry.personalRating).toBe(8.7);
  expect(after.title.overview).toBe("Updated overview");
  expect(await db.titles.count()).toBe(1);
  await expect(movies.saveMovie(values, identity(before))).rejects.toThrow(
    "changed in another view",
  );
});
it("blocks duplicate external IDs and rolls back a failure after title and association writes", async () => {
  const original = await movies.saveMovie({
    ...input(),
    metadata: { ...input().metadata, tmdbId: 789 },
  });
  await expect(
    movies.saveMovie({
      ...input(),
      metadata: {
        ...input().metadata,
        title: "Conflicting fixture",
        tmdbId: 789,
      },
      genreNames: ["Never committed"],
      categoryNames: ["Never committed"],
    }),
  ).rejects.toBeInstanceOf(DuplicateTitleError);
  expect(await db.genres.count()).toBe(1);
  vi.spyOn(db.viewingSessions, "add").mockRejectedValueOnce(
    new Error("Simulated storage failure"),
  );
  await expect(
    movies.saveMovie({
      ...input(),
      metadata: { ...input().metadata, title: "Rollback fixture" },
      watchedDate: { precision: "day", value: "2020-01-01" },
      dateChanged: true,
    }),
  ).rejects.toThrow("Simulated storage failure");
  expect(await db.titles.count()).toBe(1);
  expect(await db.libraryEntries.count()).toBe(1);
  expect((await movies.getMovie(original.title.id)).entry.personalRating).toBe(
    8,
  );
});
it("updates or clears the original first-watch date without duplicating it or erasing rewatches", async () => {
  const created = await movies.saveMovie({
    ...input(),
    watchedDate: { precision: "day", value: "2020-06-15" },
    dateChanged: true,
  });
  const firstId = created.firstWatch!.id;
  await new ViewingService(db).createViewingSession({
    libraryEntryId: created.entry.id,
    sessionType: "rewatch",
    viewedDate: { precision: "year", value: "2022" },
    notes: "Preserve rewatch",
  });
  const values = initialMovieValues(created);
  values.watchedDate = { precision: "month", value: "2020-07" };
  values.dateChanged = true;
  const updated = await movies.saveMovie(values, identity(created));
  expect(updated.firstWatch!.id).toBe(firstId);
  expect(updated.firstWatch!.viewedDate).toEqual({
    precision: "month",
    value: "2020-07",
  });
  const clear = initialMovieValues(updated);
  clear.watchedDate = UNKNOWN_DATE;
  clear.dateChanged = true;
  await movies.saveMovie(clear, identity(updated));
  expect(await db.viewingSessions.count()).toBe(2);
  expect((await db.viewingSessions.get(firstId))!.viewedDate).toEqual(
    UNKNOWN_DATE,
  );
  expect(
    (
      await db.viewingSessions
        .filter((session) => session.sessionType === "rewatch")
        .first()
    )?.notes,
  ).toBe("Preserve rewatch");
});
it("soft-deletes, hides, and restores the complete personal record without permanent deletion", async () => {
  const created = await movies.saveMovie(input());
  await movies.setFavorite(created.title.id, true);
  await movies.softDelete(created.title.id);
  expect((await new LibraryService(db).listLibraryEntries()).total).toBe(0);
  expect((await movies.listDeletedMovies())[0].title.id).toBe(created.title.id);
  await movies.restore(created.title.id);
  const restored = await movies.getMovie(created.title.id);
  expect(restored.entry.deletedAt).toBeNull();
  expect(restored.entry.isFavorite).toBe(true);
  expect(restored.entry.personalRating).toBe(8);
  expect(restored.genres).toHaveLength(1);
  expect(restored.directors).toHaveLength(1);
  expect(restored.categories).toHaveLength(1);
});
