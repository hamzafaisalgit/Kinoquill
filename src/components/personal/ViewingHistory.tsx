import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ViewingSession, DateValue } from "../../types/domain";
import { useCatalogQuery } from "../../hooks/useCatalog";
import { catalog } from "../../services/catalog";
import { localDatabase } from "../../services/localDatabase";
import { readDiary, type DiaryItem } from "../../services/diaryService";
import { Dialog } from "../common/Dialog";
import { PosterArtwork } from "../discovery/PosterArtwork";
import { DateWatchedInput } from "../movies/MovieControls";
import { usePersonalAction } from "./common";
import { newId } from "../../utils/normalization";
import "../../styles/personal.css";
export function SessionForm({
  entryId,
  episodeId,
  session,
  initialType = "first_watch",
  onClose,
}: {
  entryId?: string;
  episodeId?: string;
  session?: ViewingSession;
  initialType?: "first_watch" | "rewatch";
  onClose: () => void;
}) {
  const { busy, error, run } = usePersonalAction(),
    requestId = useRef(newId());
  const titles = useCatalogQuery(
    () => catalog.library.exportLibraryEntries({ sort: "title_asc" }),
    [],
  );
  const [selected, setSelected] = useState(
      session?.libraryEntryId ?? entryId ?? "",
    ),
    [episode, setEpisode] = useState(session?.episodeId ?? episodeId ?? ""),
    [kind, setKind] = useState(session?.sessionType ?? initialType);
  const [date, setDate] = useState<DateValue>(
      session?.viewedDate ?? { precision: "unknown", value: null },
    ),
    [rating, setRating] = useState(session?.sessionRating?.toString() ?? ""),
    [duration, setDuration] = useState(
      session?.durationMinutes?.toString() ?? "",
    ),
    [notes, setNotes] = useState(session?.notes ?? ""),
    [platform, setPlatform] = useState(session?.platform ?? ""),
    [context, setContext] = useState(session?.context ?? ""),
    [markWatched, setMarkWatched] = useState(false);
  const item = titles.data?.find((i) => i.entry.id === selected);
  const show = useCatalogQuery(
    () =>
      item?.title.mediaType === "tv"
        ? catalog.shows.tracking(item.title.id)
        : Promise.resolve(null),
    [item?.title.id],
  );
  return (
    <Dialog
      title={session ? "Edit viewing session" : "Log a viewing"}
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        className="personal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const input = {
              libraryEntryId: selected,
              episodeId: episode || null,
              sessionType: kind,
              viewedDate: date,
              sessionRating: rating === "" ? null : Number(rating),
              durationMinutes: duration === "" ? null : Number(duration),
              notes: notes || null,
              platform: platform || null,
              context: context || null,
            };
            if (session)
              await catalog.viewing.updateViewingSession(session.id, input);
            else
              await catalog.viewing.createViewingSession(input, {
                markWatched,
                sessionId: requestId.current,
              });
            onClose();
          });
        }}
      >
        <p className="preference-note">
          A session is another chapter of the same title. Overall rating, status
          and existing episode progress are preserved. Dates start as Unknown.
        </p>
        <label>
          Title
          <select
            required
            aria-label="Viewing title"
            disabled={!!session || !!entryId || busy}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setEpisode("");
              setMarkWatched(false);
            }}
          >
            <option value="">Choose from your library</option>
            {titles.data?.map((i) => (
              <option key={i.entry.id} value={i.entry.id}>
                {i.title.title} ·{" "}
                {i.title.mediaType === "movie" ? "Movie" : "TV"}
              </option>
            ))}
          </select>
        </label>
        {titles.error && <p role="alert">{titles.error.message}</p>}
        {item?.title.mediaType === "tv" && (
          <label>
            Episode or whole-show session
            <select
              aria-label="Viewing episode"
              value={episode}
              disabled={!!session || !!episodeId || busy}
              onChange={(e) => {
                setEpisode(e.target.value);
                setMarkWatched(false);
              }}
            >
              <option value="">Whole-show viewing session</option>
              {show.data?.episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  S
                  {
                    show.data!.seasons.find((s) => s.id === ep.seasonId)
                      ?.seasonNumber
                  }{" "}
                  E{ep.episodeNumber} · {ep.name ?? "Unnamed episode"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="personal-form-grid">
          <label>
            Session type
            <select
              aria-label="Session type"
              value={kind}
              disabled={!!session || busy}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="first_watch">First Watch</option>
              <option value="rewatch">Rewatch</option>
            </select>
          </label>
          <label>
            Session rating · separate from overall
            <input
              aria-label="Session rating"
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="Unrated"
            />
          </label>
        </div>
        <DateWatchedInput
          label="Session viewing date"
          value={date}
          onChange={setDate}
        />
        <div className="personal-form-grid">
          <label>
            Recorded duration · minutes
            <input
              type="number"
              min="0"
              step="any"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Unknown"
            />
          </label>
          <label>
            Platform
            <input
              maxLength={200}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        <label>
          Viewing context
          <input
            value={context}
            maxLength={1000}
            onChange={(e) => setContext(e.target.value)}
            placeholder="At home, with friends…"
          />
        </label>
        <label>
          Session notes
          <textarea
            aria-label="Session notes"
            rows={4}
            maxLength={20000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {!session && episode && kind === "first_watch" && (
          <label className="personal-checkbox">
            <input
              type="checkbox"
              checked={markWatched}
              onChange={(e) => setMarkWatched(e.target.checked)}
            />
            Also mark this episode watched with this date. Requires exact
            tracking; an approximate season is never reset.
          </label>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
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
            disabled={busy || !selected || titles.isLoading}
          >
            {busy ? "Saving…" : session ? "Save session" : "Log viewing"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function SessionCard({
  item,
  onEdit,
  onDelete,
}: {
  item: DiaryItem;
  onEdit: (s: ViewingSession) => void;
  onDelete: (s: ViewingSession) => void;
}) {
  const { title, session: s, episode, season } = item;
  return (
    <article className="diary-card">
      <Link
        className="diary-poster"
        to={`/${title.mediaType === "movie" ? "movies" : "shows"}/${title.id}`}
      >
        <PosterArtwork
          path={title.posterPath}
          title={title.title}
          allowExternal
        />
      </Link>
      <div className="diary-copy">
        <span className="personal-eyebrow">
          {s.sessionType === "rewatch" ? "A RETURN VISIT" : "FIRST WATCH"} ·{" "}
          {episode
            ? "TV EPISODE"
            : title.mediaType === "movie"
              ? "MOVIE"
              : "TV SHOW"}
        </span>
        <Link
          to={`/${title.mediaType === "movie" ? "movies" : "shows"}/${title.id}`}
        >
          <h3>{title.title}</h3>
        </Link>
        {episode && (
          <p>
            S{season?.seasonNumber} · E{episode.episodeNumber}{" "}
            {episode.name ?? ""}
          </p>
        )}
        <div className="diary-session-meta">
          <span>
            {s.viewedDate.value ?? "Date unknown"}
            {s.viewedDate.precision !== "unknown" &&
            s.viewedDate.precision !== "day"
              ? ` · ${s.viewedDate.precision} only`
              : ""}
          </span>
          {s.sessionRating !== null && s.sessionRating !== undefined && (
            <span>Session {s.sessionRating}/10</span>
          )}
          {s.durationMinutes !== null && (
            <span>{s.durationMinutes} min recorded</span>
          )}
          {s.platform && <span>{s.platform}</span>}
        </div>
        {s.context && <p>{s.context}</p>}
        {s.notes && <p className="diary-notes">{s.notes}</p>}
        <div className="personal-inline-actions">
          <button className="text-button" onClick={() => onEdit(s)}>
            Edit session
          </button>
          <button className="text-button" onClick={() => onDelete(s)}>
            Delete session
          </button>
        </div>
      </div>
    </article>
  );
}
export function DeleteSession({
  session,
  onClose,
}: {
  session: ViewingSession;
  onClose: () => void;
}) {
  const { busy, error, run } = usePersonalAction();
  return (
    <Dialog title="Delete this viewing session?" onClose={onClose} busy={busy}>
      <p>
        Only this diary session will be deleted. The title, overall rating,
        completion date, other sessions and episode progress stay saved.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="secondary-button" disabled={busy} onClick={onClose}>
          Keep session
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await catalog.viewing.deleteViewingSession(session.id);
              onClose();
            })
          }
        >
          {busy ? "Deleting…" : "Delete session"}
        </button>
      </div>
    </Dialog>
  );
}
export function ViewingHistory({
  entryId,
  episodeId,
  completed = false,
}: {
  entryId: string;
  episodeId?: string;
  completed?: boolean;
}) {
  const history = useCatalogQuery(
      () => readDiary(localDatabase.database, {}, entryId, episodeId),
      [entryId, episodeId],
    ),
    [form, setForm] = useState<ViewingSession | "new" | null>(null),
    [deleting, setDeleting] = useState<ViewingSession | null>(null);
  const rows = history.data?.items ?? [];
  return (
    <section className="panel personal-section">
      <div className="personal-section-heading">
        <div>
          <p className="eyebrow">ONE STORY, MANY VIEWINGS</p>
          <h2>{episodeId ? "Episode viewing history" : "Viewing history"}</h2>
        </div>
        <button className="secondary-button" onClick={() => setForm("new")}>
          Log viewing
        </button>
      </div>
      <p className="preference-note">
        {history.data?.total ?? 0} recorded sessions. First watch date:{" "}
        {history.data?.firstWatchDate?.value ?? "Unknown"}. Latest known
        viewing: {history.data?.latestDate?.value ?? "Unknown"}. Partial dates
        keep their stored precision.
      </p>
      {!rows.length && (
        <p className="personal-empty-copy">
          {completed
            ? "Historical completion is saved on the title; it is not a fabricated diary session. You can explicitly log a dated or undated viewing."
            : "No diary sessions yet. Record a first watch or a return visit."}
        </p>
      )}
      {history.error && <p role="alert">{history.error.message}</p>}
      {rows.slice(0, 5).map((item) => (
        <SessionCard
          key={item.session.id}
          item={item}
          onEdit={setForm}
          onDelete={setDeleting}
        />
      ))}
      <Link
        className="text-link"
        to={`/diary?entry=${encodeURIComponent(entryId)}${episodeId ? `&episode=${encodeURIComponent(episodeId)}` : ""}`}
      >
        Open full viewing diary ↗
      </Link>
      {form && (
        <SessionForm
          entryId={entryId}
          episodeId={episodeId}
          session={form === "new" ? undefined : form}
          initialType={
            rows.some(
              (r) =>
                r.session.sessionType === "first_watch" &&
                (r.session.episodeId ?? null) === (episodeId ?? null),
            )
              ? "rewatch"
              : "first_watch"
          }
          onClose={() => setForm(null)}
        />
      )}{" "}
      {deleting && (
        <DeleteSession session={deleting} onClose={() => setDeleting(null)} />
      )}
    </section>
  );
}
export function EpisodeDiaryButton({
  entryId,
  episodeId,
}: {
  entryId: string;
  episodeId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-button" onClick={() => setOpen(true)}>
        View / log episode history
      </button>
      {open && (
        <Dialog title="Episode diary" wide onClose={() => setOpen(false)}>
          <ViewingHistory entryId={entryId} episodeId={episodeId} />
        </Dialog>
      )}
    </>
  );
}
