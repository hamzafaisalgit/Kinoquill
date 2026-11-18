import { EpisodeDiaryButton } from "../personal/ViewingHistory";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { journalPreferences } from "../../services/preferences";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { catalog } from "../../services/catalog";
import type { ShowTrackingRecord } from "../../services/showService";
import type { Episode, EpisodeProgress, Season } from "../../types/domain";
import { seasonProgress } from "../../utils/tvProgress";
import { RatingInput } from "../movies/MovieControls";
import { localToday } from "../../utils/dates";

export function SeasonManager({ record }: { record: ShowTrackingRecord }) {
  const [add, setAdd] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (location.hash)
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [location.hash, record.seasons.length]);
  return (
    <section id="seasons" className="tv-seasons">
      <div className="section-label">
        <div>
          <span className="eyebrow">ONE CHAPTER AT A TIME</span>
          <h2>Seasons & episodes</h2>
        </div>
        <button className="secondary-button" onClick={() => setAdd(true)}>
          <Plus size={14} />
          Add season
        </button>
      </div>
      <p className="preference-note">
        Exact tracking records individual episodes. Approximate tracking keeps a
        separate season count. Changing progress never changes your show status.
      </p>
      {!record.seasons.length && (
        <div className="panel tv-season-empty">
          <h3>No seasons recorded yet.</h3>
          <p>
            You can keep this show without an episode history, or add a season
            to begin tracking.
          </p>
        </div>
      )}
      {record.seasons.map((season) => (
        <SeasonAccordion key={season.id} season={season} record={record} />
      ))}
      {add && <SeasonEditor record={record} onClose={() => setAdd(false)} />}
    </section>
  );
}
function SeasonAccordion({
  season,
  record,
}: {
  season: Season;
  record: ShowTrackingRecord;
}) {
  const location = useLocation();
  const preferences = journalPreferences(useLocalStorage().settings.journal);
  const [expanded, setExpanded] = useState({
    hash: location.hash,
    open: preferences.expandSeasons || location.hash === `#season-${season.id}`,
  });
  const open =
    expanded.hash === location.hash
      ? expanded.open
      : location.hash === `#season-${season.id}`;
  const setOpen = (value: boolean) =>
    setExpanded({ hash: location.hash, open: value });
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  const [edit, setEdit] = useState(false),
    [episode, setEpisode] = useState<Episode | "new" | null>(null),
    [rate, setRate] = useState(false);
  const [quick, setQuick] = useState("");
  const tracking = record.tracking.find((item) => item.seasonId === season.id);
  const summary = seasonProgress(
    season,
    record.episodes,
    record.progress,
    tracking,
  );
  const seasonName =
    season.seasonNumber === 0 ? "Specials" : `Season ${season.seasonNumber}`;
  async function run(operation: () => Promise<unknown>, message?: string) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await operation();
      if (message) toast.success(message);
    } catch (error) {
      setFailure(userError(error));
    } finally {
      setBusy(false);
    }
  }
  function bulk(count: number, mode: "exact" | "approximate") {
    const explanation =
      mode === "exact"
        ? `This will mark the first ${count} episodes watched and the remaining episodes unwatched. Dates on episodes changed to unwatched will be cleared.`
        : `This will use an approximate count of ${count}. Existing exact episode records are kept separately and excluded from totals while approximate mode is active.`;
    if (
      window.confirm(
        `${seasonName}: ${explanation}\nYour show status and season rating will stay unchanged. Continue?`,
      )
    )
      void run(
        () =>
          catalog.shows.quickProgress(
            record.entry.id,
            season.id,
            count,
            mode,
            true,
          ),
        "Season progress updated",
      );
  }
  return (
    <article className="panel tv-season" id={`season-${season.id}`}>
      <button
        className="tv-season-heading"
        aria-expanded={open}
        aria-controls={`season-content-${season.id}`}
        onClick={() => setOpen(!open)}
      >
        <span className="tv-season-number">
          {season.seasonNumber === 0
            ? "SP"
            : String(season.seasonNumber).padStart(2, "0")}
        </span>
        <span>
          <strong>
            {seasonName}
            {season.name && season.name !== seasonName
              ? ` · ${season.name}`
              : ""}
          </strong>
          <small>
            {summary.watched} of {summary.total ?? "unknown"} episodes watched
            {summary.approximate ? " · Approximate" : ""}
            {season.seasonNumber === 0 && !record.show.includeSpecials
              ? " · Excluded from overall progress"
              : ""}
          </small>
        </span>
        <span className="tv-season-percent">
          {summary.percentage === null
            ? "—"
            : `${Math.round(summary.percentage)}%`}
          <small>
            <Star size={11} />
            {tracking?.personalRating ?? "Unrated"}
          </small>
        </span>
        <ChevronDown size={18} className={open ? "is-open" : ""} />
      </button>
      {summary.percentage !== null && (
        <progress
          aria-label={`${seasonName} recorded progress`}
          max={100}
          value={summary.percentage}
        />
      )}
      {open && (
        <div className="tv-season-content" id={`season-content-${season.id}`}>
          <div className="tv-season-actions">
            <button
              className="secondary-button"
              disabled={busy || summary.total === null}
              onClick={() =>
                bulk(
                  summary.total!,
                  summary.completeCatalog ? "exact" : "approximate",
                )
              }
            >
              <Check size={13} />
              Mark season watched
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                bulk(0, summary.completeCatalog ? "exact" : "approximate")
              }
            >
              Mark unwatched
            </button>
            <button className="text-button" onClick={() => setRate(true)}>
              <Star size={13} />
              Season rating
            </button>
            <button className="text-button" onClick={() => setEdit(true)}>
              <Pencil size={13} />
              Edit season
            </button>
          </div>
          <form
            className="tv-quick-progress"
            onSubmit={(event) => {
              event.preventDefault();
              bulk(
                Number(quick),
                summary.completeCatalog ? "exact" : "approximate",
              );
            }}
          >
            <label>
              Quick watched count{" "}
              <input
                type="number"
                required
                min="0"
                max={summary.total ?? undefined}
                step="1"
                value={quick}
                onChange={(event) => setQuick(event.target.value)}
                placeholder={String(summary.watched)}
              />
            </label>
            <button
              className="secondary-button"
              disabled={busy || quick === ""}
            >
              Apply{" "}
              {summary.completeCatalog
                ? "to first N episodes"
                : "approximate count"}
            </button>
          </form>
          <p className="preference-note">
            {summary.completeCatalog
              ? "Quick count uses the first N episodes in episode-number order and clears later watched states after confirmation."
              : "Episode metadata is incomplete. Quick tracking uses an explicitly approximate count; no episode IDs are invented."}
          </p>
          {summary.approximate && (
            <div className="tv-approximate-note">
              <p>
                Approximate mode is active. Individual episode records are
                preserved and excluded from totals.
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Switch to exact tracking? The existing individual episode states will determine progress. The approximate count will no longer contribute.",
                    )
                  )
                    void run(
                      () => catalog.shows.useExact(record.entry.id, season.id),
                      "Exact tracking enabled",
                    );
                }}
              >
                Use exact episode records
              </button>
            </div>
          )}
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
          <div className="tv-episode-toolbar">
            <span>
              {summary.rows.length} episode records · {summary.future} future
              air dates
            </span>
            <div>
              {record.title.tmdbId && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const count = await catalog.shows.loadSeason(
                        record.entry.id,
                        season.id,
                      );
                      toast.success(`${count} missing episode records added`);
                    })
                  }
                >
                  Load missing episodes from TMDB
                </button>
              )}
              <button className="text-button" onClick={() => setEpisode("new")}>
                <Plus size={13} />
                Add episode
              </button>
            </div>
          </div>
          {!summary.rows.length ? (
            <p className="tv-no-episodes">
              No episode metadata yet. Add episodes manually, load this season
              from TMDB, or keep an approximate count.
            </p>
          ) : (
            <div className="tv-episode-list">
              {summary.rows.map((row) => (
                <EpisodeRow
                  key={row.id}
                  episode={row}
                  seasonNumber={season.seasonNumber}
                  entryId={record.entry.id}
                  progress={record.progress.find(
                    (item) => item.episodeId === row.id,
                  )}
                  approximate={summary.approximate}
                  next={record.summary.next?.id === row.id}
                  onEdit={() => setEpisode(row)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {edit && (
        <SeasonEditor
          record={record}
          season={season}
          onClose={() => setEdit(false)}
        />
      )}
      {episode && (
        <EpisodeEditor
          entryId={record.entry.id}
          season={season}
          episode={episode === "new" ? undefined : episode}
          onClose={() => setEpisode(null)}
        />
      )}
      {rate && (
        <SeasonRating
          entryId={record.entry.id}
          seasonId={season.id}
          current={tracking?.personalRating ?? null}
          onClose={() => setRate(false)}
        />
      )}
    </article>
  );
}
function EpisodeRow({
  episode,
  seasonNumber,
  entryId,
  progress,
  approximate,
  next,
  onEdit,
}: {
  episode: Episode;
  seasonNumber: number;
  entryId: string;
  progress?: EpisodeProgress;
  approximate: boolean;
  next: boolean;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  const date =
    progress?.watchedAt.precision === "day" ? progress.watchedAt.value : "";
  async function update(watched: boolean, day?: string) {
    setBusy(true);
    setFailure(null);
    try {
      await catalog.shows.watchEpisode(entryId, episode.id, watched, day);
    } catch (error) {
      setFailure(userError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`tv-episode-row ${next ? "tv-next-episode" : ""}`}
      id={`episode-${episode.id}`}
    >
      <label className="tv-episode-check">
        <input
          type="checkbox"
          aria-label={`Mark episode ${episode.episodeNumber} watched`}
          checked={progress?.watched ?? false}
          disabled={busy || approximate}
          onChange={(event) => void update(event.target.checked)}
        />
        <span>
          <small>
            S{String(seasonNumber).padStart(2, "0")}E
            {String(episode.episodeNumber).padStart(2, "0")}
            {next ? " · NEXT UP" : ""}
          </small>
          <strong>{episode.name || `Episode ${episode.episodeNumber}`}</strong>
          <small>
            {episode.runtimeMinutes
              ? `${episode.runtimeMinutes} min`
              : "Runtime unknown"}{" "}
            · {episode.airDate ?? "Air date unknown"}
            {episode.airDate && episode.airDate > localToday()
              ? " · Upcoming"
              : ""}
          </small>
        </span>
      </label>
      <div className="tv-episode-personal">
        <EpisodeDiaryButton entryId={entryId} episodeId={episode.id} />
        {progress?.watched && (
          <label>
            Watched date
            <input
              key={`${episode.id}:${date}`}
              type="date"
              aria-label={`Episode ${episode.episodeNumber} watched date`}
              defaultValue={date}
              disabled={busy || approximate}
              onBlur={(event) => {
                if (event.target.value !== date)
                  void update(true, event.target.value);
              }}
            />
            {progress.watchedAt.precision !== "unknown" &&
              progress.watchedAt.precision !== "day" && (
                <small>
                  {progress.watchedAt.value} · {progress.watchedAt.precision}{" "}
                  only{" "}
                  <button
                    className="text-button"
                    disabled={busy || approximate}
                    onClick={() => void update(true, "")}
                  >
                    Clear date
                  </button>
                </small>
              )}
          </label>
        )}
        <button
          className="text-button"
          aria-label={`Edit episode ${episode.episodeNumber}`}
          onClick={onEdit}
        >
          <Pencil size={13} />
        </button>
      </div>
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="duplicate-dialog tv-editor-dialog"
      aria-label={title}
      onCancel={onClose}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
function SeasonEditor({
  record,
  season,
  onClose,
}: {
  record: ShowTrackingRecord;
  season?: Season;
  onClose: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);
    try {
      await catalog.shows.saveSeason(
        record.entry.id,
        {
          titleId: record.title.id,
          seasonNumber: Number(values.get("number")),
          name: String(values.get("name")).trim() || null,
          episodeCount:
            values.get("count") === "" ? null : Number(values.get("count")),
          releaseDate: String(values.get("date")) || null,
        },
        season?.id,
      );
      toast.success(season ? "Season updated" : "Season added");
      onClose();
    } catch (error) {
      setFailure(userError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={season ? "Edit season" : "Add a season"} onClose={onClose}>
      <form onSubmit={submit} className="tv-small-form">
        <label>
          Season number <small>Use 0 for Specials</small>
          <input
            autoFocus
            type="number"
            name="number"
            min="0"
            step="1"
            required
            defaultValue={
              season?.seasonNumber ??
              Math.max(0, ...record.seasons.map((item) => item.seasonNumber)) +
                1
            }
          />
        </label>
        <label>
          Season name
          <input name="name" defaultValue={season?.name ?? ""} />
        </label>
        <label>
          Episode count <small>Blank means unknown</small>
          <input
            type="number"
            min="0"
            step="1"
            name="count"
            defaultValue={season?.episodeCount ?? ""}
          />
        </label>
        <label>
          First air date
          <input
            type="date"
            name="date"
            defaultValue={season?.releaseDate ?? ""}
          />
        </label>
        {failure && (
          <p role="alert" className="field-error">
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
            {busy ? "Saving…" : "Save season"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function EpisodeEditor({
  entryId,
  season,
  episode,
  onClose,
}: {
  entryId: string;
  season: Season;
  episode?: Episode;
  onClose: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setFailure(null);
    try {
      await catalog.shows.saveEpisode(
        entryId,
        {
          seasonId: season.id,
          episodeNumber: Number(values.get("number")),
          name: String(values.get("name")).trim() || null,
          runtimeMinutes:
            values.get("runtime") === "" ? null : Number(values.get("runtime")),
          airDate: String(values.get("date")) || null,
        },
        episode?.id,
      );
      toast.success(episode ? "Episode updated" : "Episode added");
      onClose();
    } catch (error) {
      setFailure(userError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={episode ? "Edit episode" : "Add an episode"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="tv-small-form">
        <label>
          Episode number
          <input
            autoFocus
            name="number"
            required
            type="number"
            min="1"
            step="1"
            defaultValue={episode?.episodeNumber ?? ""}
          />
        </label>
        <label>
          Episode name
          <input name="name" defaultValue={episode?.name ?? ""} />
        </label>
        <label>
          Runtime · minutes
          <input
            name="runtime"
            type="number"
            min="1"
            defaultValue={episode?.runtimeMinutes ?? ""}
          />
        </label>
        <label>
          Air date
          <input
            name="date"
            type="date"
            defaultValue={episode?.airDate ?? ""}
          />
        </label>
        {failure && (
          <p className="field-error" role="alert">
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
            {busy ? "Saving…" : "Save episode"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SeasonRating({
  entryId,
  seasonId,
  current,
  onClose,
}: {
  entryId: string;
  seasonId: string;
  current: number | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  return (
    <Modal title="Your season rating" onClose={onClose}>
      <p>Independent of your overall show rating.</p>
      <RatingInput
        value={value}
        onChange={setValue}
        required={false}
        historical={false}
        error={failure ?? undefined}
      />
      <div className="dialog-actions">
        <button className="secondary-button" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await catalog.shows.rateSeason(entryId, seasonId, value);
              toast.success("Season rating saved");
              onClose();
            } catch (error) {
              setFailure(userError(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save season rating
        </button>
      </div>
    </Modal>
  );
}
function userError(error: unknown) {
  return error instanceof Error &&
    [
      "ValidationError",
      "ConflictError",
      "StorageUnavailableError",
      "TmdbError",
    ].includes(error.name)
    ? error.message
    : "Your change could not be saved. Your existing record is preserved; please try again.";
}
