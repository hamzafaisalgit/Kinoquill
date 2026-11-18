import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalogQuery } from "../../hooks/useCatalog";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { localDatabase } from "../../services/localDatabase";
import { BackupService } from "../../services/backup/service";
import {
  BACKUP_STORES,
  type CompleteBackup,
} from "../../services/backup/validation";
import { journalPreferences } from "../../services/preferences";
import { Dialog } from "../common/Dialog";
import { usePersonalAction } from "./common";
const backups = new BackupService(localDatabase.database);
async function downloadCompleteBackup() {
  await backups.download();
  const settings = await localDatabase.readSettings();
  await localDatabase.updateSettings({
    journal: {
      ...journalPreferences(settings.journal),
      lastBackupAt: new Date().toISOString(),
      remindAfter: null,
    },
  });
}
export function BackupReminder() {
  const storage = useLocalStorage(),
    p = journalPreferences(storage.settings.journal),
    { busy, error, run } = usePersonalAction();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const due =
    p.backupInterval > 0 &&
    (!p.lastBackupAt ||
      now - Date.parse(p.lastBackupAt) >= p.backupInterval * 86400000) &&
    (!p.remindAfter || Date.parse(p.remindAfter) <= now);
  if (!due || storage.phase !== "ready") return null;
  return (
    <aside className="backup-reminder">
      <div>
        <strong>A little protection for your stories.</strong>
        <p>
          A complete backup is due. Reminders run only while Kinoquill is open.
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        className="secondary-button"
        disabled={busy || storage.saving}
        onClick={() => void run(downloadCompleteBackup)}
      >
        {busy ? "Preparing…" : "Download backup"}
      </button>
      <button
        className="text-button"
        disabled={busy || storage.saving}
        onClick={() =>
          void storage.updateSettings({
            journal: {
              ...p,
              remindAfter: new Date(Date.now() + 86400000).toISOString(),
            },
          })
        }
      >
        Remind me tomorrow
      </button>
      <Link className="text-link" to="/settings#data">
        Manage reminders
      </Link>
    </aside>
  );
}
export function BackupPanel() {
  const storage = useLocalStorage(),
    p = journalPreferences(storage.settings.journal),
    { busy, error, run } = usePersonalAction(),
    [preview, setPreview] = useState<CompleteBackup | null>(null),
    [clear, setClear] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [notice, setNotice] = useState(""),
    [offeredBackup, setOfferedBackup] = useState(false),
    [estimate, setEstimate] = useState<StorageEstimate | null>(null),
    [persistent, setPersistent] = useState("");
  const counts = useCatalogQuery(async () => {
    const db = localDatabase.database;
    return db.transaction(
      "r",
      BACKUP_STORES.map((n) => db.table(n)),
      async () => {
        const stored = Object.fromEntries(
          await Promise.all(
            BACKUP_STORES.map(async (name) => [
              name,
              await db.table(name).count(),
            ]),
          ),
        );
        return {
          ...stored,
          movies: await db.titles.where("mediaType").equals("movie").count(),
          shows: await db.titles.where("mediaType").equals("tv").count(),
        };
      },
    );
  }, []);
  useEffect(() => {
    let active = true;
    if (navigator.storage?.estimate)
      void navigator.storage
        .estimate()
        .then((value) => {
          if (active) setEstimate(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [notice]);
  async function download() {
    await downloadCompleteBackup();
    setNotice(
      "Complete JSON backup generated; download requested. Your browser decides where it is saved.",
    );
  }
  return (
    <section id="data" className="panel personal-section backup-panel">
      <div className="personal-section-heading">
        <div>
          <p className="eyebrow">KEEP YOUR STORIES SAFE</p>
          <h2>Data & storage</h2>
        </div>
        <span className="outline-pill">Complete JSON · v1</span>
      </div>
      <p className="preference-note">
        Browser storage is not a backup. Clearing site data, private browsing,
        or changing the site address can remove access to your collection. JSON
        backups preserve relationships, diary sessions and preferences. Poster
        image files and session TMDB credentials are excluded.
      </p>
      <dl className="storage-facts">
        {[
          ["Titles", counts.data?.titles],
          ["Movies", counts.data?.movies],
          ["TV shows", counts.data?.shows],
          ["Diary sessions", counts.data?.viewingSessions],
          ["Custom lists", counts.data?.customLists],
          ["Saved views", counts.data?.savedViews],
          ["Tags", counts.data?.tags],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "—"}</dd>
          </div>
        ))}
        <div>
          <dt>Last backup download initiated</dt>
          <dd>
            {p.lastBackupAt
              ? new Date(p.lastBackupAt).toLocaleString()
              : "Never recorded"}
          </dd>
        </div>
        <div>
          <dt>Approximate origin storage</dt>
          <dd>
            {estimate?.usage !== undefined
              ? `${(estimate.usage / 1048576).toFixed(1)} MB used`
              : "Estimate unavailable"}
            {estimate?.quota
              ? ` / ${(estimate.quota / 1048576).toFixed(0)} MB quota`
              : ""}
          </dd>
        </div>
      </dl>
      <div className="personal-form-grid">
        <label>
          Optional backup reminder
          <select
            aria-label="Backup reminder interval"
            value={p.backupInterval}
            disabled={storage.saving || busy}
            onChange={(e) =>
              void storage.updateSettings({
                journal: {
                  ...p,
                  backupInterval: Number(
                    e.target.value,
                  ) as typeof p.backupInterval,
                  remindAfter: null,
                },
              })
            }
          >
            <option value={0}>Off</option>
            <option value={7}>Every 7 days</option>
            <option value={30}>Every 30 days</option>
            <option value={90}>Every 90 days</option>
          </select>
        </label>
        <p className="preference-note">
          Reminders appear only when the app runs. Dismissing one does not
          record a backup. There are no scheduled cloud uploads.
        </p>
      </div>
      <div className="personal-inline-actions">
        <button
          className="button"
          disabled={busy || storage.saving}
          onClick={() => void run(download)}
        >
          Download Complete Backup
        </button>
        <label className="secondary-button backup-file-label">
          Restore JSON Backup
          <input
            aria-label="Restore JSON backup file"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void run(async () => {
                  const parsed = await backups.parse(file);
                  setPreview(parsed);
                  setConfirmation("");
                  setOfferedBackup(false);
                });
            }}
          />
        </label>
        {typeof navigator !== "undefined" && navigator.storage?.persist && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const granted = await navigator.storage.persist();
                setPersistent(
                  granted
                    ? "Persistent storage was granted. Backups are still essential."
                    : "Persistent storage was not granted; the browser controls retention.",
                );
              })
            }
          >
            Request persistent storage
          </button>
        )}
        <button
          className="text-button personal-danger"
          disabled={busy || storage.saving}
          onClick={() => {
            setClear(true);
            setConfirmation("");
            setOfferedBackup(false);
          }}
        >
          Clear All Local Data
        </button>
      </div>
      {persistent && (
        <p role="status" className="preference-note">
          {persistent}
        </p>
      )}
      {notice && (
        <p role="status" className="personal-success">
          {notice}
        </p>
      )}
      {(error || counts.error) && (
        <p role="alert" className="field-error">
          {error || counts.error?.message}
        </p>
      )}
      {(preview || clear) && (
        <Dialog
          title={
            preview
              ? "Restore complete backup · Replace"
              : "Clear all Kinoquill data"
          }
          onClose={() => {
            setPreview(null);
            setClear(false);
            setConfirmation("");
          }}
          busy={busy}
          wide
        >
          <div className="personal-form">
            <p>
              {preview
                ? `Backup exported ${new Date(preview.exportedAt).toLocaleString()}. Format v${preview.backupVersion}, database schema v${preview.schemaVersion}. Replace is the only restore mode. All current personal records, import history and preferences will be replaced atomically.`
                : "This clears Kinoquill titles, diary, lists, tags, imports and saved preferences on this origin. It does not delete unrelated databases or application files. The in-memory TMDB token is retained unless you clear it explicitly in TMDB settings."}
            </p>
            {preview && (
              <div className="backup-preview-counts">
                {BACKUP_STORES.map((name) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>
                      {counts.data?.[name] ?? "—"} → {preview.data[name].length}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await download();
                  setOfferedBackup(true);
                })
              }
            >
              Download current data before {preview ? "restoring" : "clearing"}
            </button>
            <label className="personal-checkbox">
              <input
                type="checkbox"
                checked={offeredBackup}
                onChange={(e) => setOfferedBackup(e.target.checked)}
                disabled={busy}
              />
              I downloaded a backup or explicitly choose to continue without
              one. A requested download cannot prove the file was saved.
            </label>
            <label>
              Type {preview ? "REPLACE" : "DELETE"} to confirm
              <input
                aria-label="Destructive action confirmation"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setClear(false);
                }}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={
                  busy ||
                  !offeredBackup ||
                  confirmation !== (preview ? "REPLACE" : "DELETE")
                }
                onClick={() =>
                  void run(async () => {
                    if (preview) {
                      const counts = await backups.restore(
                        preview,
                        confirmation,
                      );
                      await localDatabase.refreshSettings();
                      setNotice(
                        `Backup restored and verified: ${counts.titles} titles, ${counts.viewingSessions} diary sessions, ${counts.customLists} lists. All relationships passed validation.`,
                      );
                    } else {
                      await backups.clear(confirmation);
                      await localDatabase.refreshSettings();
                      setNotice(
                        "All personal Kinoquill stores cleared. Preferences reset to defaults.",
                      );
                    }
                    setPreview(null);
                    setClear(false);
                    setConfirmation("");
                  })
                }
              >
                {busy
                  ? "Committing…"
                  : preview
                    ? "Replace current data"
                    : "Clear all local data"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
