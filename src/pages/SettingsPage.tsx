import { PageHeader } from "../components/common/States";
import { TmdbSettings } from "../components/discovery/TmdbSettings";
import { BackupPanel } from "../components/personal/BackupPanel";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { journalPreferences } from "../services/preferences";
import { libraryPreferences, SORTS } from "../utils/libraryState";
import type { JournalPreferences } from "../types/personal";
import "../styles/discovery.css";
import "../styles/personal.css";
export default function SettingsPage() {
  const storage = useLocalStorage(),
    p = journalPreferences(storage.settings.journal),
    library = libraryPreferences(storage.settings.library),
    disabled = storage.saving || storage.phase !== "ready";
  const update = (patch: Partial<JournalPreferences>) =>
    void storage.updateSettings({ journal: { ...p, ...patch } });
  return (
    <div className="personal-page">
      <PageHeader
        eyebrow="ON YOUR OWN TERMS"
        title="Made to feel like yours."
        description="A personal journal, with preferences and protection to match."
      />
      <section className="panel personal-section">
        <div className="personal-section-heading">
          <div>
            <p className="eyebrow">PHASE 09 · YOUR LONG-TERM JOURNAL</p>
            <h2>Appearance & library</h2>
          </div>
          <span className="outline-pill">
            {storage.phase === "ready"
              ? "Saved on this device"
              : "Storage unavailable"}
          </span>
        </div>
        <p className="preference-note">
          Midnight & amber is the current theme. Settings persist in IndexedDB.
          Ratings stay on a 0–10 scale with 0.5 steps for normal entry;
          historical values retain their precision.
        </p>
        <div className="personal-settings-grid">
          <label>
            Default library layout
            <select
              aria-label="Default library layout"
              value={library.view}
              disabled={disabled}
              onChange={(e) =>
                void storage.updateSettings({
                  library: {
                    ...library,
                    view: e.target.value as "grid" | "table",
                  },
                })
              }
            >
              <option value="grid">Poster grid</option>
              <option value="table">Table</option>
            </select>
          </label>
          <label>
            Default sorting
            <select
              value={library.sort}
              disabled={disabled}
              onChange={(e) =>
                void storage.updateSettings({
                  library: {
                    ...library,
                    sort: e.target.value as typeof library.sort,
                  },
                })
              }
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titles per library page
            <select
              aria-label="Titles per library page"
              value={p.pageSize}
              disabled={disabled}
              onChange={(e) =>
                update({
                  pageSize: Number(e.target.value) as typeof p.pageSize,
                })
              }
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </label>
          <label>
            TV progress display
            <select
              value={p.progressStyle}
              disabled={disabled}
              onChange={(e) =>
                update({
                  progressStyle: e.target.value as typeof p.progressStyle,
                })
              }
            >
              <option value="bar">Numbers & progress bar</option>
              <option value="numbers">Numbers only</option>
            </select>
          </label>
          {(
            [
              ["posters", "Show posters on collection cards"],
              ["showCardYear", "Show release year on collection cards"],
              ["showCardRating", "Show personal rating on collection cards"],
              ["reducedMotion", "Reduce animations"],
              ["expandSeasons", "Expand seasons by default"],
              [
                "includeSpecials",
                "Include specials by default for newly added shows",
              ],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="personal-checkbox">
              <input
                type="checkbox"
                checked={p[key]}
                disabled={disabled}
                onChange={(e) => update({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <label className="personal-checkbox">
            <input
              type="checkbox"
              checked={storage.settings.sidebarCollapsed}
              disabled={disabled}
              onChange={(e) =>
                void storage.updateSettings({
                  sidebarCollapsed: e.target.checked,
                })
              }
            />
            Keep desktop sidebar collapsed
          </label>
        </div>
        <p className="preference-note">
          Existing shows keep their own Specials setting. Visible table columns
          remain configurable in Library and are included in saved views and
          backups.
        </p>
        <p className="preference-note">
          Database {storage.version.name} · schema {storage.version.version} ·{" "}
          {storage.saving
            ? "Saving preference…"
            : "Changes save when selected."}
        </p>
      </section>
      <TmdbSettings />
      <BackupPanel />
    </div>
  );
}
