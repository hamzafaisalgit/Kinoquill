import {
  ArrowUpRight,
  Bookmark,
  Film,
  Heart,
  Library,
  Plus,
  Sparkles,
  Tv,
  Upload,
  Star,
  Clock3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "../components/common/States";
import { useLibrarySummary } from "../hooks/useCatalog";

function StatCard({
  label,
  icon: Icon,
  path,
  value,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  path: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <Link to={path} className="stat-card">
      <div>
        <Icon size={19} strokeWidth={1.5} />
        <ArrowUpRight size={15} />
      </div>
      <strong aria-busy={loading}>{loading ? "…" : (value ?? "—")}</strong>
      <span>{label}</span>
      <small>
        {loading
          ? "Reading local library"
          : value === undefined
            ? "Count unavailable"
            : "Active local library"}
      </small>
    </Link>
  );
}

function CinemaArtwork() {
  return (
    <div className="cinema-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="poster poster-back">
        <span>THE ART OF</span>
        <strong>STORY</strong>
        <div className="poster-circle" />
        <small>A WORLD BEYOND THE FRAME</small>
      </div>
      <div className="poster poster-front">
        <span>KINOQUILL ORIGINAL</span>
        <div className="abstract-sun" />
        <div className="abstract-mountain mountain-one" />
        <div className="abstract-mountain mountain-two" />
        <div className="poster-title">
          A life
          <br />
          in cinema.
        </div>
        <small>YOUR STORIES. BEAUTIFULLY KEPT.</small>
      </div>
      <span className="art-caption">A PLACE FOR EVERY STORY.</span>
      <div className="art-spark">✦</div>
    </div>
  );
}

export function Dashboard() {
  const summary = useLibrarySummary();
  return (
    <>
      <PageHeader
        eyebrow="KINOQUILL · THE PERSONAL CINEMA JOURNAL"
        title="Your cinema, curated."
        description="Every story you've watched. Every story you've kept."
      />
      <section className="welcome-hero">
        <div className="hero-copy">
          <span className="pill">
            <span className="tiny-dot" />A FRESH REEL
          </span>
          <h2>
            Great stories.
            <br />
            <span>One beautiful home.</span>
          </h2>
          <p>
            A lifetime of films, unforgettable series, and personal discoveries.
            Keep every chapter of your cinematic journey in Kinoquill.
          </p>
          <div className="hero-note">
            <Library size={17} />
            <span>
              {summary.data && summary.data.movies + summary.data.shows > 0
                ? "Your stories, kept on this device."
                : "Your collection is ready for its first story."}
            </span>
          </div>
        </div>
        <CinemaArtwork />
      </section>
      <div className="section-label">
        <h2>At a glance</h2>
        <span>
          {summary.error
            ? "Local counts unavailable"
            : "Live from your local library"}
        </span>
      </div>
      {summary.error && (
        <p className="error-state" role="alert">
          {summary.error.message}
        </p>
      )}
      <section className="stats-grid" aria-label="Local collection overview">
        <StatCard
          label="Movies"
          icon={Film}
          path="/movies"
          value={summary.data?.movies}
          loading={summary.isLoading}
        />
        <StatCard
          label="TV Shows"
          icon={Tv}
          path="/shows"
          value={summary.data?.shows}
          loading={summary.isLoading}
        />
        <StatCard
          label="Watchlist"
          icon={Bookmark}
          path="/watchlist"
          value={summary.data?.watchlist}
          loading={summary.isLoading}
        />
        <StatCard
          label="Favorites"
          icon={Heart}
          path="/favorites"
          value={summary.data?.favorites}
          loading={summary.isLoading}
        />
      </section>
      <div className="dashboard-bottom">
        <section className="panel collection-panel">
          <div className="panel-header">
            <div>
              <h2>Your collection</h2>
              <p>A growing archive of your kind of cinema.</p>
            </div>
            <Link className="text-link" to="/movies">
              Explore <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="collection-empty">
            <div className="poster-outlines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <EmptyState
              icon={Film}
              title={
                summary.data && summary.data.movies + summary.data.shows > 0
                  ? "Your archive is taking shape."
                  : "The opening scene is yours."
              }
              description="Your titles are stored locally. Poster browsing and full title management arrive in later phases."
            />
          </div>
          <div className="panel-footnote">
            <span className="tiny-dot" />
            An empty canvas. Endless possibilities.
          </div>
        </section>
        <section className="panel next-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">WHAT’S NEXT</p>
              <h2>Build your vault</h2>
            </div>
            <Sparkles size={20} className="accent" />
          </div>
          <p className="next-description">
            The foundation is set. These tools arrive in the next chapters.
          </p>
          {[
            {
              icon: Plus,
              title: "Add your first movie",
              text: "From memorable classics to new discoveries.",
            },
            {
              icon: Tv,
              title: "Start a series",
              text: "Follow the story, season by season.",
            },
            {
              icon: Upload,
              title: "Bring your history",
              text: "Give your Excel & CSV records a new home.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div className="quick-action" key={title} aria-disabled="true">
              <span className="quick-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
                <span className="upcoming-label">COMING IN A LATER PHASE</span>
              </div>
            </div>
          ))}
          <div className="next-footer">
            Thoughtfully built. One chapter at a time.
          </div>
        </section>
      </div>
      <section
        className="journal-previews"
        aria-label="Your personal journal preview"
      >
        <article className="panel journal-preview">
          <Star size={22} strokeWidth={1.4} />
          <div>
            <h2>Your own point of view.</h2>
            <p>
              Personal ratings live alongside your stories. Rating controls
              arrive with movie management.
            </p>
          </div>
          <span className="outline-pill">Personal ratings · Upcoming</span>
        </article>
        <article className="panel journal-preview">
          <Clock3 size={22} strokeWidth={1.4} />
          <div>
            <h2>A journal, one story at a time.</h2>
            <p>
              Recent activity will appear here as your archive grows. Viewing
              history is planned for a later phase.
            </p>
          </div>
          <span className="outline-pill">Recent activity · Upcoming</span>
        </article>
      </section>
    </>
  );
}
