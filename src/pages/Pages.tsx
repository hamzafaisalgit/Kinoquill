import {
  ArrowLeft,
  ArrowUpRight,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  UpcomingButton,
} from "../components/common/States";
import type { CollectionRoute } from "../lib/routes";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { TmdbSettings } from "../components/discovery/TmdbSettings";
import "../styles/discovery.css";

export function CollectionPage({ route }: { route: CollectionRoute }) {
  return (
    <>
      <PageHeader
        eyebrow={route.eyebrow}
        title={route.label}
        description={route.description}
        action={
          route.path === "/movies" || route.path === "/shows" ? (
            <Link
              className="button"
              to={`/discover?type=${route.path === "/shows" ? "tv" : "movie"}`}
            >
              Discover {route.path === "/shows" ? "shows" : "movies"}{" "}
              <ArrowUpRight size={15} />
            </Link>
          ) : (
            <UpcomingButton>{route.action}</UpcomingButton>
          )
        }
      />
      <section
        className={`panel library-scaffold ${route.path === "/favorites" ? "favorites-scaffold" : ""}`}
      >
        <div className="panel-header">
          <span className="section-overline">
            YOUR {route.label.toUpperCase()}
          </span>
          <span className="muted-label">Collection tools coming soon</span>
        </div>
        <EmptyState
          icon={route.icon}
          title={route.emptyTitle}
          description={route.emptyDescription}
        >
          <span className="outline-pill">
            Your personal collection, beautifully organized
          </span>
        </EmptyState>
        <div className="scaffold-cards" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <p>Your taste. Your records. A collection kept locally, with care.</p>
      </div>
    </>
  );
}

export function SettingsPage() {
  const storage = useLocalStorage();
  return (
    <>
      <PageHeader
        eyebrow="BEHIND THE SCENES"
        title="Made to feel like yours."
        description="Your preferences, your local data, and what’s ahead."
      />
      <section className="panel settings-panel">
        <div className="panel-header">
          <div>
            <h2>Application & local storage</h2>
            <p>Your personal Kinoquill setup. No account required.</p>
          </div>
          <Monitor size={22} className="accent" />
        </div>
        <dl className="settings-list">
          <div>
            <dt>Application</dt>
            <dd>
              Kinoquill <span className="outline-pill">v0.1.0</span>
            </dd>
          </div>
          <div>
            <dt>Current edition</dt>
            <dd>Phase 08 · Local analytics & insights</dd>
          </div>
          <div>
            <dt>Local database</dt>
            <dd>{storage.version.name}</dd>
          </div>
          <div>
            <dt>Schema version</dt>
            <dd>{storage.version.version}</dd>
          </div>
          <div>
            <dt>Storage status</dt>
            <dd>
              {storage.phase === "initializing" ? (
                <LoadingState message="Initializing local storage…" />
              ) : storage.phase !== "ready" ? (
                "Storage unavailable — preferences cannot be saved"
              ) : (
                "Ready · local write/read verified"
              )}
            </dd>
          </div>
          <div>
            <dt>Sidebar preference</dt>
            <dd>
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={storage.settings.sidebarCollapsed}
                  disabled={storage.phase !== "ready" || storage.saving}
                  onChange={(event) =>
                    void storage.updateSettings({
                      sidebarCollapsed: event.target.checked,
                    })
                  }
                />
                Keep desktop sidebar collapsed
              </label>
              <small className="preference-note">
                {storage.saving
                  ? "Saving…"
                  : storage.phase === "ready"
                    ? "Saved on this device · restored after reload"
                    : "Storage access required"}
              </small>
            </dd>
          </div>
          <div>
            <dt>Appearance</dt>
            <dd>Midnight & amber</dd>
          </div>
          <div>
            <dt>Metadata provider</dt>
            <dd>TMDB · optional, configured below</dd>
          </div>
        </dl>
        {storage.error && (
          <ErrorState
            message={storage.error}
            onRetry={() => void storage.retry()}
          />
        )}
      </section>
      <TmdbSettings />
      <section className="panel local-data-panel">
        <ShieldCheck size={24} className="accent" />
        <div>
          <h2>Your archive stays with you.</h2>
          <p>
            Preferences and personal library records are stored on this device
            in this browser. Cloud synchronization is not enabled.
          </p>
          <p>
            Clearing site data, changing browsers, or changing the site address
            may remove access to your records. Browser storage is not a backup.
            Export and restore tools arrive in a later phase; regular backups
            are recommended once available.
          </p>
        </div>
      </section>
      <section className="panel upcoming-settings">
        <SlidersHorizontal size={23} />
        <div>
          <h2>A little more personal, soon.</h2>
          <p>
            Theme preferences, rating settings, categories, and backup tools are
            planned for later phases.
          </p>
        </div>
        <span className="outline-pill">Upcoming</span>
      </section>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="not-found">
      <p className="eyebrow">SCENE NOT FOUND</p>
      <span className="error-number">404</span>
      <h1>This scene didn’t make the cut.</h1>
      <p>The page you’re looking for isn’t in this collection.</p>
      <Link to="/" className="button">
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>
    </div>
  );
}
