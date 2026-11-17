import type { Resolver, FieldErrors } from "react-hook-form";
import type { MovieRecord, MovieSaveInput } from "../services/movieService";
import { firstWatchedDate, metadataFromTitle } from "../services/movieService";
import type { TitleDraft } from "../services/tmdb/types";
import {
  dateSchema,
  libraryCreateSchema,
  titleCreateSchema,
  validateLibraryEdit,
} from "./validation";
import { UNKNOWN_DATE } from "./dates";
import { movieImage } from "./movieImages";
import type { ShowMetadata } from "../types/domain";
import { showMetadataSchema } from "../services/showService";

export interface MovieFormValues extends MovieSaveInput {
  countriesText: string;
  show: Omit<ShowMetadata, "titleId">;
}
export function initialMovieValues(
  movie?: MovieRecord & { show?: ShowMetadata },
  draft?: TitleDraft,
  mediaType: "movie" | "tv" = "movie",
): MovieFormValues {
  const metadata = movie
    ? metadataFromTitle(movie.title)
    : (draft?.metadata ?? {
        title: "",
        mediaType: "movie",
        mediaSubtype: "movie",
      });
  return {
    metadata: {
      ...metadata,
      mediaType,
      mediaSubtype:
        mediaType === "movie"
          ? "movie"
          : metadata.mediaSubtype === "tv_miniseries"
            ? "tv_miniseries"
            : "tv_series",
    },
    library: movie
      ? {
          status: movie.entry.status,
          personalRating: movie.entry.personalRating,
          personalReview: movie.entry.personalReview,
          isFavorite: movie.entry.isFavorite,
          startedAt: movie.entry.startedAt,
          completedAt: movie.entry.completedAt,
        }
      : {
          status: "watchlist",
          personalRating: null,
          personalReview: null,
          isFavorite: false,
          startedAt: UNKNOWN_DATE,
          completedAt: UNKNOWN_DATE,
        },
    genreNames: movie?.genres.map((genre) => genre.name) ?? draft?.genres ?? [],
    directors:
      movie?.directors.map((person) => ({
        id: person.id,
        name: person.name,
      })) ??
      draft?.people
        .filter(
          (person) =>
            person.role === (mediaType === "tv" ? "creator" : "director"),
        )
        .map((person) => ({ name: person.name })) ??
      [],
    categoryNames: movie?.categories.map((category) => category.name) ?? [],
    watchedDate: movie ? firstWatchedDate(movie) : UNKNOWN_DATE,
    dateChanged: false,
    countriesText: metadata.countries?.join(", ") ?? "",
    show: {
      lastAirDate: movie?.show?.lastAirDate ?? draft?.tv?.lastAirDate ?? null,
      totalSeasons: movie?.show?.totalSeasons ?? draft?.tv?.seasonCount ?? null,
      totalEpisodes:
        movie?.show?.totalEpisodes ?? draft?.tv?.episodeCount ?? null,
      includeSpecials: movie?.show?.includeSpecials ?? false,
    },
  };
}
export const movieFormResolver =
  (movie?: MovieRecord): Resolver<MovieFormValues> =>
  async (values) => {
    const errors: Record<string, unknown> = {};
    function error(path: string, message: string) {
      const parts = path.split(".");
      let target = errors;
      for (const part of parts.slice(0, -1)) {
        target[part] ??= {};
        target = target[part] as Record<string, unknown>;
      }
      target[parts.at(-1)!] = { type: "validate", message };
    }
    const metadata = titleCreateSchema.safeParse({
      ...values.metadata,
      countries: values.countriesText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    if (!metadata.success)
      metadata.error.issues.forEach((issue) =>
        error(`metadata.${issue.path.join(".")}`, issue.message),
      );
    for (const key of ["posterPath", "backdropPath"] as const)
      if (values.metadata[key] && !movieImage(values.metadata[key]))
        error(
          `metadata.${key}`,
          "Use a TMDB image path or a valid HTTPS image URL.",
        );
    if (
      !values.genreNames.length &&
      !(movie?.entry.ratingPolicy === "historical" && !movie.genres.length)
    )
      error("genreNames", "Please select at least one genre.");
    if (movie) {
      try {
        validateLibraryEdit(movie.entry, values.library);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Please check your personal information.";
        error(
          /rating/i.test(message) ? "library.personalRating" : "library.status",
          message,
        );
      }
    } else {
      const library = libraryCreateSchema.safeParse(values.library);
      if (!library.success)
        library.error.issues.forEach((issue) =>
          error(
            `library.${issue.path.join(".")}${issue.path.length === 1 && ["startedAt", "completedAt"].includes(String(issue.path[0])) ? ".value" : ""}`,
            issue.message,
          ),
        );
    }
    const date = dateSchema.safeParse(values.watchedDate);
    if (!date.success)
      error(
        "watchedDate.value",
        "Please provide a valid viewing date, or choose Unknown.",
      );
    if (values.metadata.mediaType === "tv") {
      const show = showMetadataSchema.safeParse(values.show);
      if (!show.success)
        show.error.issues.forEach((issue) =>
          error(`show.${issue.path.join(".")}`, issue.message),
        );
      for (const key of ["startedAt", "completedAt"] as const)
        if (!dateSchema.safeParse(values.library[key]).success)
          error(
            `library.${key}.value`,
            "Enter a valid date or choose Unknown.",
          );
    }
    return Object.keys(errors).length
      ? { values: {}, errors: errors as FieldErrors<MovieFormValues> }
      : { values, errors: {} };
  };
