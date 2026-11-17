import { useCallback, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useNavigate,
} from "react-router-dom";
import { ArrowLeft, Check, Heart, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { TitleDraft } from "../../services/tmdb/types";
import type { MovieRecord } from "../../services/movieService";
import type { ShowMetadata } from "../../types/domain";
import { catalog } from "../../services/catalog";
import { clearTitleDraft } from "../../services/titleDraft";
import { initialMovieValues, movieFormResolver } from "../../utils/movieForm";
import type { MovieFormValues } from "../../utils/movieForm";
import { useCategories, useGenres, usePeople } from "../../hooks/useCatalog";
import { DuplicateTitleError } from "../../utils/errors";
import { normalizeName } from "../../utils/normalization";
import { PosterArtwork } from "../discovery/PosterArtwork";
import { DuplicateReview } from "../discovery/DuplicateReview";
import { PageHeader } from "../common/States";
import {
  DateWatchedInput,
  DirectorInput,
  NameMultiSelect,
  RatingInput,
} from "./MovieControls";
import { MOVIE_STATUSES } from "../../utils/movieStatus";
import { LeaveMovieDialog } from "./LeaveMovieDialog";
import "../../styles/movies.css";

export function MovieForm({
  movie,
  draft,
  mediaType = "movie",
}: {
  movie?: MovieRecord & { show?: ShowMetadata };
  draft?: TitleDraft;
  mediaType?: "movie" | "tv";
}) {
  const isShow = mediaType === "tv";
  const base = isShow ? "/shows" : "/movies";
  const noun = isShow ? "show" : "movie";
  const navigate = useNavigate();
  const genres = useGenres(),
    categories = useCategories(),
    people = usePeople();
  const [defaults] = useState(() =>
    initialMovieValues(movie, draft, mediaType),
  );
  const saved = useRef(false);
  const saving = useRef(false);
  const [duplicates, setDuplicates] = useState<DuplicateTitleError | null>(
    null,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<MovieFormValues>({
    defaultValues: defaults,
    resolver: movieFormResolver(movie),
    mode: "onSubmit",
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = form;
  const title = useWatch({ control, name: "metadata.title" });
  const poster = useWatch({ control, name: "metadata.posterPath" });
  const status = useWatch({ control, name: "library.status" });
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty &&
        !saved.current &&
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search),
      [isDirty],
    ),
  );
  useBeforeUnload(
    useCallback(
      (event) => {
        if (isDirty && !saved.current) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [isDirty],
    ),
  );
  const numeric = (value: string | number | null | undefined) =>
    value == null || value === "" ? null : Number(value);
  const nullable = (value: string | null | undefined) => value?.trim() || null;

  async function save(values: MovieFormValues, confirmed = false) {
    if (saving.current) return;
    saving.current = true;
    setFailure(null);
    setDuplicates(null);
    try {
      const input = {
        ...values,
        metadata: {
          ...values.metadata,
          countries: values.countriesText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        dateChanged:
          JSON.stringify(values.watchedDate) !==
          JSON.stringify(defaults.watchedDate),
      };
      const confirmedDraft =
        draft?.confirmedPossibleDuplicate === true &&
        normalizeName(values.metadata.title) ===
          normalizeName(draft.metadata.title) &&
        (values.metadata.releaseYear ?? null) ===
          (draft.metadata.releaseYear ?? null) &&
        (values.metadata.tmdbId ?? null) === (draft.metadata.tmdbId ?? null) &&
        (values.metadata.imdbId ?? null) === (draft.metadata.imdbId ?? null);
      const saveTitle = isShow
        ? catalog.shows.saveShow.bind(catalog.shows)
        : catalog.movies.saveMovie.bind(catalog.movies);
      const result = await saveTitle(
        {
          ...input,
          ...(isShow && !movie ? { seasons: draft?.tv?.seasons } : {}),
        },
        movie
          ? {
              titleId: movie.title.id,
              titleRevision: movie.title.revision,
              entryRevision: movie.entry.revision,
            }
          : undefined,
        confirmed || confirmedDraft,
      );
      saved.current = true;
      reset(values);
      if (draft) clearTitleDraft();
      toast.success(
        movie
          ? `${isShow ? "Show" : "Movie"} updated`
          : `${isShow ? "Show" : "Movie"} added to your collection`,
      );
      navigate(`${base}/${result.title.id}`, { replace: true });
    } catch (error) {
      if (error instanceof DuplicateTitleError) setDuplicates(error);
      else
        setFailure(
          error instanceof Error &&
            [
              "ValidationError",
              "ConflictError",
              "StorageUnavailableError",
              "RecordNotFoundError",
            ].includes(error.name)
            ? error.message
            : `The ${noun} could not be saved. Your entered values are still here. Check browser storage and try again.`,
        );
    } finally {
      saving.current = false;
    }
  }
  return (
    <>
      <PageHeader
        eyebrow={
          movie ? "A STORY, REVISITED" : "A NEW CHAPTER IN YOUR COLLECTION"
        }
        title={
          movie
            ? "Refine your record."
            : isShow
              ? "A story with more chapters."
              : "Make room for a great film."
        }
        description={
          movie
            ? `Your ${noun}, your perspective. Every detail stays in your control.`
            : "Just a title, genre, and status to begin. The rest is yours to add."
        }
        action={
          <Link
            className="secondary-button"
            to={movie ? `${base}/${movie.title.id}` : base}
          >
            <ArrowLeft size={14} />
            {movie ? `Back to ${noun}` : `Back to ${noun}s`}
          </Link>
        }
      />
      <form
        className="movie-form"
        onSubmit={(event) => {
          void handleSubmit((values) => save(values))(event);
        }}
        noValidate
      >
        <div className="movie-form-main">
          <section className="panel movie-form-section">
            <div className="movie-section-heading">
              <span>01</span>
              <div>
                <h2>{isShow ? "The show" : "The movie"}</h2>
                <p>Official details, with room for your own corrections.</p>
              </div>
              <span className="outline-pill">{isShow ? "TV" : "MOVIE"}</span>
            </div>
            <div className="movie-basics">
              <div className="form-poster">
                <PosterArtwork
                  path={poster}
                  title={title || "Your movie"}
                  allowExternal
                />
                <span>
                  {draft?.source === "tmdb"
                    ? "From your TMDB selection"
                    : movie
                      ? "Your saved artwork"
                      : "A poster is optional"}
                </span>
              </div>
              <div className="movie-basic-fields">
                <label>
                  {isShow ? "Show title" : "Movie title"}{" "}
                  <span className="required-note">Required</span>
                  <input
                    autoFocus
                    {...register("metadata.title")}
                    placeholder="The name of a film worth keeping"
                    aria-invalid={!!errors.metadata?.title}
                  />
                  {errors.metadata?.title && (
                    <small role="alert" className="movie-field-error">
                      {errors.metadata.title.message}
                    </small>
                  )}
                </label>
                <div className="movie-two-fields">
                  <label>
                    Release year
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      placeholder="Unknown"
                      {...register("metadata.releaseYear", {
                        setValueAs: numeric,
                      })}
                    />
                    {errors.metadata?.releaseYear && (
                      <small className="movie-field-error" role="alert">
                        {errors.metadata.releaseYear.message}
                      </small>
                    )}
                  </label>
                  <label>
                    {isShow ? "Typical episode · minutes" : "Runtime · minutes"}
                    <input
                      type="number"
                      min="1"
                      placeholder="Unknown"
                      {...register("metadata.runtimeMinutes", {
                        setValueAs: numeric,
                      })}
                    />
                    {errors.metadata?.runtimeMinutes && (
                      <small className="movie-field-error" role="alert">
                        {errors.metadata.runtimeMinutes.message}
                      </small>
                    )}
                  </label>
                </div>
                <p className="preference-note">
                  Title, at least one genre, and a watch status are required. A
                  personal rating is required for{" "}
                  {isShow ? "Completed" : "Watched"}.
                </p>
              </div>
            </div>
            {isShow && (
              <label>
                Show type
                <select {...register("metadata.mediaSubtype")}>
                  <option value="tv_series">TV Series</option>
                  <option value="tv_miniseries">TV Mini Series</option>
                </select>
              </label>
            )}
            <Controller
              control={control}
              name="genreNames"
              render={({ field }) => (
                <NameMultiSelect
                  label="Genres"
                  options={(genres.data ?? []).map((genre) => genre.name)}
                  value={field.value}
                  onChange={field.onChange}
                  loading={genres.isLoading}
                  error={errors.genreNames?.message}
                />
              )}
            />
            {genres.error && (
              <p className="movie-field-error">
                The local genre catalog could not be loaded. Retry after
                checking local storage.
              </p>
            )}
            <Controller
              control={control}
              name="directors"
              render={({ field }) => (
                <DirectorInput
                  label={isShow ? "Creators / Directors" : "Directors"}
                  options={people.data ?? []}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {people.error && (
              <p className="preference-note">
                Existing people could not be loaded; new director names remain
                available.
              </p>
            )}
            <details className="movie-more-details">
              <summary>
                More {noun} information{" "}
                <span>Release, language, artwork & external IDs</span>
              </summary>
              <div className="metadata-form-grid">
                <label className="wide-field">
                  Original title
                  <input
                    {...register("metadata.originalTitle", {
                      setValueAs: nullable,
                    })}
                  />
                </label>
                <label>
                  {isShow ? "First air date" : "Release date"}
                  <input
                    type="date"
                    {...register("metadata.releaseDate", {
                      setValueAs: nullable,
                    })}
                  />
                  {errors.metadata?.releaseDate && (
                    <small className="movie-field-error" role="alert">
                      {errors.metadata.releaseDate.message}
                    </small>
                  )}
                </label>
                <label>
                  Original language
                  <input
                    {...register("metadata.originalLanguage", {
                      setValueAs: nullable,
                    })}
                    placeholder="e.g. en or English"
                  />
                </label>
                <label className="wide-field">
                  Production countries
                  <input
                    {...register("countriesText")}
                    placeholder="Separate countries with commas"
                  />
                </label>
                <label className="wide-field">
                  Overview
                  <textarea
                    rows={5}
                    {...register("metadata.overview", { setValueAs: nullable })}
                    placeholder="About the film — separate from your personal review"
                  />
                </label>
                <label className="wide-field">
                  Poster path or HTTPS image URL
                  <input
                    {...register("metadata.posterPath", {
                      setValueAs: nullable,
                    })}
                    placeholder="Optional · no image file is uploaded"
                  />
                  {errors.metadata?.posterPath && (
                    <small role="alert" className="movie-field-error">
                      {errors.metadata.posterPath.message}
                    </small>
                  )}
                </label>
                <label className="wide-field">
                  Backdrop path or HTTPS image URL
                  <input
                    {...register("metadata.backdropPath", {
                      setValueAs: nullable,
                    })}
                  />
                  {errors.metadata?.backdropPath && (
                    <small role="alert" className="movie-field-error">
                      {errors.metadata.backdropPath.message}
                    </small>
                  )}
                  <span className="preference-note">
                    External images load from the address you supply. Artwork
                    may need internet access.
                  </span>
                </label>
                <label>
                  TMDB ID
                  <input
                    type="number"
                    min="1"
                    {...register("metadata.tmdbId", { setValueAs: numeric })}
                  />
                  {errors.metadata?.tmdbId && (
                    <small role="alert" className="movie-field-error">
                      {errors.metadata.tmdbId.message}
                    </small>
                  )}
                </label>
                <label>
                  IMDb ID
                  <input
                    {...register("metadata.imdbId", { setValueAs: nullable })}
                    placeholder="tt…"
                  />
                  {errors.metadata?.imdbId && (
                    <small role="alert" className="movie-field-error">
                      {errors.metadata.imdbId.message}
                    </small>
                  )}
                </label>
              </div>
            </details>
            {isShow && (
              <div className="tv-show-metadata movie-two-fields">
                <label>
                  Last air date
                  <input
                    type="date"
                    {...register("show.lastAirDate", { setValueAs: nullable })}
                  />
                  {errors.show?.lastAirDate && (
                    <small role="alert" className="movie-field-error">
                      {errors.show.lastAirDate.message}
                    </small>
                  )}
                </label>
                <label>
                  Total seasons
                  <input
                    type="number"
                    min="0"
                    {...register("show.totalSeasons", { setValueAs: numeric })}
                  />
                  {errors.show?.totalSeasons && (
                    <small role="alert" className="movie-field-error">
                      {errors.show.totalSeasons.message}
                    </small>
                  )}
                </label>
                <label>
                  Total regular episodes
                  <input
                    type="number"
                    min="0"
                    {...register("show.totalEpisodes", { setValueAs: numeric })}
                  />
                  {errors.show?.totalEpisodes && (
                    <small role="alert" className="movie-field-error">
                      {errors.show.totalEpisodes.message}
                    </small>
                  )}
                </label>
                <p className="preference-note">
                  Seasons and episode details are optional. You can add them
                  after saving.{" "}
                  {draft?.tv?.seasons.length
                    ? `${draft.tv.seasons.length} season summaries will be saved.`
                    : ""}
                </p>
              </div>
            )}
          </section>
        </div>
        <div className="movie-form-personal">
          <section className="panel movie-form-section personal-form-section">
            <div className="movie-section-heading">
              <span>02</span>
              <div>
                <h2>Your perspective</h2>
                <p>The part of the story only you can write.</p>
              </div>
            </div>
            <label>
              Watch status <span className="required-note">Required</span>
              <select {...register("library.status")}>
                {MOVIE_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isShow && option.value === "completed"
                      ? "Completed"
                      : option.label}
                  </option>
                ))}
                {movie?.entry.status === "unknown" && (
                  <option value="unknown">Unknown · historical record</option>
                )}
                {(isShow || movie?.entry.status === "caught_up") && (
                  <option value="caught_up">Caught Up</option>
                )}
              </select>
              {errors.library?.status && (
                <small className="movie-field-error" role="alert">
                  {errors.library.status.message}
                </small>
              )}
            </label>
            <Controller
              control={control}
              name="library.personalRating"
              render={({ field }) => (
                <RatingInput
                  value={field.value ?? null}
                  onChange={field.onChange}
                  required={status === "completed"}
                  historical={
                    movie?.entry.ratingPolicy === "historical" &&
                    field.value === movie.entry.personalRating
                  }
                  error={errors.library?.personalRating?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="library.isFavorite"
              render={({ field }) => (
                <label
                  className={`movie-favorite-control ${field.value ? "is-favorite" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                  />
                  <Heart
                    size={19}
                    fill={field.value ? "currentColor" : "none"}
                  />
                  <span>
                    A place among my favorites
                    <small>Kept separately from your categories.</small>
                  </span>
                  <Check size={17} />
                </label>
              )}
            />
            {isShow ? (
              <>
                <Controller
                  control={control}
                  name="library.startedAt"
                  render={({ field }) => (
                    <DateWatchedInput
                      value={
                        field.value ?? { precision: "unknown", value: null }
                      }
                      onChange={field.onChange}
                      label="Date started"
                      error={errors.library?.startedAt?.value?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="library.completedAt"
                  render={({ field }) => (
                    <DateWatchedInput
                      value={
                        field.value ?? { precision: "unknown", value: null }
                      }
                      onChange={field.onChange}
                      label="Date completed"
                      error={errors.library?.completedAt?.value?.message}
                    />
                  )}
                />
              </>
            ) : (
              <Controller
                control={control}
                name="watchedDate"
                render={({ field }) => (
                  <DateWatchedInput
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.watchedDate?.value?.message}
                  />
                )}
              />
            )}
            <Controller
              control={control}
              name="categoryNames"
              render={({ field }) => (
                <NameMultiSelect
                  label="Categories"
                  options={(categories.data ?? []).map(
                    (category) => category.name,
                  )}
                  value={field.value}
                  onChange={field.onChange}
                  loading={categories.isLoading}
                />
              )}
            />
            {categories.error && (
              <p className="preference-note">
                The category catalog is unavailable; selected names are
                retained.
              </p>
            )}
            <label className="movie-review-label">
              My review <span className="optional-note">Optional</span>
              <textarea
                rows={7}
                {...register("library.personalReview", {
                  setValueAs: nullable,
                })}
                placeholder="What stayed with you? Your thoughts belong here."
              />
              <span className="preference-note">
                Personal, multiline, and stored only on this device.
              </span>
            </label>
          </section>
        </div>
        {failure && (
          <p className="field-error movie-save-error" role="alert">
            {failure}
          </p>
        )}
        <div className="movie-form-actions">
          <p>
            <ShieldCheck size={15} />
            <span>
              {isDirty
                ? "Unsaved changes · stored locally only after saving"
                : "Your data stays in this browser on this device."}
            </span>
          </p>
          <Link
            className="secondary-button"
            to={movie ? `${base}/${movie.title.id}` : base}
          >
            Cancel
          </Link>
          <button className="button" type="submit" disabled={isSubmitting}>
            <Save size={15} />
            {isSubmitting
              ? `Saving your ${noun}…`
              : movie
                ? "Save changes"
                : `Save ${noun}`}
          </button>
        </div>
      </form>
      {blocker.state === "blocked" && <LeaveMovieDialog blocker={blocker} />}
      {duplicates && (
        <DuplicateReview
          matches={duplicates.matches}
          title={title}
          onClose={() => setDuplicates(null)}
          onContinue={() => void handleSubmit((values) => save(values, true))()}
        />
      )}
    </>
  );
}
