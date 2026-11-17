import { z } from "zod";
import { titleCreateSchema, validate } from "../../utils/validation";
import { isCalendarDate } from "../../utils/dates";
import type { MediaType } from "../../types/domain";
import type { DiscoveryMetadata, SearchResult } from "./types";

const optionalText = z.string().nullable().optional();
const optionalNumber = z.number().finite().nullable().optional();
const person = z.object({ name: z.string(), job: z.string().optional() });
export const resultSchema = z.object({
  id: z.number().int().positive(),
  media_type: z.string().optional(),
  title: optionalText,
  name: optionalText,
  release_date: optionalText,
  first_air_date: optionalText,
  overview: optionalText,
  poster_path: optionalText,
  vote_average: optionalNumber,
});
export const detailsSchema = z.object({
  id: z.number().int().positive(),
  title: optionalText,
  name: optionalText,
  original_title: optionalText,
  original_name: optionalText,
  release_date: optionalText,
  first_air_date: optionalText,
  last_air_date: optionalText,
  runtime: optionalNumber,
  episode_run_time: z.array(z.number()).optional(),
  type: optionalText,
  status: optionalText,
  genres: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
  overview: optionalText,
  poster_path: optionalText,
  backdrop_path: optionalText,
  original_language: optionalText,
  production_countries: z
    .array(
      z.object({
        iso_3166_1: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  imdb_id: optionalText,
  external_ids: z.object({ imdb_id: optionalText }).optional(),
  credits: z.object({ crew: z.array(person).optional() }).optional(),
  created_by: z.array(person).optional(),
  vote_average: optionalNumber,
  number_of_seasons: optionalNumber,
  number_of_episodes: optionalNumber,
  seasons: z
    .array(
      z.object({
        season_number: z.number().int().nonnegative(),
        name: z.string(),
        episode_count: optionalNumber,
        air_date: optionalText,
      }),
    )
    .optional(),
});
export type TmdbDetails = z.infer<typeof detailsSchema>;
const calendar = (value: string | null | undefined) =>
  value && isCalendarDate(value) ? value : null;
const positive = (value: number | null | undefined) =>
  value !== undefined && value !== null && value > 0 ? value : null;
const count = (value: number | null | undefined) =>
  value !== undefined && value !== null && Number.isInteger(value) && value >= 0
    ? value
    : null;
const community = (value: number | null | undefined) =>
  value !== undefined && value !== null && value > 0 && value <= 10
    ? value
    : null;

export function mapSearchResult(
  value: unknown,
  fixedType?: MediaType,
): SearchResult | null {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  const mediaType = fixedType ?? data.media_type;
  if (mediaType !== "movie" && mediaType !== "tv") return null;
  const title = (mediaType === "movie" ? data.title : data.name)?.trim();
  if (!title) return null;
  const date = calendar(
    mediaType === "movie" ? data.release_date : data.first_air_date,
  );
  return {
    id: data.id,
    mediaType,
    title,
    releaseYear: date ? Number(date.slice(0, 4)) : null,
    overview: data.overview || null,
    posterPath: data.poster_path ?? null,
    communityRating: community(data.vote_average),
  };
}

export function mapDetails(
  data: TmdbDetails,
  mediaType: MediaType,
): DiscoveryMetadata {
  const releaseDate = calendar(
    mediaType === "movie" ? data.release_date : data.first_air_date,
  );
  const imdb = data.imdb_id || data.external_ids?.imdb_id;
  const metadata = validate(titleCreateSchema, {
    title: (mediaType === "movie" ? data.title : data.name) ?? "",
    mediaType,
    mediaSubtype:
      mediaType === "movie"
        ? "movie"
        : data.type === "Miniseries"
          ? "tv_miniseries"
          : "tv_series",
    originalTitle:
      (mediaType === "movie" ? data.original_title : data.original_name) ||
      null,
    releaseDate,
    releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    // A typical episode runtime is display metadata, not watched duration.
    runtimeMinutes:
      mediaType === "movie"
        ? positive(data.runtime)
        : positive(data.episode_run_time?.find((value) => value > 0)),
    overview: data.overview || null,
    originalLanguage: data.original_language || null,
    countries: (data.production_countries ?? [])
      .map((country) => country.iso_3166_1 || country.name || "")
      .filter(Boolean),
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    tmdbId: data.id,
    imdbId: imdb && /^tt\d+$/.test(imdb) ? imdb : null,
    metadataSource: "tmdb",
    metadataLastSyncedAt: new Date().toISOString(),
  });
  const suggestions =
    mediaType === "movie"
      ? (data.credits?.crew ?? [])
          .filter((person) => person.job === "Director")
          .map((person) => ({
            name: person.name.trim(),
            role: "director" as const,
          }))
      : (data.created_by ?? []).map((person) => ({
          name: person.name.trim(),
          role: "creator" as const,
        }));
  return {
    metadata,
    genres: [
      ...new Set(
        (data.genres ?? []).map((genre) => genre.name.trim()).filter(Boolean),
      ),
    ],
    suggestions: suggestions.filter((person) => person.name),
    communityRating: community(data.vote_average),
    lastAirDate: calendar(data.last_air_date),
    productionStatus: data.status ?? null,
    seasonCount: count(data.number_of_seasons),
    episodeCount: count(data.number_of_episodes),
    seasons: (data.seasons ?? []).map((season) => ({
      number: season.season_number,
      name: season.name,
      episodeCount: count(season.episode_count),
      airDate: calendar(season.air_date),
    })),
  };
}
