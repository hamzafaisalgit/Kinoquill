import {
  ArrowLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Clock3,
  Database,
  FileSpreadsheet,
  Film,
  Globe2,
  Heart,
  Layers3,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
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

export function CollectionPage({ route }: { route: CollectionRoute }) {
  return (
    <>
      <PageHeader
        eyebrow={route.eyebrow}
        title={route.label}
        description={route.description}
        action={<UpcomingButton>{route.action}</UpcomingButton>}
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

export function AnalyticsPage() {
  const cards = [
    {
      icon: Film,
      title: "Your viewing landscape",
      text: "Movies, series, and the shape of your collection.",
    },
    {
      icon: Star,
      title: "A matter of taste",
      text: "Personal ratings and your most-loved stories.",
    },
    {
      icon: Layers3,
      title: "Beyond the surface",
      text: "Genres, directors, and decades of discovery.",
    },
    {
      icon: Clock3,
      title: "Time well spent",
      text: "Viewing habits, watching hours, and rewatches.",
    },
    {
      icon: Globe2,
      title: "Cinema without borders",
      text: "Explore the countries and languages you watch.",
    },
    {
      icon: Heart,
      title: "Your personal insights",
      text: "Find the threads that connect your favorites.",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="A NEW PERSPECTIVE"
        title="The story behind your stories."
        description="Discover what your collection says about your cinematic world."
      />
      <section className="analytics-intro panel">
        <div className="empty-icon">
          <ChartNoAxesCombined size={27} />
        </div>
        <div>
          <span className="eyebrow">INSIGHTS, IN TIME</span>
          <h2>A richer picture starts with your collection.</h2>
          <p>
            Analytics arrive in a later phase. No statistics are calculated or
            displayed yet.
          </p>
        </div>
      </section>
      <section className="feature-grid">
        {cards.map(({ icon: Icon, title, text }) => (
          <article className="panel feature-card" key={title}>
            <Icon size={23} strokeWidth={1.5} />
            <span className="upcoming-label">UPCOMING</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function ImportExportPage() {
  return (
    <>
      <PageHeader
        eyebrow="YOUR HISTORY, CONTINUED"
        title="Bring your stories along."
        description="Years of watching deserve more than a spreadsheet."
      />
      <div className="transfer-grid">
        <section className="panel import-panel">
          <span className="pill">COMING IN A LATER PHASE</span>
          <div className="file-art" aria-hidden="true">
            <FileSpreadsheet size={60} strokeWidth={1} />
            <span>XLSX</span>
            <ArrowUpRight size={20} />
            <span>CSV</span>
          </div>
          <h2>A new home for your collection.</h2>
          <p>
            Import your existing Excel workbooks and CSV files with column
            mapping, duplicate checks, and a preview before anything is saved.
            Multiple sheets, validation, and exports will be handled entirely in
            your browser.
          </p>
          <div className="disabled-dropzone" aria-disabled="true">
            <Upload size={24} />
            <strong>File import is on its way</strong>
            <span>Excel (.xlsx) & CSV · Not available in Phase 1</span>
          </div>
        </section>
        <div className="transfer-details">
          <article className="panel feature-card">
            <ShieldCheck size={24} />
            <h2>Your history, handled with care.</h2>
            <p>
              Future imports will validate records before saving, flag
              incomplete entries, and preserve historical ratings.
            </p>
          </article>
          <article className="panel feature-card">
            <Database size={24} />
            <h2>Keep a copy of your world.</h2>
            <p>
              Library exports and downloadable templates will arrive alongside
              the import tools.
            </p>
            <span className="upcoming-label">EXPORT TOOLS · UPCOMING</span>
          </article>
        </div>
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
            <dd>Phase 01 · Foundation</dd>
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
            <dd>TMDB integration in a later phase</dd>
          </div>
        </dl>
        {storage.error && (
          <ErrorState
            message={storage.error}
            onRetry={() => void storage.retry()}
          />
        )}
      </section>
      <section className="panel local-data-panel">
        <ShieldCheck size={24} className="accent" />
        <div>
          <h2>Your archive stays with you.</h2>
          <p>
            Preferences are stored on this device in this browser. Personal
            library records will use the same local-first approach in Phase 2.
            Cloud synchronization is not enabled.
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
