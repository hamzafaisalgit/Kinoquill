import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChartNoAxesCombined, Sparkles, ShieldCheck } from "lucide-react";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../components/common/States";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { AnalyticsFilters } from "../components/analytics/AnalyticsFilters";
import { ChartCard } from "../components/analytics/ChartCard";
import { useAnalyticsData } from "../analytics/data";
import {
  calculateAnalytics,
  displayNumber as n,
  groupStats,
} from "../analytics/calculations";
import { DEFAULT_FILTERS } from "../analytics/types";
import type {
  ChartRow,
  AnalyticsTitle,
  AnalyticsFilters as FilterValue,
} from "../analytics/types";
import { selectAnalytics } from "../analytics/selectors";
import { localToday } from "../utils/dates";
import { titleHref } from "../utils/libraryState";
import "../styles/analytics.css";

const tabs = [
  "Overview",
  "Activity",
  "Ratings",
  "Genres",
  "People",
  "Releases",
  "Languages & countries",
  "Television",
  "Watch time",
  "Rewatches",
  "Compare years",
];
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <article className="analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}
function RankedTitles({
  title,
  items,
}: {
  title: string;
  items: AnalyticsTitle[];
}) {
  return (
    <section className="panel analytic-ranking">
      <h3>{title}</h3>
      {items.length ? (
        items.map((i) => (
          <Link key={i.title.id} to={titleHref(i)} className="analytic-title">
            <div>
              <PosterArtwork
                path={i.title.posterPath}
                title={i.title.title}
                allowExternal
              />
            </div>
            <span>
              <strong>{i.title.title}</strong>
              <small>
                {i.title.releaseYear ?? "Release year unknown"} ·{" "}
                {i.title.mediaType === "movie"
                  ? "Movie"
                  : i.title.mediaSubtype === "tv_miniseries"
                    ? "Miniseries"
                    : "TV show"}
              </small>
            </span>
            <b>
              {n(i.entry.personalRating)}
              <small>/10</small>
            </b>
          </Link>
        ))
      ) : (
        <p className="analytics-note">
          No personal ratings in this selection yet.
        </p>
      )}
    </section>
  );
}
function FilterError({ f }: { f: FilterValue }) {
  const invalid =
    (f.from && f.to && f.from > f.to) ||
    (f.minYear && f.maxYear && Number(f.minYear) > Number(f.maxYear)) ||
    (f.minRating && f.maxRating && Number(f.minRating) > Number(f.maxRating)) ||
    (f.date === "year" &&
      (!Number.isInteger(Number(f.year)) ||
        Number(f.year) < 1 ||
        Number(f.year) > 9999)) ||
    [f.minRating, f.maxRating].some(
      (v) => v !== "" && (Number(v) < 0 || Number(v) > 10),
    ) ||
    [f.minYear, f.maxYear].some(
      (v) =>
        v !== "" &&
        (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 9999),
    );
  return invalid ? (
    <p className="error-state" role="alert">
      Check your filter ranges: minimums must not exceed maximums, ratings must
      be 0–10, and years must be 1–9999. The selection may be empty until
      corrected.
    </p>
  ) : null;
}
export default function AnalyticsPage() {
  const source = useAnalyticsData(),
    [filters, setFilters] = useState({ ...DEFAULT_FILTERS }),
    [tab, setTab] = useState("Overview");
  const currentYear = Number(localToday().slice(0, 4)),
    [activityYear, setActivityYear] = useState(currentYear),
    [yearA, setYearA] = useState(currentYear - 1),
    [yearB, setYearB] = useState(currentYear);
  const result = useMemo(
    () =>
      source.data
        ? calculateAnalytics(source.data, filters, localToday())
        : null,
    [source.data, filters],
  );
  const selected = useMemo(
    () => (result ? selectAnalytics(result, activityYear, yearA, yearB) : null),
    [result, activityYear, yearA, yearB],
  );
  const context = `${filters.media} · ${filters.date === "all" ? "all viewing dates" : filters.date === "range" ? `${filters.from || "open"} to ${filters.to || "open"}` : filters.date === "this" ? currentYear : filters.date === "previous" ? currentYear - 1 : filters.year} · ${result?.items.length ?? 0} unique titles · filters ${JSON.stringify(filters)}`;
  if (!result)
    return (
      <>
        <PageHeader
          eyebrow="YOUR CINEMA, IN PERSPECTIVE"
          title="The story in your stories."
          description="Personal insights, calculated on this device."
        />
        {source.error ? (
          <ErrorState
            message={source.error.message}
            onRetry={() => window.location.reload()}
          />
        ) : (
          <LoadingState message="Reading your local collection…" />
        )}
      </>
    );
  const r = result,
    o = r.overview;
  const chart = (
    title: string,
    caption: string,
    rows: ChartRow[],
    keys: string[],
    extra: {
      horizontal?: boolean;
      line?: boolean;
      href?: (row: ChartRow) => string;
    } = {},
  ) => (
    <ChartCard
      key={title}
      title={title}
      caption={caption}
      rows={rows}
      series={keys.map((key) => ({
        key,
        label:
          (
            {
              count: "Titles",
              completed: "Completed titles",
              movies: "Movies",
              shows: "TV shows",
              average: "Average /10",
              episodes: "Episode events",
              rewatches: "Rewatches",
              recorded: "Recorded hours",
              estimated: "Estimated hours",
              recordedHours: "Recorded hours",
              estimatedHours: "Estimated hours",
              seasons: "Season ratings",
            } as Record<string, string>
          )[key] ?? key,
      }))}
      context={context}
      {...extra}
    />
  );
  const genreHref = (row: ChartRow) =>
    `/library?genre=${encodeURIComponent(String(row.id))}`;
  const statusHref = (row: ChartRow) =>
    `/shows?status=${encodeURIComponent(String(row.id))}`;
  const rated = r.items
    .filter((i) => i.entry.personalRating !== null)
    .sort(
      (a, b) =>
        b.entry.personalRating! - a.entry.personalRating! ||
        a.title.title.localeCompare(b.title.title),
    );
  const { monthly, genreTrends, a, b } = selected!;
  const yearPicker = (
    <label className="analytics-year">
      Activity year
      <input
        aria-label="Activity year"
        type="number"
        min="1"
        max="9999"
        value={activityYear}
        onChange={(e) =>
          setActivityYear(
            Math.max(1, Math.min(9999, Number(e.target.value) || currentYear)),
          )
        }
      />
    </label>
  );
  return (
    <div className="analytics-page">
      <PageHeader
        eyebrow="A DIFFERENT KIND OF SCREEN TIME"
        title="The story in your stories."
        description="A thoughtful look at what you watch, love, and return to."
        action={
          <Link className="button button-secondary" to="/library">
            Explore your library ↗
          </Link>
        }
      />
      <div className="analytics-local">
        <ShieldCheck size={15} />
        <span>
          PRIVATE BY DESIGN · Live from IndexedDB · No personal data leaves this
          browser
        </span>
      </div>
      <AnalyticsFilters
        value={filters}
        onChange={setFilters}
        snapshot={source.data!}
      />
      <FilterError f={filters} />
      <div className="analytics-selection">
        <strong>
          {o.total} unique {o.total === 1 ? "story" : "stories"}
        </strong>
        <span>
          {filters.date === "all"
            ? "All-time collection in the selected filters."
            : "Titles with a qualifying personal viewing event; event charts use only events within the selected range."}{" "}
          {r.reviewCount > 0
            ? `${r.reviewCount} imported or incomplete records carry review flags.`
            : ""}
        </span>
      </div>
      <section className="analytics-metrics" aria-label="Analytics overview">
        <Metric
          label="Movies in your library"
          value={o.movies}
          note={`${o.moviesWatched} watched`}
        />
        <Metric
          label="TV shows & miniseries"
          value={o.shows}
          note={`${o.showsCompleted} completed`}
        />
        <Metric
          label="Personal rating"
          value={o.count ? `${n(o.average)} /10` : "Unrated"}
          note={`${o.count} rated titles · zero included`}
        />
        <Metric
          label="Viewing time"
          value={
            r.time.hasData
              ? `${n(r.time.recorded + r.time.estimated)} h`
              : "Unknown"
          }
          note={`${n(r.time.recorded)} h recorded + ${n(r.time.estimated)} h estimated`}
        />
      </section>
      <nav className="analytics-tabs" aria-label="Analytics sections">
        {tabs.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {!o.total && (
        <div className="panel analytics-empty-library">
          <ChartNoAxesCombined size={30} />
          <h2>
            {source.data!.entries.some((e) => !e.deletedAt)
              ? "No stories match these filters."
              : "Every story starts somewhere."}
          </h2>
          <p>
            Add titles, record dates, and leave ratings to build your personal
            perspective.
          </p>
          <Link className="text-link" to="/movies/new">
            Add a movie ↗
          </Link>
        </div>
      )}
      <div className="analytics-section-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL PERSPECTIVE</span>
          <h2>{tab}</h2>
        </div>
        {["Activity", "Genres"].includes(tab) && yearPicker}
      </div>
      {tab === "Overview" && (
        <>
          <section className="analytics-metrics secondary">
            <Metric label="Currently watching" value={o.watching} />
            <Metric label="On your watchlist" value={o.watchlist} />
            <Metric label="Favorites" value={o.favorites} />
            <Metric label="Rated stories" value={o.count} />
          </section>
          <div className="analytics-chart-grid">
            {chart(
              "Your rating landscape",
              "Every rating retains its stored precision. Open data for exact counts.",
              o.histogram,
              ["count"],
            )}
            {chart(
              "Genres in your collection",
              "One title can belong to several genres; totals can exceed the collection size.",
              r.genres,
              ["count"],
              { horizontal: true, href: genreHref },
            )}
          </div>
          <Insights insights={r.insights} />
        </>
      )}
      {tab === "Activity" && (
        <>
          <p className="analytics-note">
            Movie bars count viewing events, including rewatches. Show bars
            count first-watch completion events; episodes remain separate.
            Unknown dates are excluded ({r.undated} undated events in this
            selection). Year-only dates contribute only to yearly charts.
          </p>
          <div className="analytics-chart-grid">
            {chart(
              "Watching activity by year",
              "Personal viewing years, never release or collection dates.",
              r.years,
              ["movies", "shows", "episodes"],
            )}
            {chart(
              `Monthly activity · ${activityYear}`,
              "Twelve months; year-only dates cannot be assigned to a month.",
              monthly,
              ["movies", "shows", "episodes"],
            )}
            {chart(
              `Activity trend · ${activityYear}`,
              "Recorded viewing and episode events by month.",
              monthly,
              ["movies", "shows", "episodes"],
              { line: true },
            )}
            <Heatmap events={r.events} year={activityYear} />
          </div>
        </>
      )}
      {tab === "Ratings" && (
        <>
          <section className="analytics-metrics secondary">
            {[
              ["Mean", n(o.average)],
              ["Median", n(o.median)],
              ["Highest", n(o.highest)],
              ["Lowest", n(o.lowest)],
              ["Rated ≥8", o.above8 === null ? "Unknown" : `${n(o.above8)}%`],
              ["Rated ≥9", o.above9 === null ? "Unknown" : `${n(o.above9)}%`],
            ].map(([label, value]) => (
              <Metric key={label} label={label} value={value} />
            ))}
          </section>
          <p className="analytics-note">
            Null is unrated; 0 is a real rating. Buckets are [0,1], (1,2], …,
            (9,10]. Calculations retain full precision; display uses up to one
            decimal (chart tables: two).
          </p>
          <div className="analytics-chart-grid">
            {chart(
              "Personal rating distribution",
              "Every valid 0–10 value belongs to exactly one bucket.",
              o.histogram,
              ["count"],
            )}
            {chart(
              "Movies & television",
              "Each media average shows its rated sample in the data table.",
              groupStats(r.items, (i) => [
                {
                  id: i.title.mediaType,
                  name: i.title.mediaType === "movie" ? "Movies" : "Television",
                },
              ]),
              ["average"],
            )}
            <RankedTitles
              title="Highest rated stories"
              items={rated.slice(0, 5)}
            />
            <RankedTitles
              title="At the other end of your scale"
              items={[...rated]
                .sort(
                  (a, b) =>
                    a.entry.personalRating! - b.entry.personalRating! ||
                    a.title.title.localeCompare(b.title.title),
                )
                .slice(0, 5)}
            />
          </div>
        </>
      )}
      {tab === "Genres" && (
        <>
          <p className="analytics-note">
            Each title counts once per associated genre. Highest-rated rankings
            require at least 3 rated titles; highlighted insights require 5.
            Sample sizes are available in every data table.
          </p>
          <div className="analytics-chart-grid">
            {chart(
              "Most watched genres",
              "Unique titles currently marked completed within the selection.",
              [...r.genres].sort((a, b) => b.completed - a.completed),
              ["completed"],
              { horizontal: true, href: genreHref },
            )}
            {chart(
              "Highest rated genres",
              "At least three personal ratings per genre.",
              r.genres
                .filter((g) => g.rated >= 3)
                .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
              ["average"],
              { horizontal: true, href: genreHref },
            )}
            {chart(
              "Genre distribution",
              "All selected titles, including watchlist records.",
              r.genres,
              ["count"],
              { horizontal: true, href: genreHref },
            )}
            {chart(
              "Genre preferences by media",
              "Multi-genre titles appear once in each associated genre.",
              r.genres,
              ["movies", "shows"],
              { horizontal: true, href: genreHref },
            )}
            {chart(
              `Genre activity · ${activityYear}`,
              "Unique titles with movie viewings or show completions in this personal viewing year.",
              genreTrends,
              ["count"],
              { horizontal: true, href: genreHref },
            )}
          </div>
        </>
      )}
      {tab === "Genres" &&
        selected!.genreYearKeys.length > 0 &&
        chart(
          "Genre trends by viewing year",
          "Up to five leading collection genres; unique titles with recorded personal viewing activity per year.",
          selected!.genreYears,
          selected!.genreYearKeys,
          { line: true },
        )}
      {tab === "People" && (
        <>
          <p className="analytics-note">
            People retain their local identities, including distinct people with
            the same name. Co-directed titles contribute to each person. Highest
            averages require at least 3 rated titles.
          </p>
          <div className="analytics-chart-grid">
            {(["directors", "creators"] as const).flatMap((role) => [
              chart(
                `Most watched ${role}`,
                "Unique completed titles; open the data table for collection counts and rated sample sizes.",
                [...r[role]].sort((a, b) => b.completed - a.completed),
                ["completed"],
                { horizontal: true },
              ),
              chart(
                `Highest rated ${role}`,
                "Three or more rated titles per person; ratings are personal.",
                r[role]
                  .filter((p) => p.rated >= 3)
                  .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
                ["average"],
                { horizontal: true },
              ),
            ])}
          </div>
        </>
      )}
      {tab === "Releases" && (
        <>
          <section className="analytics-metrics secondary">
            <Metric
              label="Oldest release"
              value={r.releases[0]?.name ?? "Unknown"}
            />
            <Metric
              label="Newest release"
              value={r.releases.at(-1)?.name ?? "Unknown"}
            />
            <Metric
              label="Leading decade"
              value={
                [...r.decades].sort((a, b) => b.count - a.count)[0]?.name ??
                "Unknown"
              }
            />
            <Metric label="Unknown release year" value={r.unknownRelease} />
          </section>
          <div className="analytics-chart-grid">
            {chart(
              "Release years",
              "Content release years, independent of your viewing dates.",
              r.releases,
              ["count"],
              { line: true },
            )}
            {chart(
              "Release decades",
              `${r.unknownRelease} titles with unknown release years excluded.`,
              r.decades,
              ["count"],
              {
                href: (row) =>
                  `/library?minYear=${row.id}&maxYear=${Number(row.id) + 9}`,
              },
            )}
            {chart(
              "Ratings by release decade",
              "Unrated titles do not contribute to the average.",
              r.decades,
              ["average"],
            )}
          </div>
        </>
      )}
      {tab === "Languages & countries" && (
        <div className="analytics-chart-grid">
          {chart(
            "Original languages",
            "Read from title metadata; language is never inferred.",
            r.languages,
            ["movies", "shows"],
            {
              horizontal: true,
              href: (row) =>
                String(row.id) === "unknown"
                  ? "/library"
                  : `/library?language=${encodeURIComponent(String(row.id))}`,
            },
          )}
          {chart(
            "Ratings by original language",
            "Unknown metadata stays unknown; sample sizes in data.",
            r.languages,
            ["average"],
            { horizontal: true },
          )}
          {chart(
            "Production countries",
            "Multi-country titles count once per country; totals can exceed the collection size.",
            r.countries,
            ["movies", "shows"],
            { horizontal: true },
          )}
          {chart(
            "Ratings by production country",
            "Production origin, not where you watched a title.",
            r.countries,
            ["average"],
            { horizontal: true },
          )}
        </div>
      )}
      {tab === "Television" && (
        <>
          <p className="analytics-note">
            Progress reflects current tracking for selected shows, even with a
            viewing-date filter. Specials follow each show’s existing setting.
            Approximate counts replace exact counts. Future episodes are
            excluded from time/activity and shown separately in progress totals;
            they are not overdue.
          </p>
          <section className="analytics-metrics secondary">
            <Metric label="Selected TV shows" value={r.tv.shows} />
            <Metric label="Known season records" value={r.tv.knownSeasons} />
            <Metric label="Completed seasons" value={r.tv.completedSeasons} />
            <Metric
              label="Watched episodes"
              value={r.tv.watchedEpisodes}
              note={`${r.tv.approximate} shows include approximate progress`}
            />
            <Metric
              label="Known episode total"
              value={
                r.tv.knownEpisodes || r.tv.unknownTotals
                  ? " " + (r.tv.knownEpisodes || "Unknown")
                  : 0
              }
              note={`${r.tv.unknownTotals} shows have unknown totals · ${r.tv.future} future episode records`}
            />
            <Metric
              label="Overall known progress"
              value={
                r.tv.percentage === null ? "Unknown" : `${n(r.tv.percentage)}%`
              }
            />
            <Metric label="Overall show rating" value={n(r.tv.showAverage)} />
            <Metric
              label="Season rating average"
              value={n(r.tv.seasonAverage)}
              note={`${r.tv.seasonRatingCount} rated seasons`}
            />
          </section>
          <div className="analytics-chart-grid">
            {chart(
              "Show status distribution",
              "Current personal status; completed never implies episode-level history.",
              [
                "completed",
                "watching",
                "watchlist",
                "on_hold",
                "dropped",
                "caught_up",
                "unknown",
              ].map((id) => ({
                name: id.replaceAll("_", " "),
                id,
                count: r.tv.statuses.find((s) => s.id === id)?.count ?? 0,
              })),
              ["count"],
              { href: statusHref },
            )}
            {chart(
              "Season completion",
              "Only seasons with known positive episode totals can be complete.",
              r.tv.knownSeasons
                ? [
                    { name: "Complete", count: r.tv.completedSeasons },
                    {
                      name: "Incomplete / unknown",
                      count: r.tv.knownSeasons - r.tv.completedSeasons,
                    },
                  ]
                : [],
              ["count"],
            )}
            {chart(
              "Episode progress",
              "Remaining known episodes may include future episodes; no lateness is inferred.",
              r.tv.shows
                ? [
                    {
                      name: "Watched (including approximate)",
                      count: r.tv.watchedEpisodes,
                    },
                    {
                      name: "Remaining in known totals",
                      count: r.tv.unknownTotals
                        ? null
                        : Math.max(
                            0,
                            r.tv.knownEpisodes - r.tv.watchedEpisodes,
                          ),
                    },
                  ]
                : [],
              ["count"],
            )}
            {chart(
              "Show & season rating distributions",
              "Separate samples: season ratings are never substituted for overall show ratings.",
              r.tv.ratings,
              ["shows", "seasons"],
            )}
            {chart(
              "TV genres watched",
              "Completed shows only.",
              r.genres.map((g) => ({
                ...g,
                completed: r.items.filter(
                  (i) =>
                    i.title.mediaType === "tv" &&
                    i.entry.status === "completed" &&
                    i.genreIds.includes(g.id),
                ).length,
              })),
              ["completed"],
              { horizontal: true, href: genreHref },
            )}
          </div>
        </>
      )}
      {tab === "Watch time" && (
        <>
          <section className="analytics-metrics secondary">
            <Metric
              label="Recorded hours"
              value={r.time.hasData ? n(r.time.recorded) : "Unknown"}
            />
            <Metric
              label="Estimated hours"
              value={r.time.hasData ? n(r.time.estimated) : "Unknown"}
            />
            <Metric
              label="Rewatch hours · mixed basis"
              value={
                r.events.some(
                  (e) =>
                    e.rewatch && (e.recorded !== null || e.estimated !== null),
                )
                  ? n(r.time.rewatch)
                  : "Unknown"
              }
            />
            <Metric label="Events without duration" value={r.time.excluded} />
          </section>
          <p className="analytics-note">
            Movie runtime estimates cover a completed first viewing only once,
            plus explicit rewatch sessions. TV runtime estimates use recorded
            watched episodes or approximate watched counts. A recorded
            whole-show first-viewing duration takes precedence over episode
            estimates to avoid overlap. Unknown durations remain unknown;
            undated time is excluded from year charts. Every runtime-based value
            is an estimate.
          </p>
          <div className="analytics-chart-grid">
            {chart(
              "Movies & TV · watching hours",
              "Recorded durations and runtime estimates are separate series.",
              r.time.hasData ? r.time.rows : [],
              ["recorded", "estimated"],
            )}
            {chart(
              "Watching hours by year",
              "Only durations with an actual personal viewing year.",
              r.years,
              ["recordedHours", "estimatedHours"],
            )}
            {chart(
              "Watching hours by genre",
              "Multi-genre viewing time appears in each genre; do not sum across genres.",
              selected!.timeByGenre,
              ["recorded", "estimated"],
              { horizontal: true },
            )}
          </div>
        </>
      )}
      {tab === "Rewatches" && (
        <>
          <section className="analytics-metrics secondary">
            <Metric label="Titles revisited" value={r.rewatchItems.length} />
            <Metric
              label="Recorded rewatch sessions"
              value={r.events.filter((e) => e.rewatch).length}
            />
          </section>
          <p className="analytics-note">
            Only explicitly recorded rewatch sessions count. Rating edits and
            episode progress do not imply a rewatch.
          </p>
          <div className="analytics-chart-grid">
            {chart(
              "Stories you return to",
              "Unique title identities with explicit rewatch sessions.",
              r.rewatchItems,
              ["count"],
              {
                horizontal: true,
                href: (row) => {
                  const item = r.items.find((i) => i.title.id === row.id);
                  return item ? titleHref(item) : "/library";
                },
              },
            )}
            {chart(
              "Rewatch activity by year",
              "Unknown dates are not assigned a year.",
              r.years,
              ["rewatches"],
            )}
          </div>
        </>
      )}
      {tab === "Compare years" && (
        <>
          <div className="analytics-year-pair">
            <label>
              First year
              <input
                aria-label="First comparison year"
                type="number"
                min="1"
                max="9999"
                value={yearA}
                onChange={(e) => setYearA(Number(e.target.value))}
              />
            </label>
            <span>compared with</span>
            <label>
              Second year
              <input
                aria-label="Second comparison year"
                type="number"
                min="1"
                max="9999"
                value={yearB}
                onChange={(e) => setYearB(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="analytics-note">
            Uses the current global selection. Set viewing dates to All time to
            compare complete years. Undated events are excluded. A year without
            recorded events does not establish that nothing was watched. Ratings
            are current ratings for titles viewed in each year, not historical
            rating snapshots.
          </p>
          <div className="analytics-table-scroll panel">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>{yearA}</th>
                  <th>{yearB}</th>
                  <th>Change from {yearA}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    "movies",
                    "shows",
                    "unique",
                    "average",
                    "recordedHours",
                    "estimatedHours",
                    "rewatches",
                  ] as const
                ).map((key) => (
                  <tr key={key}>
                    <th>
                      {
                        {
                          movies: "Movie viewing events",
                          shows: "Shows completed",
                          unique: "Unique titles with viewing activity",
                          average: "Current mean personal rating",
                          recordedHours: "Recorded hours",
                          estimatedHours: "Estimated hours",
                          rewatches: "Rewatch sessions",
                        }[key]
                      }
                    </th>
                    <td>{n(a[key] as number | null)}</td>
                    <td>{n(b[key] as number | null)}</td>
                    <td>
                      {typeof a[key] === "number" &&
                      Number(a[key]) !== 0 &&
                      typeof b[key] === "number"
                        ? `${n(((Number(b[key]) - Number(a[key])) / Number(a[key])) * 100)}%`
                        : "Not comparable"}
                    </td>
                  </tr>
                ))}
                <tr>
                  <th>Rated title sample</th>
                  <td>{a.rated}</td>
                  <td>{b.rated}</td>
                  <td>Current ratings</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="analytics-chart-grid">
            {chart(
              "Years side by side",
              "Movie viewings and completed shows are separate event types.",
              [a, b],
              ["movies", "shows"],
            )}
            {chart(
              "Watching hours comparison",
              "Known durations only; estimates shown separately.",
              [a, b],
              ["recordedHours", "estimatedHours"],
            )}
            {chart(
              "Genres across years",
              "Unique titles with viewing activity, counted once per associated genre.",
              selected!.compareGenres,
              [String(yearA), ...(yearA === yearB ? [] : [String(yearB)])],
              { horizontal: true },
            )}
          </div>
        </>
      )}
      {tab !== "Overview" && <Insights insights={r.insights} />}
      <p className="analytics-footer">
        Your records, your perspective. No invented dates or demo statistics.
        Download controls request a browser download; your browser decides where
        files are saved.
      </p>
    </div>
  );
}
function Insights({ insights }: { insights: string[] }) {
  return (
    <section className="panel analytics-insights">
      <div>
        <Sparkles size={20} />
        <span className="eyebrow">THREADS IN YOUR COLLECTION</span>
      </div>
      <h2>A few things worth noticing.</h2>
      {insights.length ? (
        <ul>
          {insights.slice(0, 8).map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ) : (
        <p>
          Add ratings, genres, and viewing dates to uncover factual insights.
          Every observation is calculated locally.
        </p>
      )}
    </section>
  );
}
function Heatmap({
  events,
  year,
}: {
  events: ReturnType<typeof calculateAnalytics>["events"];
  year: number;
}) {
  const days = new Map<string, number>();
  events
    .filter((e) => e.date.precision === "day")
    .forEach((e) => {
      const d = e.date.value!;
      days.set(d, (days.get(d) ?? 0) + 1);
    });
  const count = Math.round(
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000,
  );
  return (
    <section className="panel analytic-chart">
      <h3>Days with a story · {year}</h3>
      <p className="analytics-note">
        Exact-day viewing events only; blank days mean no recorded events.
      </p>
      <div
        className="analytics-heatmap"
        aria-label={`Daily viewing events in ${year}`}
      >
        {Array.from({ length: count }, (_, i) => {
          const day = new Date(Date.UTC(year, 0, i + 1))
              .toISOString()
              .slice(0, 10),
            value = days.get(day) ?? 0;
          return (
            <span
              key={day}
              title={`${day}: ${value} recorded events`}
              aria-label={`${day}: ${value} recorded events`}
              data-level={value === 0 ? 0 : value < 2 ? 1 : value < 4 ? 2 : 3}
            />
          );
        })}
      </div>
      <p className="analytics-note">
        January → December · darker to brighter: more recorded events.
      </p>
    </section>
  );
}
