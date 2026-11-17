import { useState } from "react";
import { Link } from "react-router-dom";
import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { catalog } from "../../services/catalog";
import { useCatalogQuery } from "../../hooks/useCatalog";
export function ArchivedCollection({
  mediaType,
}: {
  mediaType: "movie" | "tv";
}) {
  const result = useCatalogQuery(
      () =>
        mediaType === "movie"
          ? catalog.movies.listDeletedMovies()
          : catalog.shows.listDeleted(),
      [mediaType],
    ),
    [busy, setBusy] = useState(false);
  return (
    <details className="panel recently-deleted">
      <summary>
        <ArchiveRestore size={16} />
        {mediaType === "movie" ? "Recently Deleted" : "Archived shows"}{" "}
        <small>{result.data?.length ?? "…"} recoverable</small>
      </summary>
      {result.isLoading ? (
        <p>Reading archived records…</p>
      ) : result.error ? (
        <p className="field-error">Archived records could not be opened.</p>
      ) : !result.data?.length ? (
        <p>
          No archived records. Archiving preserves ratings, reviews, categories,
          viewing history, and TV progress.
        </p>
      ) : (
        result.data.map((item) => (
          <article key={item.entry.id}>
            <Link
              to={`/${mediaType === "movie" ? "movies" : "shows"}/${item.title.id}`}
            >
              {item.title.title}
            </Link>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await (
                    mediaType === "movie" ? catalog.movies : catalog.shows
                  ).restore(item.title.id);
                  toast.success("Title restored");
                } catch {
                  toast.error(
                    "Restoration failed. Your archived record is preserved. Please try again.",
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
      )}
    </details>
  );
}
