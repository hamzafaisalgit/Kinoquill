import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { catalog } from "../../services/catalog";
import { useCatalogQuery } from "../../hooks/useCatalog";
import type { CustomList } from "../../types/personal";
import { Dialog } from "../common/Dialog";
import { usePersonalAction } from "./common";
import "../../styles/personal.css";
export function ListEditor({
  list,
  onClose,
  onCreated,
}: {
  list?: CustomList;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState(list?.name ?? ""),
    [description, setDescription] = useState(list?.description ?? ""),
    { busy, error, run } = usePersonalAction();
  const navigate = useNavigate();
  return (
    <Dialog
      title={list ? "Edit your list" : "Create a private list"}
      onClose={onClose}
      busy={busy}
    >
      <form
        className="personal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const row = list
              ? await catalog.personal.updateList(list.id, {
                  name,
                  description: description || null,
                })
              : await catalog.personal.createList({
                  name,
                  description: description || null,
                });
            onClose();
            if (!list) {
              if (onCreated) onCreated(row.id);
              else navigate(`/lists/${row.id}`);
            }
          });
        }}
      >
        <label>
          List title
          <input
            aria-label="List title"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="List description"
            maxLength={5000}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="preference-note">
          Private and local. The first posters become your list cover; use the
          move controls to arrange your collection.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
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
          <button className="button" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : list ? "Save list" : "Create list"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function AddToListButton({
  titleIds,
  label = "Add to list",
}: {
  titleIds: string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-button personal-add-list"
        disabled={!titleIds.length}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <AddToListDialog titleIds={titleIds} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
export function AddToListDialog({
  titleIds,
  onClose,
}: {
  titleIds: string[];
  onClose: () => void;
}) {
  const lists = useCatalogQuery(() => catalog.personal.lists(), []),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    { busy, error, run } = usePersonalAction();
  return (
    <Dialog
      title={`Add ${titleIds.length} ${titleIds.length === 1 ? "title" : "titles"} to a list`}
      onClose={onClose}
      busy={busy}
    >
      <form
        className="personal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const result =
              selected === "new"
                ? await catalog.personal.createListWithTitles(
                    { name, description: null },
                    titleIds,
                  )
                : await catalog.personal.addToList(selected, titleIds);
            toast.success(
              `${result.added} added · ${result.alreadyPresent} already on this list`,
            );
            onClose();
          });
        }}
      >
        <label>
          Choose a private list
          <select
            aria-label="Choose a private list"
            value={selected}
            required
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a list</option>
            {lists.data?.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
            <option value="new">Create a new list…</option>
          </select>
        </label>
        {selected === "new" && (
          <label>
            New list title
            <input
              aria-label="New list title"
              value={name}
              required
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <p className="preference-note">
          Existing membership is kept once. Titles and their ratings are not
          copied.
        </p>
        {(error || lists.error) && (
          <p role="alert" className="field-error">
            {error || lists.error?.message}
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
          <button
            className="button"
            disabled={busy || !selected || (selected === "new" && !name.trim())}
          >
            {busy ? "Adding…" : "Add to list"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function AddTitlesDialog({
  listId,
  onClose,
}: {
  listId: string;
  onClose: () => void;
}) {
  const library = useCatalogQuery(
      () => catalog.library.exportLibraryEntries({ sort: "title_asc" }),
      [],
    ),
    [search, setSearch] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    { busy, error, run } = usePersonalAction();
  const matching =
    library.data?.filter((i) =>
      i.title.title.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <Dialog
      title="Choose stories for this list"
      onClose={onClose}
      wide
      busy={busy}
    >
      <div className="personal-form">
        <label>
          Search your library
          <input
            aria-label="Search list titles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="preference-note">
          {matching.length} matching titles · showing up to 100. Search to
          narrow your selection. {ids.length} selected.
        </p>
        <div className="personal-choice-list">
          {matching.slice(0, 100).map((i) => (
            <label key={i.title.id}>
              <input
                type="checkbox"
                checked={ids.includes(i.title.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, i.title.id]
                      : ids.filter((id) => id !== i.title.id),
                  )
                }
              />
              <span>
                {i.title.title}
                <small>
                  {i.title.releaseYear ?? "Year unknown"} ·{" "}
                  {i.title.mediaType === "movie" ? "Movie" : "TV show"}
                </small>
              </span>
            </label>
          ))}
        </div>
        {(error || library.error) && (
          <p role="alert" className="field-error">
            {error || library.error?.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button"
            disabled={busy || !ids.length}
            onClick={() =>
              void run(async () => {
                const result = await catalog.personal.addToList(listId, ids);
                toast.success(
                  `${result.added} titles added · ${result.alreadyPresent} already present`,
                );
                onClose();
              })
            }
          >
            {busy ? "Adding…" : `Add ${ids.length} titles`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
