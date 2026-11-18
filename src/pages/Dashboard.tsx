import { BackupReminder } from "../components/personal/BackupPanel";
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
import { useMemo } from "react";
import { useAnalyticsData } from "../analytics/data";
import { calculateAnalytics, displayNumber } from "../analytics/calculations";
import { localToday } from "../utils/dates";
import "../styles/analytics.css";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "../components/common/States";
import { useLibrarySummary } from "../hooks/useCatalog";
import { useLibrary } from "../hooks/useCatalog";
import { MovieCard } from "../components/movies/MovieCard";
import "../styles/movies.css";
import "../styles/shows.css";
import { ContinueWatching } from "../components/shows/ContinueWatching";

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
  const recent = useLibrary({
    mediaType: "movie",
    pageSize: 4,
    sort: "newest",
  });
  const analytics = useAnalyticsData();
  const analysis = useMemo(
    () =>
      analytics.data
        ? calculateAnalytics(analytics.data, undefined, localToday())
        : null,
    [analytics.data],
  );
  return (
    <>
      <PageHeader
        eyebrow="KINOQUILL · THE PERSONAL CINEMA JOURNAL"
        title="Your cinema, curated."
        description="Every story you've watched. Every story you've kept."
      />
      <BackupReminder />
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
          label="Movies watched"
          icon={Film}
          path="/movies"
          value={analysis?.overview.moviesWatched}
          loading={analytics.isLoading}
        />
        <StatCard
          label="Completed TV shows"
          icon={Tv}
          path="/shows"
          value={analysis?.overview.showsCompleted}
          loading={summary.isLoading}
        />
        <StatCard
          label="Watchlist"
          icon={Bookmark}
          path="/watchlist"
          value={analysis?.overview.watchlist}
          loading={summary.isLoading}
        />
        <StatCard
          label="Favorites"
          icon={Heart}
          path="/favorites"
          value={analysis?.overview.favorites}
          loading={summary.isLoading}
        />
      </section>
      {analysis && (
        <section className="panel analytics-insights">
          <div>
            <Sparkles size={18} />
            <span className="eyebrow">YOUR VIEWING PERSPECTIVE</span>
          </div>
          <h2>
            {analysis.overview.count
              ? `${displayNumber(analysis.overview.average)} /10 across ${analysis.overview.count} rated stories`
              : "Your perspective is taking shape."}
          </h2>
          <p>
            {analysis.insights[0] ??
              "Record personal ratings and viewing dates to discover patterns in your collection."}
          </p>
          <p>
            {analysis.years.at(-1)
              ? `${analysis.years.at(-1)!.name}: ${analysis.years.at(-1)!.movies} movie viewing events and ${analysis.years.at(-1)!.shows} recorded show completions.`
              : "Watching activity needs personal viewing dates."}
          </p>
          <div className="dashboard-analytics-recent">
            {analysis.recent.map((item) => (
              <Link
                key={item.title.id}
                to={`/${item.title.mediaType === "movie" ? "movies" : "shows"}/${item.title.id}`}
              >
                {item.title.title} ↗
              </Link>
            ))}
          </div>
          <Link className="text-link" to="/analytics">
            Explore your analytics ↗
          </Link>
        </section>
      )}
      <ContinueWatching />
      <div className="dashboard-bottom">
        <section className="panel collection-panel">
          <div className="panel-header">
            <div>
              <h2>Your collection</h2>
              <p>A growing archive of your kind of cinema.</p>
            </div>
            <Link className="text-link" to="/library">
              Explore <ArrowUpRight size={14} />
            </Link>
          </div>
          {recent.data?.items.length ? (
            <div className="dashboard-movie-grid">
              {recent.data.items.map((item) => (
                <MovieCard key={item.entry.id} item={item} />
              ))}
            </div>
          ) : (
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
                description={
                  recent.error
                    ? "Recent movies could not be loaded. Check local storage and try again."
                    : recent.isLoading
                      ? "Reading your local movie collection…"
                      : "Add a movie manually or discover it on TMDB. Your personal collection starts with one film."
                }
              />
            </div>
          )}
          <div className="panel-footnote">
            <span className="tiny-dot" />
            Your most recently added movies, kept locally.
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
            Add movies, follow series, or bring your spreadsheet history.
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
          ].map(({ icon: Icon, title, text }, index) => (
            <Link
              key={title}
              className="quick-action movie-quick-action"
              to={["/movies/new", "/shows/new", "/import-export"][index]}
            >
              <span className="quick-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>
                  {
                    ["Add a movie", "Add a TV show", "Import your collection"][
                      index
                    ]
                  }
                </strong>
                <p>{text}</p>
                <span className="upcoming-label">
                  {
                    [
                      "OPEN MOVIE ENTRY ↗",
                      "OPEN SHOW ENTRY ↗",
                      "OPEN IMPORT & EXPORT ↗",
                    ][index]
                  }
                </span>
              </div>
            </Link>
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
              Personal ratings live alongside your stories. Rating controls are
              available in every movie’s personal record.
            </p>
          </div>
          <span className="outline-pill">Personal ratings · Local</span>
        </article>
        <article className="panel journal-preview">
          <Clock3 size={22} strokeWidth={1.4} />
          <div>
            <h2>A journal, one story at a time.</h2>
            <p>
              Explore recorded viewing activity and personal insights in
              Analytics, or log another viewing in your Diary.
            </p>
          </div>
          <Link className="outline-pill" to="/analytics">
            Viewing analytics · Local
          </Link>
        </article>
      </section>
    </>
  );
}
