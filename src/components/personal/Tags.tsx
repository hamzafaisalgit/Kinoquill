import { useState } from "react";
import { Link } from "react-router-dom";
import { catalog } from "../../services/catalog";
import { useCatalogQuery } from "../../hooks/useCatalog";
import { usePersonalAction } from "./common";
import { Dialog } from "../common/Dialog";
import type { Tag } from "../../types/personal";
export function TagManager({ onClose }: { onClose: () => void }) {
  const tags = useCatalogQuery(() => catalog.personal.tags(), []),
    [editing, setEditing] = useState<Tag | null>(null),
    [name, setName] = useState(""),
    [search, setSearch] = useState(""),
    { busy, error, run } = usePersonalAction();
  return (
    <Dialog title="Personal tags" onClose={onClose} busy={busy}>
      <div className="personal-form">
        <p className="preference-note">
          Categories are structured groups. Tags are flexible descriptions, such
          as slow-burn or comfort-watch. Genres are never turned into tags.
        </p>
        <label>
          Search tags
          <input
            aria-label="Search tags"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="personal-tag-manager">
          {tags.data
            ?.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
            .map((t) => (
              <div key={t.id}>
                <Link to={`/library?tag=${encodeURIComponent(t.id)}`}>
                  #{t.name}
                </Link>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(t);
                    setName(t.name);
                  }}
                >
                  Rename
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete tag “${t.name}” and its title links? Titles and categories stay saved.`,
                      )
                    )
                      void run(() => catalog.personal.deleteTag(t.id));
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await catalog.personal.saveTag(name, editing?.id);
              setName("");
              setEditing(null);
            });
          }}
        >
          <label>
            {editing ? "Rename tag" : "Create a tag"}
            <input
              aria-label="Tag name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <div className="personal-inline-actions">
            <button className="button" disabled={busy || !name.trim()}>
              {editing ? "Save tag" : "Create tag"}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
              >
                Cancel rename
              </button>
            )}
          </div>
        </form>
        {(error || tags.error) && (
          <p className="field-error" role="alert">
            {error || tags.error?.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}
export function PersonalTags({ titleId }: { titleId: string }) {
  const tags = useCatalogQuery(() => catalog.personal.tags(), []),
    assigned = useCatalogQuery(
      () => catalog.personal.titleTags(titleId),
      [titleId],
    ),
    [search, setSearch] = useState(""),
    [manage, setManage] = useState(false),
    { busy, error, run } = usePersonalAction();
  const ids = new Set(assigned.data?.map((t) => t.tagId));
  return (
    <section className="panel personal-section">
      <div className="personal-section-heading">
        <div>
          <p className="eyebrow">IN YOUR OWN WORDS</p>
          <h2>Personal tags</h2>
        </div>
        <button className="text-button" onClick={() => setManage(true)}>
          Manage tags
        </button>
      </div>
      <div className="personal-tag-chips">
        {tags.data
          ?.filter((t) => ids.has(t.id))
          .map((t) => (
            <span key={t.id}>
              <Link to={`/library?tag=${encodeURIComponent(t.id)}`}>
                #{t.name}
              </Link>
              <button
                aria-label={`Remove tag ${t.name}`}
                disabled={busy}
                onClick={() =>
                  void run(() => catalog.personal.setTag(titleId, t.id, false))
                }
              >
                ×
              </button>
            </span>
          ))}
      </div>
      <label className="personal-tag-search">
        Find or create a descriptive tag
        <input
          aria-label="Find personal tags"
          placeholder="comfort-watch, slow-burn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {search.trim() && (
        <div className="personal-inline-actions">
          {tags.data
            ?.filter(
              (t) =>
                t.name.toLowerCase().includes(search.toLowerCase()) &&
                !ids.has(t.id),
            )
            .slice(0, 20)
            .map((t) => (
              <button
                className="secondary-button"
                disabled={busy}
                key={t.id}
                onClick={() =>
                  void run(async () => {
                    await catalog.personal.setTag(titleId, t.id, true);
                    setSearch("");
                  })
                }
              >
                + {t.name}
              </button>
            ))}
          {!tags.data?.some(
            (t) => t.name.toLowerCase() === search.trim().toLowerCase(),
          ) && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const tag = await catalog.personal.saveTag(search);
                  await catalog.personal.setTag(titleId, tag.id, true);
                  setSearch("");
                })
              }
            >
              Create & assign “{search.trim()}”
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {manage && <TagManager onClose={() => setManage(false)} />}
    </section>
  );
}
