import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { catalog } from "../../services/catalog";
import { useCatalogQuery } from "../../hooks/useCatalog";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { localDatabase } from "../../services/localDatabase";
import { FILTER_KEYS, type LibraryPreferences } from "../../utils/libraryState";
import type { SavedView } from "../../types/personal";
import { Dialog } from "../common/Dialog";
import { TagManager } from "./Tags";
import { usePersonalAction } from "./common";
export function SavedViewsBar({
  route,
  params,
  display,
  onTag,
}: {
  route: SavedView["route"];
  params: URLSearchParams;
  display: LibraryPreferences;
  onTag: (tagId: string) => void;
}) {
  const views = useCatalogQuery(() => catalog.personal.views(), []),
    tags = useCatalogQuery(() => catalog.personal.tags(), []),
    [chosen, setChosen] = useState(""),
    [editor, setEditor] = useState<"create" | "rename" | "update" | null>(null),
    [tagManager, setTagManager] = useState(false),
    navigate = useNavigate(),
    storage = useLocalStorage(),
    { busy, error, run } = usePersonalAction();
  const current = views.data?.find((v) => v.id === chosen),
    clean = new URLSearchParams();
  for (const [key, value] of params)
    if ([...FILTER_KEYS, "sort", "view", "size"].includes(key))
      clean.append(key, value);
  async function open() {
    if (!current) return;
    const checked = await catalog.personal.inspectView(current);
    if (
      checked.missing.length &&
      !window.confirm(
        `This view references missing ${[...new Set(checked.missing)].join(", ")} filters. Open without those filters? The saved configuration will stay available for editing.`,
      )
    )
      return;
    await storage.updateSettings({ library: checked.display });
    if (localDatabase.getSnapshot().phase !== "ready")
      throw new Error("The saved display preferences could not be loaded.");
    const p = new URLSearchParams(checked.params);
    p.set("sort", checked.display.sort);
    p.set("view", checked.display.view);
    navigate(current.route + "?" + p.toString());
  }
  return (
    <section className="panel saved-views-bar">
      <div className="saved-view-controls">
        <label>
          Saved library views
          <select
            aria-label="Saved library views"
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
          >
            <option value="">Choose a view</option>
            {views.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={!current || busy || storage.saving}
          onClick={() => void run(open)}
        >
          Open view
        </button>
        <button
          className="secondary-button"
          onClick={() => setEditor("create")}
        >
          Save current view
        </button>
        <label>
          Descriptive tags
          <select
            aria-label="Filter personal tag"
            value={params.get("tag") ?? ""}
            onChange={(e) => onTag(e.target.value)}
          >
            <option value="">All tags</option>
            {tags.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button className="text-button" onClick={() => setTagManager(true)}>
          Manage tags
        </button>
      </div>
      {current && (
        <div className="personal-inline-actions">
          <span className="preference-note">
            {current.description ?? "Private filter configuration"}
          </span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setEditor("rename")}
          >
            Rename / describe
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setEditor("update")}
          >
            Update from current view
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const row = await catalog.personal.saveView({
                  ...current,
                  name: `${current.name.slice(0, 190)} copy`,
                });
                setChosen(row.id);
              })
            }
          >
            Duplicate view
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Delete saved view “${current.name}”? Library records stay saved.`,
                )
              )
                void run(async () => {
                  await catalog.personal.deleteView(current.id);
                  setChosen("");
                });
            }}
          >
            Delete view
          </button>
        </div>
      )}
      {(error || views.error || tags.error) && (
        <p className="field-error" role="alert">
          {error || views.error?.message || tags.error?.message}
        </p>
      )}
      {editor && (
        <ViewEditor
          mode={editor}
          view={current}
          config={{ route, params: clean.toString(), display }}
          onClose={() => setEditor(null)}
          onSaved={setChosen}
        />
      )}{" "}
      {tagManager && <TagManager onClose={() => setTagManager(false)} />}
    </section>
  );
}
function ViewEditor({
  mode,
  view,
  config,
  onClose,
  onSaved,
}: {
  mode: "create" | "rename" | "update";
  view?: SavedView;
  config: Pick<SavedView, "route" | "params" | "display">;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState(mode === "create" ? "" : (view?.name ?? "")),
    [description, setDescription] = useState(
      mode === "create" ? "" : (view?.description ?? ""),
    ),
    { busy, error, run } = usePersonalAction();
  return (
    <Dialog
      title={
        mode === "create"
          ? "Save this library view"
          : mode === "rename"
            ? "Name your saved perspective"
            : "Update this saved view"
      }
      onClose={onClose}
      busy={busy}
    >
      <form
        className="personal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const source = mode === "rename" && view ? view : config;
            const row = await catalog.personal.saveView(
              {
                route: source.route,
                params: source.params,
                display: source.display,
                name,
                description: description || null,
              },
              mode === "create" ? undefined : view?.id,
            );
            onSaved(row.id);
            onClose();
          });
        }}
      >
        <label>
          View name
          <input
            aria-label="Saved view name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <p className="preference-note">
          {mode === "update"
            ? "This replaces its filters, sorting, layout and visible columns with your current view."
            : "Only filters and display preferences are saved. Results always come from current library records."}
        </p>
        {error && (
          <p className="field-error" role="alert">
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
            {busy ? "Saving…" : "Save view"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
