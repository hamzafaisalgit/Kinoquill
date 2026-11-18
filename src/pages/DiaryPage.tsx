import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, LoadingState } from "../components/common/States";
import { useCatalogQuery, useCategories } from "../hooks/useCatalog";
import { localDatabase } from "../services/localDatabase";
import { readDiary } from "../services/diaryService";
import type { DiaryQuery } from "../services/personalService";
import type { ViewingSession } from "../types/domain";
import {
  SessionCard,
  SessionForm,
  DeleteSession,
} from "../components/personal/ViewingHistory";
export default function DiaryPage() {
  const [params, setParams] = useSearchParams(),
    [form, setForm] = useState<ViewingSession | "new" | null>(null),
    [deleting, setDeleting] = useState<ViewingSession | null>(null),
    categories = useCategories();
  const query: DiaryQuery = {
    media: params.get("media") ?? "",
    kind: params.get("kind") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    categoryId: params.get("category") ?? "",
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    page: Number(params.get("page")) || 1,
  };
  const result = useCatalogQuery(
    () =>
      readDiary(
        localDatabase.database,
        query,
        params.get("entry") ?? undefined,
        params.get("episode") ?? undefined,
      ),
    [params.toString()],
  );
  function update(key: string, value: string) {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  return (
    <div className="personal-page">
      <PageHeader
        eyebrow="YOUR LIFE IN STORIES"
        title="The viewing diary."
        description="First encounters, familiar favorites, and the evenings between."
        action={
          <button className="button" onClick={() => setForm("new")}>
            Log a viewing
          </button>
        }
      />
      <section className="panel personal-toolbar">
        <label>
          Media
          <select
            value={query.media}
            onChange={(e) => update("media", e.target.value)}
          >
            <option value="">All sessions</option>
            <option value="movie">Movies</option>
            <option value="episode">TV episodes</option>
            <option value="show">Whole-show sessions</option>
          </select>
        </label>
        <label>
          Session
          <select
            value={query.kind}
            onChange={(e) => update("kind", e.target.value)}
          >
            <option value="">First watches & rewatches</option>
            <option value="first_watch">First watches</option>
            <option value="rewatch">Rewatches</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={query.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            value={query.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </label>
        <label>
          Category
          <select
            value={query.categoryId}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order
          <select
            value={query.sort}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button className="text-button" onClick={() => setParams({})}>
          Clear filters
        </button>
      </section>
      <p className="personal-caption">
        {result.data?.total ?? 0} actual viewing sessions ·{" "}
        {result.data?.undated ?? 0} undated. Partial dates retain their
        precision; unknown dates stay outside calendar filters. Sessions do not
        change overall ratings or statuses.
      </p>
      {result.isLoading ? (
        <LoadingState message="Opening your viewing diary…" />
      ) : result.error ? (
        <p role="alert" className="error-state">
          {result.error.message}
        </p>
      ) : !result.data?.items.length ? (
        <section className="panel personal-empty">
          <span className="eyebrow">AN EVENING WORTH KEEPING</span>
          <h2>A place for your first entry.</h2>
          <p>
            Record a viewing from your library. An unknown date is always
            welcome.
          </p>
          <button className="button" onClick={() => setForm("new")}>
            Log a viewing
          </button>
        </section>
      ) : (
        <div className="diary-timeline">
          {result.data.items.map((item, index) => {
            const d = item.session.viewedDate;
            const key =
              d.precision === "unknown"
                ? "Undated history"
                : d.precision === "day"
                  ? `${d.value.slice(0, 4)} / ${d.value.slice(5, 7)} / ${d.value.slice(8)}`
                  : `${d.value} · ${d.precision} only`;
            const previous = result.data!.items[index - 1]?.session.viewedDate;
            const header =
              !previous ||
              previous.precision !== d.precision ||
              previous.value !== d.value;
            return (
              <div key={item.session.id}>
                {header && <h2 className="diary-date-heading">{key}</h2>}
                <SessionCard
                  item={item}
                  onEdit={setForm}
                  onDelete={setDeleting}
                />
              </div>
            );
          })}
        </div>
      )}
      {result.data && result.data.totalPages > 1 && (
        <nav className="personal-pagination" aria-label="Diary pages">
          <button
            className="secondary-button"
            disabled={result.data.page <= 1}
            onClick={() => update("page", String(result.data!.page - 1))}
          >
            Previous
          </button>
          <span>
            {result.data.page} / {result.data.totalPages}
          </span>
          <button
            className="secondary-button"
            disabled={result.data.page >= result.data.totalPages}
            onClick={() => update("page", String(result.data!.page + 1))}
          >
            Next
          </button>
        </nav>
      )}
      {form && (
        <SessionForm
          entryId={params.get("entry") ?? undefined}
          episodeId={params.get("episode") ?? undefined}
          session={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {deleting && (
        <DeleteSession session={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}
