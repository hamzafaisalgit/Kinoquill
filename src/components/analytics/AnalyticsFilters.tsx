import type {
  AnalyticsFilters as Filters,
  AnalyticsSnapshot,
} from "../../analytics/types";
import { DEFAULT_FILTERS } from "../../analytics/types";
import { STATUSES } from "../../utils/libraryState";
export function AnalyticsFilters({
  value: f,
  onChange,
  snapshot,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
  snapshot: AnalyticsSnapshot;
}) {
  const set = (key: keyof Filters, value: string | string[]) =>
    onChange({ ...f, [key]: value });
  return (
    <details className="panel analytics-filters" open>
      <summary>
        Shape your perspective{" "}
        <span>Media, viewing dates & collection filters</span>
      </summary>
      <div className="analytics-filter-grid">
        <label>
          Media type
          <select
            value={f.media}
            onChange={(e) => set("media", e.target.value)}
          >
            <option value="all">All stories</option>
            <option value="movie">Movies</option>
            <option value="tv">TV shows & miniseries</option>
          </select>
        </label>
        <label>
          Personal viewing date
          <select value={f.date} onChange={(e) => set("date", e.target.value)}>
            <option value="all">All time</option>
            <option value="this">This year</option>
            <option value="previous">Previous year</option>
            <option value="year">Custom year</option>
            <option value="range">Custom range</option>
          </select>
        </label>
        {f.date === "year" && (
          <label>
            Viewing year
            <input
              type="number"
              min="1"
              max="9999"
              value={f.year}
              onChange={(e) => set("year", e.target.value)}
            />
          </label>
        )}
        {f.date === "range" && (
          <>
            <label>
              Viewed from
              <input
                type="date"
                value={f.from}
                onChange={(e) => set("from", e.target.value)}
              />
            </label>
            <label>
              Viewed through
              <input
                type="date"
                value={f.to}
                onChange={(e) => set("to", e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Watch status
          <select
            value={f.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rating availability
          <select
            value={f.rating}
            onChange={(e) => set("rating", e.target.value)}
          >
            <option value="all">Rated & unrated</option>
            <option value="rated">Rated only</option>
            <option value="unrated">Unrated only</option>
          </select>
        </label>
        {(["minYear", "maxYear", "minRating", "maxRating"] as const).map(
          (key, i) => (
            <label key={key}>
              {
                [
                  "Release year from",
                  "Release year through",
                  "Personal rating from",
                  "Personal rating through",
                ][i]
              }
              <input
                type="number"
                min={i < 2 ? 1 : 0}
                max={i < 2 ? 9999 : 10}
                step={i < 2 ? 1 : "any"}
                placeholder="Any"
                value={f[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ),
        )}
        <label>
          Genres · match any
          <select
            multiple
            value={f.genreIds}
            onChange={(e) =>
              set(
                "genreIds",
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
          >
            {snapshot.genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categories · match any
          <select
            multiple
            value={f.categoryIds}
            onChange={(e) =>
              set(
                "categoryIds",
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
          >
            {snapshot.categories.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="analytics-filter-foot">
        <p>
          Use Ctrl / ⌘ to select multiple options. Viewing filters require a
          recorded viewing event. Unknown dates are excluded; partial dates must
          fit the entire range.
        </p>
        <button
          className="button button-secondary"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          Reset filters
        </button>
      </div>
    </details>
  );
}
