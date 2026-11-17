import { z } from "zod";
import type { MediaType } from "../../types/domain";
import { tmdbGet, getTmdbSession } from "./client";
import { mapSearchResult, detailsSchema, mapDetails } from "./mapping";
import { readMetadataCache, writeMetadataCache } from "./cache";
import { TmdbError } from "./errors";
import type { SearchMode } from "./types";

export async function searchTitles(
  query: string,
  mode: SearchMode,
  signal?: AbortSignal,
) {
  const term = query.trim();
  if (term.length < 2) return [];
  const response = await tmdbGet(
    `/search/${mode === "all" ? "multi" : mode}`,
    z.object({ results: z.array(z.unknown()) }),
    { query: term, include_adult: "false", language: "en-US", page: "1" },
    signal,
  );
  return response.results.flatMap((item) => {
    const result = mapSearchResult(item, mode === "all" ? undefined : mode);
    return result ? [result] : [];
  });
}
export const searchMovies = (query: string, signal?: AbortSignal) =>
  searchTitles(query, "movie", signal);
export const searchShows = (query: string, signal?: AbortSignal) =>
  searchTitles(query, "tv", signal);

export async function getTitleDetails(
  id: number,
  mediaType: MediaType,
  signal?: AbortSignal,
) {
  if (!Number.isInteger(id) || id < 1 || !["movie", "tv"].includes(mediaType))
    throw new TmdbError(
      "invalid_response",
      "This title identifier is invalid.",
    );
  if (!getTmdbSession().configured)
    throw new TmdbError(
      "missing_token",
      "Configure TMDB in Settings or continue manually.",
    );
  const key = `${mediaType}:${id}`;
  const cached = readMetadataCache(key);
  if (cached) return cached;
  const revision = getTmdbSession().revision;
  const response = await tmdbGet(
    `/${mediaType}/${id}`,
    detailsSchema,
    {
      append_to_response:
        mediaType === "movie" ? "credits,external_ids" : "external_ids",
      language: "en-US",
    },
    signal,
  );
  if (response.id !== id)
    throw new TmdbError(
      "invalid_response",
      "TMDB returned information for a different title. Please try again.",
    );
  let result;
  try {
    result = mapDetails(response, mediaType);
  } catch {
    throw new TmdbError(
      "invalid_response",
      "Important title information is missing. Please enter this title manually.",
    );
  }
  if (revision === getTmdbSession().revision && !signal?.aborted)
    writeMetadataCache(key, result);
  return result;
}
export const getMovieDetails = (id: number, signal?: AbortSignal) =>
  getTitleDetails(id, "movie", signal);
export const getShowDetails = (id: number, signal?: AbortSignal) =>
  getTitleDetails(id, "tv", signal);

/** Called only when requested for one saved season; fetch before any local transaction. */
export async function getSeasonEpisodes(
  showId: number,
  seasonNumber: number,
  signal?: AbortSignal,
) {
  if (
    !Number.isSafeInteger(showId) ||
    showId < 1 ||
    !Number.isSafeInteger(seasonNumber) ||
    seasonNumber < 0
  )
    throw new TmdbError(
      "invalid_response",
      "Invalid show or season identifier.",
    );
  const response = await tmdbGet(
    `/tv/${showId}/season/${seasonNumber}`,
    z.object({
      season_number: z.number().int().nonnegative(),
      episodes: z.array(
        z.object({
          episode_number: z.number().int().positive(),
          name: z.string().nullable().optional(),
          runtime: z.number().finite().nonnegative().nullable().optional(),
          air_date: z.string().nullable().optional(),
        }),
      ),
    }),
    { language: "en-US" },
    signal,
  );
  if (response.season_number !== seasonNumber)
    throw new TmdbError(
      "invalid_response",
      "TMDB returned a different season.",
    );
  return response.episodes;
}
