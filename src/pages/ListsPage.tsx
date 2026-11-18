import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowUp, ArrowDown, Layers3, Plus } from "lucide-react";
import { PageHeader, LoadingState } from "../components/common/States";
import { Dialog } from "../components/common/Dialog";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { ListEditor, AddTitlesDialog } from "../components/personal/Lists";
import { usePersonalAction } from "../components/personal/common";
import { useCatalogQuery } from "../hooks/useCatalog";
import { catalog } from "../services/catalog";
import "../styles/personal.css";
export default function ListsPage() {
  const query = useCatalogQuery(() => catalog.personal.listCards(), []),
    [create, setCreate] = useState(false);
  return (
    <div className="personal-page">
      <PageHeader
        eyebrow="COLLECTIONS WITH A POINT OF VIEW"
        title="Your own double features."
        description="Private lists for the stories that belong together."
        action={
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={15} />
            Create list
          </button>
        }
      />
      {query.isLoading ? (
        <LoadingState />
      ) : query.error ? (
        <p className="error-state" role="alert">
          {query.error.message}
        </p>
      ) : query.data?.length ? (
        <div className="custom-list-grid">
          {query.data.map(({ list, covers, count }) => (
            <Link
              className="panel custom-list-card"
              key={list.id}
              to={`/lists/${list.id}`}
            >
              <div className="custom-list-cover">
                {covers.length ? (
                  covers.map((title) => (
                    <PosterArtwork
                      key={title.id}
                      path={title.posterPath}
                      title={title.title}
                      allowExternal
                    />
                  ))
                ) : (
                  <div className="custom-list-empty-cover">
                    <Layers3 size={32} />
                    <span>A NEW COLLECTION</span>
                  </div>
                )}
              </div>
              <div className="custom-list-copy">
                <span className="personal-eyebrow">
                  PRIVATE · {count} TITLES
                </span>
                <h2>{list.name}</h2>
                <p>{list.description ?? "A collection on your own terms."}</p>
                <span className="text-link">Open collection ↗</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel personal-empty">
          <Layers3 size={30} />
          <h2>A collection within your collection.</h2>
          <p>
            Create a ranked favorites list, a family-night selection, or a home
            for your comfort shows.
          </p>
          <button className="button" onClick={() => setCreate(true)}>
            Create your first list
          </button>
        </section>
      )}
      {create && <ListEditor onClose={() => setCreate(false)} />}
    </div>
  );
}
export function ListDetailsPage() {
  const { id = "" } = useParams(),
    navigate = useNavigate(),
    query = useCatalogQuery(() => catalog.personal.listDetails(id), [id]),
    [edit, setEdit] = useState(false),
    [add, setAdd] = useState(false),
    [remove, setRemove] = useState(false),
    [page, setPage] = useState(1),
    { busy, error, run } = usePersonalAction();
  const record = query.data;
  async function move(itemId: string, direction: number) {
    if (!record) return;
    const ids = record.items.map((i) => i.row.id),
      index = ids.indexOf(itemId),
      next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await catalog.personal.reorder(id, ids);
  }
  if (query.isLoading)
    return (
      <>
        <PageHeader
          eyebrow="YOUR PRIVATE COLLECTION"
          title="Opening your list…"
          description="Reading your private collection."
        />
        <LoadingState />
      </>
    );
  if (!record)
    return (
      <>
        <PageHeader
          eyebrow="YOUR PRIVATE COLLECTION"
          title="This list could not be opened."
          description="Your other lists and titles remain saved."
        />
        <p className="error-state" role="alert">
          {query.error?.message ?? "The list no longer exists."}
        </p>
        <Link className="button" to="/lists">
          Back to lists
        </Link>
      </>
    );
  const pages = Math.max(1, Math.ceil(record.items.length / 24)),
    current = Math.min(page, pages);
  return (
    <div className="personal-page">
      <Link to="/lists" className="text-link">
        ← All lists
      </Link>
      <PageHeader
        eyebrow={`PRIVATE COLLECTION · ${record.items.length} TITLES`}
        title={record.list.name}
        description={
          record.list.description ?? "A collection on your own terms."
        }
        action={
          <button className="button" onClick={() => setAdd(true)}>
            Add titles
          </button>
        }
      />
      <div className="personal-inline-actions">
        <button className="secondary-button" onClick={() => setEdit(true)}>
          Edit list
        </button>
        <button className="text-button" onClick={() => setRemove(true)}>
          Delete list
        </button>
        <span className="preference-note">
          Use the arrows to save your preferred order. Archived titles remain
          labeled.
        </span>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      <div className="ordered-list-grid">
        {record.items
          .slice((current - 1) * 24, current * 24)
          .map(({ row, title, entry }, i) => (
            <article className="panel ordered-list-card" key={row.id}>
              <span className="list-rank">{(current - 1) * 24 + i + 1}</span>
              <Link
                to={
                  title
                    ? `/${title.mediaType === "movie" ? "movies" : "shows"}/${title.id}`
                    : "/library"
                }
                className="ordered-list-poster"
              >
                <PosterArtwork
                  path={title?.posterPath}
                  title={title?.title ?? "Missing title"}
                  allowExternal
                />
              </Link>
              <div className="ordered-list-caption">
                <h2>{title?.title ?? "Title unavailable"}</h2>
                <p>
                  {title?.releaseYear ?? "Year unknown"} ·{" "}
                  {title?.mediaType === "movie" ? "Movie" : "TV show"}
                  {entry?.deletedAt ? " · Archived" : ""}
                </p>
                <div className="personal-inline-actions">
                  <button
                    className="icon-button"
                    disabled={busy || (current - 1) * 24 + i === 0}
                    aria-label={`Move ${title?.title} up`}
                    onClick={() => void run(() => move(row.id, -1))}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={
                      busy || (current - 1) * 24 + i === record.items.length - 1
                    }
                    aria-label={`Move ${title?.title} down`}
                    onClick={() => void run(() => move(row.id, 1))}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        catalog.personal.removeFromList(id, row.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
      </div>
      {!record.items.length && (
        <section className="panel personal-empty">
          <h2>The first pick is yours.</h2>
          <p>Add movies and shows, then arrange them in the order you love.</p>
          <button className="button" onClick={() => setAdd(true)}>
            Choose titles
          </button>
        </section>
      )}
      {pages > 1 && (
        <nav className="personal-pagination">
          <button
            className="secondary-button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="secondary-button"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {edit && <ListEditor list={record.list} onClose={() => setEdit(false)} />}{" "}
      {add && <AddTitlesDialog listId={id} onClose={() => setAdd(false)} />}{" "}
      {remove && (
        <Dialog
          title="Delete this private list?"
          onClose={() => setRemove(false)}
          busy={busy}
        >
          <p>
            Only this list and its ordering will be removed. Its movies, shows,
            tags, ratings and diary records remain saved.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              Keep list
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await catalog.personal.deleteList(id);
                  navigate("/lists");
                })
              }
            >
              {busy ? "Deleting…" : "Delete list"}
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </div>
  );
}
