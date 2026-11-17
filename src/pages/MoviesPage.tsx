import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Film,
  Heart,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useDeletedMovies, useLibrary } from "../hooks/useCatalog";
import { catalog } from "../services/catalog";
import { MovieCard } from "../components/movies/MovieCard";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../components/common/States";
import "../styles/movies.css";

export function MovieCollection({
  kind = "movies",
}: {
  kind?: "movies" | "favorites" | "watchlist";
}) {
  const [page, setPage] = useState(1);
  const result = useLibrary({
    ...(kind === "movies" ? { mediaType: "movie" as const } : {}),
    ...(kind === "favorites"
      ? { favorite: true }
      : kind === "watchlist"
        ? { status: "watchlist" as const }
        : {}),
    page,
    pageSize: 24,
    sort: "newest",
  });
  const title =
    kind === "favorites"
      ? "The ones that stay."
      : kind === "watchlist"
        ? "For another evening."
        : "Your kind of cinema.";
  return (
    <>
      <PageHeader
        eyebrow={
          kind === "movies"
            ? "THE FEATURE COLLECTION"
            : kind === "favorites"
              ? "YOUR PERSONAL CLASSICS"
              : "SO MANY STORIES AHEAD"
        }
        title={title}
        description={
          kind === "movies"
            ? "A growing archive of films, feelings, and first impressions."
            : kind === "favorites"
              ? "Your favorite movies and shows, kept in a place of their own."
              : "Movies and shows you’re looking forward to. Ready when you are."
        }
        action={
          <Link className="button" to="/movies/new">
            <Plus size={16} />
            Add movie
          </Link>
        }
      />
      <div className="movies-collection-toolbar">
        <span>
          {result.data
            ? `${result.data.total} ${kind === "movies" ? "movies" : "titles"} · stored on this device`
            : "Reading your local collection…"}
        </span>
        <Link className="text-link" to="/discover?type=movie">
          <Search size={14} />
          Discover on TMDB
        </Link>
      </div>
      {result.isLoading ? (
        <section className="panel movie-loading">
          <LoadingState message="Opening your movie collection…" />
        </section>
      ) : result.error ? (
        <section className="panel">
          <EmptyState
            icon={Film}
            title="Your collection couldn’t be opened."
            description={result.error.message}
          />
        </section>
      ) : result.data?.items.length ? (
        <>
          <section
            className="movie-grid"
            aria-label={`${kind} movie collection`}
          >
            {result.data.items.map((item) => (
              <MovieCard key={item.entry.id} item={item} />
            ))}
          </section>
          {result.data.totalPages > 1 && (
            <div className="movie-pagination">
              <button
                className="secondary-button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={14} />
                Previous
              </button>
              <span>
                Page {page} of {result.data.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={page >= result.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      ) : (
        <section className="panel movie-empty-collection">
          <EmptyState
            icon={kind === "favorites" ? Heart : Film}
            title={
              page > 1
                ? "No more movies on this page."
                : kind === "favorites"
                  ? "Keep the films you love close."
                  : kind === "watchlist"
                    ? "Your next movie starts here."
                    : "The opening scene is yours."
            }
            description={
              page > 1
                ? "Your collection changed. Return to its first page."
                : kind === "favorites"
                  ? "Mark a saved movie or show as a favorite and it will appear here."
                  : kind === "watchlist"
                    ? "Save a movie or show with Watchlist status to keep it for later."
                    : "Add a movie in your own words, or begin with metadata from TMDB."
            }
          >
            <div className="empty-state-actions">
              {page > 1 ? (
                <button className="button" onClick={() => setPage(1)}>
                  First page
                </button>
              ) : (
                <>
                  <Link className="button" to="/movies/new">
                    <Plus size={15} />
                    Add your first movie
                  </Link>
                  <Link className="secondary-button" to="/discover?type=movie">
                    Search TMDB
                  </Link>
                </>
              )}
            </div>
          </EmptyState>
        </section>
      )}
      {kind === "movies" && <RecentlyDeletedMovies />}
      {kind !== "movies" && (
        <p className="movies-footer-note">
          Movies and TV shows share this collection.{" "}
          <Link className="text-link" to="/shows/new">
            Add a TV show
          </Link>
        </p>
      )}
    </>
  );
}
function RecentlyDeletedMovies() {
  const deleted = useDeletedMovies();
  const [busy, setBusy] = useState<string | null>(null);
  async function restore(id: string) {
    setBusy(id);
    try {
      await catalog.movies.restore(id);
      toast.success("Movie restored to your collection");
    } catch (error) {
      toast.error(
        error instanceof Error && error.name === "ConflictError"
          ? error.message
          : "This movie could not be restored. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <details className="panel recently-deleted">
      <summary>
        <ArchiveRestore size={17} />
        <span>Recently Deleted</span>
        <small>{deleted.data?.length ?? "—"} movies · recoverable</small>
      </summary>
      <div>
        {deleted.isLoading ? (
          <LoadingState message="Checking archived movies…" />
        ) : deleted.error ? (
          <p className="field-error">Archived movies could not be loaded.</p>
        ) : !deleted.data?.length ? (
          <p>
            No archived movies. Deleting a movie keeps its personal record here
            for restoration.
          </p>
        ) : (
          deleted.data.map((item) => (
            <article key={item.entry.id}>
              <div>
                <Link to={`/movies/${item.title.id}`}>{item.title.title}</Link>
                <p>
                  {item.title.releaseYear ?? "Year unknown"} · rating, review,
                  and history preserved
                </p>
              </div>
              <button
                className="secondary-button"
                disabled={busy !== null}
                onClick={() => void restore(item.title.id)}
              >
                <ArchiveRestore size={14} />
                {busy === item.title.id ? "Restoring…" : "Restore"}
              </button>
            </article>
          ))
        )}
      </div>
    </details>
  );
}
export default function MoviesPage() {
  return <MovieCollection />;
}
