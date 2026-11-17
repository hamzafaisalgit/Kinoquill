import { useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { libraryReturn } from "../utils/libraryState";
import {
  ArrowLeft,
  Heart,
  Pencil,
  Archive,
  ArchiveRestore,
  Tv,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { useShowTracking } from "../hooks/useCatalog";
import { catalog } from "../services/catalog";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { EmptyState, LoadingState } from "../components/common/States";
import { ProgressIndicator } from "../components/shows/ProgressIndicator";
import { SeasonManager } from "../components/shows/SeasonManager";
import { movieStatus } from "../utils/movieStatus";
import type { DateValue } from "../types/domain";
import "../styles/shows.css";

export default function ShowDetailsPage() {
  const location = useLocation();
  const { id = "" } = useParams(),
    query = useShowTracking(id),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  async function action(
    operation: "favorite" | "archive" | "restore" | "specials",
    include = false,
  ) {
    if (!query.data || busy) return;
    if (
      operation === "archive" &&
      !window.confirm(
        `Archive “${query.data.title.title}”? It will leave active collections. Your rating, review, season ratings, and episode progress are preserved. Restore it from Archived shows.`,
      )
    )
      return;
    setBusy(true);
    setFailure(null);
    try {
      if (operation === "favorite")
        await catalog.shows.setFavorite(id, !query.data.entry.isFavorite);
      else if (operation === "specials")
        await catalog.shows.includeSpecials(id, include);
      else if (operation === "restore") {
        await catalog.shows.restore(id);
        toast.success("Show restored");
      } else {
        await catalog.shows.softDelete(id);
        toast.success("Show archived");
        navigate("/shows");
      }
    } catch {
      setFailure(
        "Your change could not be saved. No partial changes were committed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading)
    return <LoadingState message="Opening your series record…" />;
  if (query.error || !query.data)
    return (
      <section className="panel">
        <EmptyState
          icon={Tv}
          title="This show is not on this shelf."
          description={
            query.error?.name === "RecordNotFoundError"
              ? query.error.message
              : "The show is missing or local storage is unavailable."
          }
        >
          <Link className="button" to="/shows">
            Back to shows
          </Link>
        </EmptyState>
      </section>
    );
  const record = query.data,
    { title, entry, show, summary } = record,
    archived = entry.deletedAt !== null;
  const next = summary.next,
    nextSeason = next
      ? record.seasons.find((season) => season.id === next.seasonId)
      : null;
  return (
    <div className="movie-details-page tv-details-page">
      <div className="movie-details-nav">
        <Link
          className="text-link"
          to={libraryReturn(location.state, "/shows")}
        >
          <ArrowLeft size={14} />
          {location.state?.returnTo ? "Back to collection" : "Back to TV shows"}
        </Link>
        <span className="outline-pill">
          {archived ? "ARCHIVED SHOW" : "YOUR SERIES JOURNAL"}
        </span>
      </div>
      {archived && (
        <div className="movie-archived-banner">
          <ArchiveRestore />
          <div>
            <strong>This show is archived.</strong>
            <p>
              Its ratings, review, seasons, and episode progress are preserved.
            </p>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => void action("restore")}
          >
            Restore show
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
            <p className="eyebrow">EVERY CHAPTER, BEAUTIFULLY KEPT</p>
            <h1>{title.title}</h1>
            {title.originalTitle && title.originalTitle !== title.title && (
              <p className="movie-original-title">{title.originalTitle}</p>
            )}
            <div className="metadata-line">
              <span>{title.releaseYear ?? "Year unknown"}</span>
              <span>
                {title.mediaSubtype === "tv_miniseries"
                  ? "TV Mini Series"
                  : "TV Series"}
              </span>
              <span>
                {title.runtimeMinutes
                  ? `${title.runtimeMinutes} min / episode`
                  : "Runtime unknown"}
              </span>
            </div>
            <div className="metadata-genres">
              {record.genres.map((genre) => (
                <span className="outline-pill" key={genre.id}>
                  {genre.name}
                </span>
              ))}
            </div>
            <p className="movie-detail-directors">
              {record.directors.length
                ? `Created by ${record.directors.map((person) => person.name).join(", ")}`
                : "Creators not entered"}{" "}
              · {title.originalLanguage ?? "Language unknown"}
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
                My overall rating
                <br />
                <small>
                  {entry.status === "completed"
                    ? "Completed"
                    : movieStatus(entry.status)}
                </small>
              </span>
              {entry.isFavorite && (
                <Heart className="accent" fill="currentColor" />
              )}
            </div>
            {!archived && (
              <div className="movie-detail-actions">
                <Link
                  className="button"
                  state={location.state}
                  to={`/shows/${id}/edit`}
                >
                  <Pencil size={15} />
                  Edit show
                </Link>
                <button
                  className="secondary-button"
                  disabled={busy}
                  aria-pressed={entry.isFavorite}
                  onClick={() => void action("favorite")}
                >
                  <Heart
                    size={15}
                    fill={entry.isFavorite ? "currentColor" : "none"}
                  />
                  {entry.isFavorite ? "Unfavorite" : "Favorite"}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void action("archive")}
                >
                  <Archive size={14} />
                  Archive show
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      <section className="panel tv-overall-progress">
        <div className="section-label">
          <h2>Your story so far</h2>
          {!archived && (
            <Link
              className="text-link"
              to={nextSeason ? `#season-${nextSeason.id}` : "#seasons"}
            >
              {next && nextSeason
                ? `Continue · S${nextSeason.seasonNumber} E${next.episodeNumber}`
                : "Continue tracking"}
            </Link>
          )}
        </div>
        <ProgressIndicator summary={summary} />
        {!archived && (
          <label className="tv-specials-choice">
            <input
              type="checkbox"
              checked={show.includeSpecials}
              disabled={busy}
              onChange={(event) =>
                void action("specials", event.target.checked)
              }
            />
            Include Specials in overall progress
          </label>
        )}
        {summary.percentage === 100 && entry.status !== "completed" && (
          <p className="tv-status-note">
            All known episodes are recorded. Keep your current status, choose
            Caught Up, or explicitly complete this show in{" "}
            <Link state={location.state} to={`/shows/${id}/edit`}>
              Edit show
            </Link>
            . Future seasons may still arrive.
          </p>
        )}
        {entry.status === "completed" && summary.percentage !== 100 && (
          <p className="tv-status-note">
            You marked this show Completed. Its episode history is incomplete or
            new episodes are available; your status is preserved.{" "}
            <Link state={location.state} to={`/shows/${id}/edit`}>
              Review status
            </Link>
          </p>
        )}
      </section>
      <div className="movie-details-columns">
        <section className="panel movie-written-record">
          <p className="eyebrow">THE WORLD ON SCREEN</p>
          <h2>About the show</h2>
          <p className="movie-overview-copy">
            {title.overview ||
              "No overview recorded. You can add one while editing."}
          </p>
          <dl className="metadata-facts">
            <div>
              <dt>First air date</dt>
              <dd>{title.releaseDate ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Last air date</dt>
              <dd>{show.lastAirDate ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{title.originalLanguage ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Production countries</dt>
              <dd>{title.countries.join(", ") || "Unknown"}</dd>
            </div>
            <div>
              <dt>Seasons / regular episodes</dt>
              <dd>
                {show.totalSeasons ?? "Unknown"} /{" "}
                {show.totalEpisodes ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Metadata source</dt>
              <dd>{title.metadataSource}</dd>
            </div>
            {title.tmdbId && (
              <div>
                <dt>TMDB</dt>
                <dd>
                  <a
                    className="text-link"
                    href={`https://www.themoviedb.org/tv/${title.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
        <section className="panel movie-written-record">
          <p className="eyebrow">YOUR VIEWING RECORD</p>
          <h2>On your own terms</h2>
          <dl className="movie-record-facts">
            <div>
              <dt>Watch status</dt>
              <dd>
                {entry.status === "completed"
                  ? "Completed"
                  : movieStatus(entry.status)}{" "}
                {!archived && (
                  <Link
                    className="text-link"
                    state={location.state}
                    to={`/shows/${id}/edit`}
                  >
                    Update status
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt>Date started</dt>
              <dd>{dateLabel(entry.startedAt)}</dd>
            </div>
            <div>
              <dt>Date completed</dt>
              <dd>{dateLabel(entry.completedAt)}</dd>
            </div>
            <div>
              <dt>Personal categories</dt>
              <dd>
                {record.categories
                  .map((category) => category.name)
                  .join(", ") || "No categories selected"}
              </dd>
            </div>
          </dl>
          {entry.needsReview && (
            <p className="movie-review-note">
              Needs review: {entry.reviewReasons.join(" ")}
            </p>
          )}
        </section>
      </div>
      {!archived && <SeasonManager record={record} />}
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
            "No review yet. Keep the moments and characters you want to remember."}
        </p>
        {!archived && (
          <Link
            className="text-link"
            state={location.state}
            to={`/shows/${id}/edit`}
          >
            Edit my review
          </Link>
        )}
      </section>
    </div>
  );
}
function dateLabel(date: DateValue) {
  return date.precision === "unknown"
    ? "Not recorded"
    : `${date.value}${date.precision === "day" ? "" : ` · ${date.precision} only`}`;
}
