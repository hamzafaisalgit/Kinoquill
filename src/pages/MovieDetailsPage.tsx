import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { libraryReturn } from "../utils/libraryState";
import {
  ArchiveRestore,
  ArrowLeft,
  Heart,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMovie } from "../hooks/useCatalog";
import { catalog } from "../services/catalog";
import { firstWatchedDate } from "../services/movieService";
import { EmptyState, LoadingState } from "../components/common/States";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { movieStatus } from "../utils/movieStatus";
import type { DateValue } from "../types/domain";
import "../styles/movies.css";

export default function MovieDetailsPage() {
  const location = useLocation();
  const { id = "" } = useParams();
  const query = useMovie(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function act(operation: "favorite" | "delete" | "restore") {
    if (!query.data || busy) return;
    setBusy(true);
    try {
      if (operation === "favorite")
        await catalog.movies.setFavorite(id, !query.data.entry.isFavorite);
      else if (operation === "restore") {
        await catalog.movies.restore(id);
        toast.success("Movie restored");
      } else {
        await catalog.movies.softDelete(id);
        setConfirmDelete(false);
        toast.success("Movie moved to Recently Deleted");
        navigate("/movies");
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.name === "ConflictError"
          ? error.message
          : "Your change could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading)
    return <LoadingState message="Opening your movie record…" />;
  if (query.error || !query.data)
    return (
      <section className="panel">
        <EmptyState
          icon={Star}
          title="This scene isn’t in your collection."
          description={
            query.error?.name === "RecordNotFoundError"
              ? query.error.message
              : "The movie is missing or local storage is unavailable. No records were changed."
          }
        >
          <Link className="button" to="/movies">
            <ArrowLeft size={15} />
            Back to movies
          </Link>
        </EmptyState>
      </section>
    );
  const { title, entry, genres, directors, categories } = query.data;
  const archived = entry.deletedAt !== null;
  return (
    <div className="movie-details-page">
      <div className="movie-details-nav">
        <Link
          className="text-link"
          to={libraryReturn(location.state, "/movies")}
        >
          <ArrowLeft size={14} />
          {location.state?.returnTo ? "Back to collection" : "Back to movies"}
        </Link>
        <span className="outline-pill">
          {archived ? "ARCHIVED RECORD" : "YOUR PERSONAL CINEMA"}
        </span>
      </div>
      {archived && (
        <div className="movie-archived-banner">
          <ArchiveRestore size={22} />
          <div>
            <strong>This movie is in Recently Deleted.</strong>
            <p>
              Its rating, review, categories, and viewing history are preserved.
              Restore it to return it to active collections.
            </p>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => void act("restore")}
          >
            Restore movie
          </button>
        </div>
      )}
      <section className="panel movie-detail-hero">
        {title.backdropPath && (
          <div className="movie-detail-backdrop">
            <PosterArtwork
              path={title.backdropPath}
              title={title.title}
              size="w1280"
              backdrop
              allowExternal
            />
          </div>
        )}
        <div className="movie-detail-hero-content">
          <div className="movie-detail-poster">
            <PosterArtwork
              path={title.posterPath}
              title={title.title}
              size="w500"
              allowExternal
            />
          </div>
          <div className="movie-detail-intro">
            <p className="eyebrow">A FILM IN YOUR COLLECTION</p>
            <h1>{title.title}</h1>
            {title.originalTitle && title.originalTitle !== title.title && (
              <p className="movie-original-title">{title.originalTitle}</p>
            )}
            <div className="metadata-line">
              <span>{title.releaseYear ?? "Year unknown"}</span>
              <span>
                {title.runtimeMinutes
                  ? `${title.runtimeMinutes} minutes`
                  : "Runtime unknown"}
              </span>
              <span>Movie</span>
            </div>
            <div className="metadata-genres">
              {genres.map((genre) => (
                <span className="outline-pill" key={genre.id}>
                  {genre.name}
                </span>
              ))}
              {!genres.length && (
                <span className="outline-pill">Genres need review</span>
              )}
            </div>
            <p className="movie-detail-directors">
              {directors.length ? (
                <>
                  Directed by{" "}
                  <strong>
                    {directors.map((person) => person.name).join(", ")}
                  </strong>
                </>
              ) : (
                "Director not entered"
              )}
            </p>
            <div className="movie-personal-score">
              <Star size={23} />
              <strong>
                {entry.personalRating ?? "—"}
                <small>
                  {entry.personalRating === null ? "Unrated" : "/ 10"}
                </small>
              </strong>
              <span>
                My personal rating
                <br />
                <small>{movieStatus(entry.status)}</small>
              </span>
              {entry.isFavorite && (
                <Heart className="accent" size={21} fill="currentColor" />
              )}
            </div>
            {!archived && (
              <div className="movie-detail-actions">
                <Link
                  className="button"
                  state={location.state}
                  to={`/movies/${id}/edit`}
                >
                  <Pencil size={15} />
                  Edit movie
                </Link>
                <button
                  className="secondary-button"
                  aria-pressed={entry.isFavorite}
                  disabled={busy}
                  onClick={() => void act("favorite")}
                >
                  <Heart
                    size={15}
                    fill={entry.isFavorite ? "currentColor" : "none"}
                  />
                  {entry.isFavorite ? "Unfavorite" : "Favorite"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  <Trash2 size={14} />
                  Delete movie
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="movie-details-columns">
        <section className="panel movie-written-record">
          <p className="eyebrow">THE STORY ON SCREEN</p>
          <h2>About the film</h2>
          <p className="movie-overview-copy">
            {title.overview ||
              "No overview has been recorded. You can add one while editing the movie."}
          </p>
          <dl className="metadata-facts">
            <div>
              <dt>Release date</dt>
              <dd>{title.releaseDate || "Unknown"}</dd>
            </div>
            <div>
              <dt>Original language</dt>
              <dd>{title.originalLanguage || "Unknown"}</dd>
            </div>
            <div>
              <dt>Production countries</dt>
              <dd>{title.countries.join(", ") || "Unknown"}</dd>
            </div>
            <div>
              <dt>Metadata source</dt>
              <dd>
                {title.metadataSource === "tmdb"
                  ? "TMDB · manually editable"
                  : title.metadataSource === "import"
                    ? "Historical import"
                    : "Manual entry"}
              </dd>
            </div>
            {title.tmdbId && (
              <div>
                <dt>TMDB</dt>
                <dd>
                  <a
                    className="text-link"
                    href={`https://www.themoviedb.org/movie/${title.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source ↗
                  </a>
                </dd>
              </div>
            )}
            {title.imdbId && (
              <div>
                <dt>IMDb ID</dt>
                <dd>{title.imdbId}</dd>
              </div>
            )}
          </dl>
        </section>
        <section className="panel movie-written-record">
          <p className="eyebrow">YOUR STORY WITH IT</p>
          <h2>The personal record</h2>
          <dl className="movie-record-facts">
            <div>
              <dt>Watch status</dt>
              <dd>{movieStatus(entry.status)}</dd>
            </div>
            <div>
              <dt>Date watched</dt>
              <dd>{displayWatchedDate(firstWatchedDate(query.data))}</dd>
            </div>
            <div>
              <dt>Favorite</dt>
              <dd>
                {entry.isFavorite
                  ? "Among your favorites"
                  : "Not marked as a favorite"}
              </dd>
            </div>
            <div>
              <dt>Personal categories</dt>
              <dd>
                {categories.length ? (
                  <div className="metadata-genres">
                    {categories.map((category) => (
                      <span className="outline-pill" key={category.id}>
                        {category.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  "No categories selected"
                )}
              </dd>
            </div>
          </dl>
          {entry.needsReview && (
            <div className="movie-review-note">
              <strong>Some history needs review.</strong>
              <p>{entry.reviewReasons.join(" ")}</p>
            </div>
          )}
        </section>
      </div>
      <section className="panel movie-written-record personal-review-section">
        <p className="eyebrow">A FEW WORDS THAT ARE YOURS</p>
        <h2>My review</h2>
        <p
          className={
            entry.personalReview
              ? "movie-personal-review"
              : "movie-empty-review"
          }
        >
          {entry.personalReview ||
            "No review yet. When you’re ready, add the moments, ideas, or feelings you want to remember."}
        </p>
        {!archived && (
          <Link
            className="text-link"
            state={location.state}
            to={`/movies/${id}/edit`}
          >
            <Pencil size={13} />
            {entry.personalReview ? "Edit my review" : "Write a review"}
          </Link>
        )}
      </section>
      {confirmDelete && (
        <DeleteMovieDialog
          title={title.title}
          busy={busy}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => void act("delete")}
        />
      )}
    </div>
  );
}
function DeleteMovieDialog({
  title,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="duplicate-dialog"
      aria-labelledby="delete-movie-heading"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
    >
      <Trash2 size={24} className="accent" />
      <p className="eyebrow">A RECOVERABLE GOODBYE</p>
      <h2 id="delete-movie-heading">Move “{title}” to Recently Deleted?</h2>
      <p>
        The movie will leave your active collection. Your rating, review,
        directors, categories, and viewing history will be kept. You can restore
        it from Movies. Nothing is permanently deleted.
      </p>
      <div className="dialog-actions">
        <button
          autoFocus
          className="secondary-button"
          disabled={busy}
          onClick={onClose}
        >
          Keep movie
        </button>
        <button className="button" disabled={busy} onClick={onConfirm}>
          {busy ? "Moving movie…" : "Move to Recently Deleted"}
        </button>
      </div>
    </dialog>
  );
}
function displayWatchedDate(date: DateValue) {
  return date.precision === "unknown"
    ? "Not recorded"
    : `${date.value}${date.precision === "year" ? " · year only" : date.precision === "month" ? " · month and year" : ""}`;
}
