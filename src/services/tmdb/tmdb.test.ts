import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { mapDetails, mapSearchResult } from "./mapping";
import { configureTmdbToken, removeTmdbToken } from "./client";
import { getMovieDetails, searchTitles } from "./api";
import { tmdbImage } from "./images";
import { KinoquillDatabase } from "../../db/database";
import { TitleService } from "../titleService";

afterEach(() => {
  removeTmdbToken();
  vi.restoreAllMocks();
});

it("maps movie metadata and director suggestions without personal fields", () => {
  const result = mapDetails(
    {
      id: 1,
      title: "Movie fixture",
      release_date: "2020-02-29",
      runtime: 123,
      genres: [{ id: 18, name: "Drama" }],
      credits: {
        crew: [
          { name: "Director fixture", job: "Director" },
          { name: "Editor fixture", job: "Editor" },
        ],
      },
    },
    "movie",
  );
  expect(result.metadata).toMatchObject({
    mediaType: "movie",
    releaseYear: 2020,
    runtimeMinutes: 123,
  });
  expect(result.suggestions).toEqual([
    { name: "Director fixture", role: "director" },
  ]);
  expect(result.metadata).not.toHaveProperty("personalRating");
});
it("maps TV creators and miniseries while excluding person search results", () => {
  const result = mapDetails(
    {
      id: 2,
      name: "Series fixture",
      type: "Miniseries",
      created_by: [{ name: "Creator fixture" }],
      episode_run_time: [42],
      number_of_episodes: 6,
    },
    "tv",
  );
  expect(result.metadata).toMatchObject({
    mediaType: "tv",
    mediaSubtype: "tv_miniseries",
    runtimeMinutes: 42,
  });
  expect(result.suggestions[0].role).toBe("creator");
  expect(
    mapSearchResult({ id: 2, media_type: "person", name: "Person fixture" }),
  ).toBeNull();
});
it("handles missing details and caches selected metadata without inventing dates or runtime", async () => {
  configureTmdbToken("unit-test-session-token");
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 3,
          title: "Minimal fixture",
          runtime: 0,
          release_date: "",
        }),
        { status: 200 },
      ),
    );
  const first = await getMovieDetails(3);
  expect(first.metadata).toMatchObject({
    releaseDate: null,
    releaseYear: null,
    runtimeMinutes: null,
    posterPath: null,
  });
  expect((await getMovieDetails(3)).metadata.title).toBe("Minimal fixture");
  expect(request).toHaveBeenCalledTimes(1);
  expect(tmdbImage("https://untrusted.invalid/image.jpg")).toBeNull();
  expect(tmdbImage("/../../image.jpg")).toBeNull();
});
it("makes no requests without a token and reports authorization failures without leaking it", async () => {
  removeTmdbToken();
  const request = vi.spyOn(globalThis, "fetch");
  await expect(searchTitles("fixture", "all")).rejects.toMatchObject({
    code: "missing_token",
  });
  expect(request).not.toHaveBeenCalled();
  configureTmdbToken("unit-test-session-token");
  request.mockResolvedValue(new Response("{}", { status: 401 }));
  await expect(searchTitles("fixture", "movie")).rejects.toMatchObject({
    code: "authorization",
  });
  expect(String(request.mock.calls[0][0])).toMatch(
    /^https:\/\/api\.themoviedb\.org\/3\/search\/movie\?/,
  );
  expect(String(request.mock.calls[0][0])).not.toContain(
    "unit-test-session-token",
  );
});
it("uses existing local duplicate identities without changing the library", async () => {
  const database = new KinoquillDatabase(
    `kinoquill_test_tmdb_${crypto.randomUUID()}`,
  );
  try {
    const service = new TitleService(database);
    const title = await service.createTitle({
      title: "Local fixture",
      mediaType: "movie",
      mediaSubtype: "movie",
      tmdbId: 456,
    });
    const matches = await service.findDuplicates({
      title: "Local fixture",
      mediaType: "movie",
      tmdbId: 456,
    });
    expect(matches[0]).toMatchObject({
      strength: "strong",
      title: { id: title.id },
    });
    expect(await database.libraryEntries.count()).toBe(0);
  } finally {
    database.close();
    await database.delete();
  }
});
