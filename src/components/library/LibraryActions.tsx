import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { LibraryItem, WatchStatus } from "../../types/domain";
import type { BulkAction, LibraryTarget } from "../../services/libraryService";
import { catalog } from "../../services/catalog";
import { useCategories, useCatalogQuery } from "../../hooks/useCatalog";
import { STATUSES } from "../../utils/libraryState";
import { Dialog } from "../common/Dialog";
import { RatingInput } from "../movies/MovieControls";
import { toast } from "sonner";

export function AddTitleDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Make room for a story." onClose={onClose}>
      <p>
        Choose a movie or TV show. Search TMDB or enter it manually in the next
        step.
      </p>
      <div className="library-add-options">
        <Link className="button" to="/movies/new" onClick={onClose}>
          Add movie
        </Link>
        <Link className="secondary-button" to="/shows/new" onClick={onClose}>
          Add TV show
        </Link>
      </div>
      <Link className="text-link" to="/discover" onClick={onClose}>
        Discover titles · TMDB ↗
      </Link>
    </Dialog>
  );
}
export function QuickEditDialog({
  item,
  initialStatus,
  onClose,
}: {
  item: LibraryItem;
  initialStatus?: WatchStatus;
  onClose: () => void;
}) {
  const categories = useCategories(),
    [status, setStatus] = useState(initialStatus ?? item.entry.status),
    [rating, setRating] = useState(item.entry.personalRating),
    [selected, setSelected] = useState(
      (item.categories ?? []).map((row) => row.id),
    ),
    [failure, setFailure] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await catalog.library.quickUpdate(
        { id: item.entry.id, revision: item.entry.revision },
        {
          ...(status !== item.entry.status ? { status } : {}),
          ...(rating !== item.entry.personalRating
            ? { personalRating: rating }
            : {}),
        },
        JSON.stringify([...selected].sort()) !==
          JSON.stringify((item.categories ?? []).map((row) => row.id).sort())
          ? selected
          : undefined,
      );
      toast.success("Personal record updated");
      onClose();
    } catch (error) {
      setFailure(actionError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Refine your personal record" busy={busy} onClose={onClose}>
      <p className="library-edit-title">
        {item.title.title}{" "}
        <small>
          {item.title.releaseYear ?? "Year unknown"} ·{" "}
          {item.title.mediaType === "movie" ? "Movie" : "TV show"}
        </small>
      </p>
      <form onSubmit={save} className="library-edit-form">
        <label>
          Watch status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as WatchStatus)}
          >
            {STATUSES.filter(
              (option) =>
                option.value !== "unknown" || item.entry.status === "unknown",
            )
              .filter(
                (option) =>
                  option.value !== "caught_up" ||
                  item.title.mediaType === "tv" ||
                  item.entry.status === "caught_up",
              )
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === "completed"
                    ? item.title.mediaType === "movie"
                      ? "Watched"
                      : "Completed"
                    : option.label}
                </option>
              ))}
          </select>
        </label>
        <RatingInput
          value={rating}
          onChange={setRating}
          required={status === "completed"}
          historical={
            item.entry.ratingPolicy === "historical" &&
            rating === item.entry.personalRating
          }
        />
        <fieldset className="library-check-list">
          <legend>Personal categories</legend>
          {categories.isLoading ? (
            <p>Loading categories…</p>
          ) : categories.error ? (
            <p className="field-error">
              Categories could not be loaded. Existing assignments are retained.
            </p>
          ) : categories.data?.length ? (
            categories.data.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(category.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, category.id]
                        : selected.filter((id) => id !== category.id),
                    )
                  }
                />
                {category.name}
              </label>
            ))
          ) : (
            <p className="preference-note">
              Create categories from Manage categories in the library.
            </p>
          )}
        </fieldset>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function BulkActionDialog({
  targets,
  action,
  onClose,
  onSaved,
}: {
  targets: LibraryTarget[];
  action: BulkAction["kind"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const categories = useCategories(),
    [categoryId, setCategoryId] = useState(""),
    [status, setStatus] = useState<WatchStatus>("watching"),
    [favorite, setFavorite] = useState(true),
    [failure, setFailure] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const operation: BulkAction =
        action === "status"
          ? { kind: "status", value: status }
          : action === "favorite"
            ? { kind: "favorite", value: favorite }
            : action === "archive"
              ? { kind: "archive" }
              : { kind: action, categoryId };
      const result = await catalog.library.bulkUpdate(targets, operation);
      toast.success(`${result.updated} selected records updated`);
      onSaved();
      onClose();
    } catch (error) {
      setFailure(actionError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        action === "archive"
          ? "Archive selected titles?"
          : "Update selected titles"
      }
      onClose={onClose}
      busy={busy}
    >
      <form className="library-edit-form" onSubmit={save}>
        <p>
          <strong>{targets.length} selected records on this page.</strong> This
          action commits together. If any record fails validation, none of the
          selected records will change.
        </p>
        {action === "archive" ? (
          <p>
            Titles will leave active collections. Ratings, reviews, categories,
            viewing history, and TV progress are preserved. Restore them from
            Movies → Recently Deleted or TV Shows → Archived shows.
          </p>
        ) : action === "status" ? (
          <>
            <label>
              New watch status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as WatchStatus)
                }
              >
                {STATUSES.filter((option) => option.value !== "unknown").map(
                  (option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <p className="preference-note">
              Completed requires an existing personal rating. Add missing
              ratings individually before applying. No rating or viewing date is
              invented.
            </p>
          </>
        ) : action === "favorite" ? (
          <label>
            Favorite flag
            <select
              value={favorite ? "yes" : "no"}
              onChange={(event) => setFavorite(event.target.value === "yes")}
            >
              <option value="yes">Mark favorite</option>
              <option value="no">Remove favorite</option>
            </select>
          </label>
        ) : (
          <label>
            {action === "category_add" ? "Add category" : "Remove category"}
            <select
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Choose a category</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categories.error && (
              <small className="field-error">
                Categories could not be loaded.
              </small>
            )}
          </label>
        )}
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy
              ? "Applying…"
              : action === "archive"
                ? "Confirm archive"
                : "Apply to selected"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function CategoryManager({
  onClose,
  onView,
}: {
  onClose: () => void;
  onView: (id: string) => void;
}) {
  const result = useCatalogQuery(() => catalog.categories.listWithUsage(), []),
    [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null),
    [deleting, setDeleting] = useState<string | null>(null);
  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setFailure(null);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      if (editing)
        await catalog.categories.updateCategory(editing, {
          name,
          description: description || null,
        });
      else
        await catalog.categories.createCategory({
          name,
          description: description || null,
        });
      toast.success(editing ? "Category updated" : "Category created");
      reset();
    } catch (error) {
      setFailure(actionError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Your personal categories" onClose={onClose} busy={busy} wide>
      <p>
        Give your collection its own vocabulary. Categories organize titles;
        genres describe them.
      </p>
      <form className="library-category-form" onSubmit={save}>
        <label>
          Category name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Must Rewatch"
          />
        </label>
        <label>
          Description <small>Optional</small>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button className="button" disabled={busy}>
          {editing ? "Save category" : "Create category"}
        </button>
        {editing && (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={reset}
          >
            Cancel edit
          </button>
        )}
      </form>
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      <div className="library-category-list">
        {result.isLoading ? (
          <p>Opening categories…</p>
        ) : result.error ? (
          <p className="field-error">Categories could not be loaded.</p>
        ) : !result.data?.length ? (
          <p>No categories yet. Create your first one above.</p>
        ) : (
          result.data.map((category) => (
            <article key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <p>
                  {category.description || "No description"} · {category.count}{" "}
                  active titles
                </p>
              </div>
              <div>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    onView(category.id);
                    onClose();
                  }}
                >
                  View titles
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(category.id);
                    setName(category.name);
                    setDescription(category.description ?? "");
                    setFailure(null);
                  }}
                >
                  Rename / edit
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setDeleting(category.id)}
                >
                  Delete
                </button>
              </div>
              {deleting === category.id && (
                <div className="library-category-confirm">
                  <p>
                    Delete “{category.name}”? Its assignments will be removed.
                    Every movie and show remains in your library.
                  </p>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => setDeleting(null)}
                  >
                    Keep category
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setFailure(null);
                      try {
                        await catalog.categories.deleteCategory(category.id);
                        if (editing === category.id) reset();
                        setDeleting(null);
                        toast.success("Category deleted; titles preserved");
                      } catch (error) {
                        setFailure(actionError(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm delete category
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </Dialog>
  );
}
function actionError(error: unknown) {
  return error instanceof Error &&
    [
      "ValidationError",
      "ConflictError",
      "RecordNotFoundError",
      "StorageUnavailableError",
    ].includes(error.name)
    ? error.message
    : "Your change could not be saved. No partial changes were committed. Please try again.";
}
