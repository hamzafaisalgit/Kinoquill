import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Tv } from "lucide-react";
import { toast } from "sonner";
import { useCatalogQuery, useLibrary } from "../hooks/useCatalog";
import { catalog } from "../services/catalog";
import { MovieCard } from "../components/movies/MovieCard";
import { ContinueWatching } from "../components/shows/ContinueWatching";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../components/common/States";
import "../styles/shows.css";
export default function ShowsPage() {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const result = useLibrary({
    mediaType: "tv",
    page,
    pageSize: 24,
    sort: "newest",
  });
  const archived = useCatalogQuery(() => catalog.shows.listDeleted(), []);
  return (
    <>
      <PageHeader
        eyebrow="THE SERIES COLLECTION"
        title="Stories that stay awhile."
        description="Your series, miniseries, and all the chapters in between."
        action={
          <Link className="button" to="/shows/new">
            <Plus size={15} />
            Add TV show
          </Link>
        }
      />
      <ContinueWatching />
      <div className="section-label">
        <h2>My TV Shows</h2>
        <span>{result.data?.total ?? "…"} shows · on this device</span>
      </div>
      {result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <p role="alert" className="field-error">
          {result.error.message}
        </p>
      ) : !result.data?.items.length ? (
        <section className="panel">
          <EmptyState
            icon={Tv}
            title={
              page > 1
                ? "No more shows on this page."
                : "Your first episode starts here."
            }
            description="Add a show from TMDB or enter it manually. No episode information is required."
          >
            {page > 1 ? (
              <button className="button" onClick={() => setPage(1)}>
                First page
              </button>
            ) : (
              <Link className="button" to="/shows/new">
                Add TV show
              </Link>
            )}
          </EmptyState>
        </section>
      ) : (
        <section className="movie-grid">
          {result.data.items.map((item) => (
            <MovieCard key={item.entry.id} item={item} />
          ))}
        </section>
      )}
      {result.data && result.data.totalPages > 1 && (
        <div className="movie-pagination">
          <button
            className="secondary-button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
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
          </button>
        </div>
      )}
      <details className="panel recently-deleted">
        <summary>
          Archived shows{" "}
          <small>{archived.data?.length ?? "…"} recoverable</small>
        </summary>
        {archived.error ? (
          <p className="field-error">Archived shows could not be loaded.</p>
        ) : archived.data?.length ? (
          archived.data.map((item) => (
            <article key={item.entry.id}>
              <Link to={`/shows/${item.title.id}`}>{item.title.title}</Link>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await catalog.shows.restore(item.title.id);
                    toast.success("Show restored");
                  } catch {
                    toast.error(
                      "Show could not be restored. Please try again.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore
              </button>
            </article>
          ))
        ) : (
          <p>
            No archived shows. Ratings, reviews, and progress are preserved when
            archiving.
          </p>
        )}
      </details>
    </>
  );
}
