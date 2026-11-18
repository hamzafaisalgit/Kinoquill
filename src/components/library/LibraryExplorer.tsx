import { SavedViewsBar } from "../personal/SavedViews";
import { AddToListButton } from "../personal/Lists";
import type { SavedView } from "../../types/personal";
import { journalPreferences } from "../../services/preferences";
import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  Columns3,
  Filter,
  Grid2X2,
  List,
  Plus,
  Search,
  Tags,
  X,
  Film,
  CheckSquare,
} from "lucide-react";
import type {
  LibraryItem,
  LibraryQuery,
  PaginatedResult,
  WatchStatus,
} from "../../types/domain";
import type { LibraryTarget, BulkAction } from "../../services/libraryService";
import {
  useCatalogQuery,
  useCategories,
  useGenres,
  useLibrary,
  useLibrarySummary,
} from "../../hooks/useCatalog";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { catalog } from "../../services/catalog";
import {
  COLUMNS,
  DEFAULT_LIBRARY_PREFERENCES,
  FILTER_KEYS,
  SORTS,
  STATUSES,
  libraryPreferences,
  parseLibraryParams,
} from "../../utils/libraryState";
import { PageHeader, EmptyState } from "../common/States";
import { MovieCard } from "../movies/MovieCard";
import { ContinueWatching } from "../shows/ContinueWatching";
import { LibraryFilters } from "./LibraryFilters";
import { LibraryTable } from "./LibraryTable";
import {
  AddTitleDialog,
  BulkActionDialog,
  CategoryManager,
  QuickEditDialog,
} from "./LibraryActions";
import "../../styles/library.css";
export type LibraryScope =
  "library" | "movies" | "shows" | "watchlist" | "favorites";
export function LibraryExplorer({
  scope = "library",
}: {
  scope?: LibraryScope;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    storage = useLocalStorage(),
    genres = useGenres(),
    categories = useCategories(),
    tags = useCatalogQuery(() => catalog.personal.tags(), []),
    summary = useLibrarySummary();
  const preferences = libraryPreferences(storage.settings.library);
  const [advanced, setAdvanced] = useState(false),
    [manage, setManage] = useState(false),
    [add, setAdd] = useState(false);
  const options = useCatalogQuery(() => catalog.library.getFilterOptions(), []);
  const query: LibraryQuery = {
    ...parseLibraryParams(params),
    pageSize: params.has("size")
      ? parseLibraryParams(params).pageSize
      : journalPreferences(storage.settings.journal).pageSize,
    sort: parseLibraryParams(params).sort ?? preferences.sort,
    ...(scope === "movies"
      ? { mediaType: "movie", mediaSubtype: undefined }
      : scope === "shows"
        ? {
            mediaType: "tv",
            mediaSubtype:
              params.get("type") === "tv_miniseries"
                ? "tv_miniseries"
                : undefined,
          }
        : scope === "watchlist"
          ? { status: "watchlist" }
          : scope === "favorites"
            ? { favorite: true }
            : {}),
  };
  const result = useLibrary(query),
    queryKey = JSON.stringify([scope, query]);
  const view =
    params.get("view") === "table"
      ? "table"
      : params.get("view") === "grid"
        ? "grid"
        : preferences.view;
  const encoded = params.toString();
  const savedParams = new URLSearchParams(params);
  savedParams.set("size", String(query.pageSize));
  useEffect(() => {
    if (!genres.data || !categories.data || !tags.data) return;
    const next = new URLSearchParams(encoded);
    let changed = false;
    for (const [key, ids] of [
      ["genre", genres.data.map((row) => row.id)],
      ["tag", tags.data.map((row) => row.id)],
      ["category", categories.data.map((row) => row.id)],
    ] as const) {
      const valid = next.getAll(key).filter((id) => ids.includes(id));
      if (valid.length !== next.getAll(key).length) {
        next.delete(key);
        valid.forEach((id) => next.append(key, id));
        changed = true;
      }
    }
    if (changed) {
      next.delete("page");
      setParams(next, { replace: true });
    }
  }, [encoded, genres.data, categories.data, tags.data, setParams]);
  const update = useCallback(
    (key: string, value: string) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete(key);
        if (value) next.set(key, value);
        if (key !== "page") next.delete("page");
        return next;
      }),
    [setParams],
  );
  const setSearch = useCallback(
    (value: string) => update("q", value.trim()),
    [update],
  );
  function clearFilters() {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      FILTER_KEYS.forEach((key) => next.delete(key));
      next.delete("page");
      return next;
    });
  }
  const chips = [...params.entries()]
    .filter(
      ([key]) =>
        FILTER_KEYS.includes(key) &&
        !["genreMatch", "categoryMatch"].includes(key) &&
        !(scope === "movies" && key === "type") &&
        !(scope === "watchlist" && key === "status") &&
        !(scope === "favorites" && key === "favorite"),
    )
    .map(([key, value]) => ({
      key,
      value,
      label:
        key === "tag"
          ? `Tag: ${tags.data?.find((t) => t.id === value)?.name ?? "Missing tag"}`
          : key === "genre"
            ? `Genre: ${genres.data?.find((row) => row.id === value)?.name ?? "Missing genre"}`
            : key === "category"
              ? `Category: ${categories.data?.find((row) => row.id === value)?.name ?? "Missing category"}`
              : key === "q"
                ? `Search: ${value}`
                : key === "status"
                  ? (STATUSES.find((row) => row.value === value)?.label ??
                    value)
                  : key === "type"
                    ? value === "movie"
                      ? "Movies"
                      : value === "tv"
                        ? "TV shows"
                        : "TV Mini Series"
                    : key === "unrated"
                      ? "Unrated only"
                      : key === "favorite"
                        ? "Favorites only"
                        : `${key.replace(/([A-Z])/g, " $1")}: ${value}`,
    }));
  const title =
    scope === "library"
      ? "My Library"
      : scope === "movies"
        ? "Your kind of cinema."
        : scope === "shows"
          ? "Stories that stay awhile."
          : scope === "watchlist"
            ? "For another evening."
            : "The ones that stay.";
  return (
    <>
      <PageHeader
        eyebrow="KINOQUILL · THE PERSONAL COLLECTION"
        title={title}
        description={
          scope === "library"
            ? "Every film, every series, and your own point of view."
            : scope === "watchlist"
              ? "Stories you’re looking forward to, ready when you are."
              : scope === "favorites"
                ? "Your favorite films and shows, kept close."
                : "A collection to browse, shape, and make your own."
        }
        action={
          scope === "movies" || scope === "shows" ? (
            <Link
              className="button"
              to={scope === "movies" ? "/movies/new" : "/shows/new"}
            >
              <Plus size={15} />
              {scope === "movies" ? "Add movie" : "Add TV show"}
            </Link>
          ) : (
            <button className="button" onClick={() => setAdd(true)}>
              <Plus size={15} />
              Add title
            </button>
          )
        }
      />
      <div className="library-stats" aria-label="Active library counts">
        <span>
          <strong>
            {summary.data ? summary.data.movies + summary.data.shows : "—"}
          </strong>{" "}
          titles
        </span>
        <span>
          <strong>{summary.data?.movies ?? "—"}</strong> movies
        </span>
        <span>
          <strong>{summary.data?.shows ?? "—"}</strong> shows
        </span>
        <Link to="/watchlist">
          {summary.data?.watchlist ?? "—"} on watchlist
        </Link>
        <Link to="/favorites">{summary.data?.favorites ?? "—"} favorites</Link>
      </div>
      <SavedViewsBar
        route={("/" + scope) as SavedView["route"]}
        params={savedParams}
        display={{ ...preferences, view, sort: query.sort! }}
        onTag={(value) => update("tag", value)}
      />
      {scope === "shows" && <ContinueWatching />}
      <section
        className="panel library-toolbar"
        aria-label="Collection controls"
      >
        <div className="library-toolbar-main">
          <LibrarySearch
            query={params.get("q") ?? ""}
            onSearch={setSearch}
            focus={params.get("focus") === "search"}
          />
          <button
            className="secondary-button"
            onClick={() => setAdvanced(true)}
          >
            <Filter size={14} />
            Filters
            {chips.length > 0 && (
              <span className="library-filter-count">{chips.length}</span>
            )}
          </button>
          <div
            className="library-view-toggle"
            role="group"
            aria-label="Collection view"
          >
            {(["grid", "table"] as const).map((mode) => (
              <button
                key={mode}
                aria-label={mode === "grid" ? "Poster grid view" : "Table view"}
                aria-pressed={view === mode}
                disabled={storage.phase !== "ready" || storage.saving}
                onClick={() => {
                  update("view", mode);
                  void storage.updateSettings({
                    library: { ...preferences, view: mode },
                  });
                }}
              >
                {mode === "grid" ? <Grid2X2 size={17} /> : <List size={17} />}
              </button>
            ))}
          </div>
        </div>
        <div className="library-toolbar-secondary">
          <label>
            Media
            <select
              aria-label="Filter media type"
              disabled={scope === "movies"}
              value={
                scope === "movies"
                  ? "movie"
                  : scope === "shows"
                    ? params.get("type") === "tv_miniseries"
                      ? "tv_miniseries"
                      : "tv"
                    : (params.get("type") ?? "")
              }
              onChange={(event) => update("type", event.target.value)}
            >
              {scope !== "shows" && <option value="">All titles</option>}
              {scope !== "shows" && <option value="movie">Movies</option>}
              <option value="tv">TV shows</option>
              <option value="tv_miniseries">TV Mini Series</option>
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Filter watch status"
              disabled={scope === "watchlist"}
              value={
                scope === "watchlist"
                  ? "watchlist"
                  : (params.get("status") ?? "")
              }
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {scope === "movies" && option.value === "completed"
                    ? "Watched"
                    : scope === "shows" && option.value === "completed"
                      ? "Completed"
                      : option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Genre
            <select
              aria-label="Filter genre"
              value={
                params.getAll("genre").length === 1
                  ? (params.get("genre") ?? "")
                  : ""
              }
              onChange={(event) => update("genre", event.target.value)}
            >
              <option value="">
                {params.getAll("genre").length > 1
                  ? `${params.getAll("genre").length} selected · ${params.get("genreMatch") ?? "any"}`
                  : "All genres"}
              </option>
              {genres.data?.map((genre) => (
                <option value={genre.id} key={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </label>
          <label className="library-sort">
            Sort
            <select
              aria-label="Sort collection"
              disabled={storage.saving}
              value={query.sort}
              onChange={(event) => {
                const sort = event.target.value as typeof preferences.sort;
                update("sort", sort);
                void storage.updateSettings({
                  library: { ...preferences, sort },
                });
              }}
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="text-button" onClick={() => setManage(true)}>
            <Tags size={14} />
            Manage categories
          </button>
          <Link
            className="text-link library-export-link"
            to={`/import-export?from=${encodeURIComponent(location.pathname + location.search)}`}
          >
            Export results
          </Link>
          {view === "table" && (
            <details className="library-column-picker">
              <summary>
                <Columns3 size={14} />
                Columns
              </summary>
              <div>
                {COLUMNS.map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={preferences.columns.includes(key)}
                      disabled={
                        key === "title" ||
                        storage.phase !== "ready" ||
                        storage.saving
                      }
                      onChange={(event) =>
                        void storage.updateSettings({
                          library: {
                            ...preferences,
                            columns: event.target.checked
                              ? [...preferences.columns, key]
                              : preferences.columns.filter(
                                  (column) => column !== key,
                                ),
                          },
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
                <button
                  className="text-button"
                  disabled={storage.saving}
                  onClick={() =>
                    void storage.updateSettings({
                      library: {
                        ...preferences,
                        columns: DEFAULT_LIBRARY_PREFERENCES.columns,
                      },
                    })
                  }
                >
                  Reset columns
                </button>
              </div>
            </details>
          )}
        </div>
      </section>
      {chips.length > 0 && (
        <div className="library-filter-chips" aria-label="Active filters">
          {chips.map(({ key, value, label }) => (
            <button
              key={`${key}:${value}`}
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete(key, value);
                  next.delete("page");
                  return next;
                })
              }
            >
              {label}
              <X size={11} />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button className="text-button" onClick={clearFilters}>
            Clear all filters
          </button>
        </div>
      )}
      <div className="library-results-heading">
        <span role="status">
          {result.isLoading
            ? "Opening your local collection…"
            : result.error
              ? "Collection unavailable"
              : `${result.data?.total ?? 0} results · ${view === "grid" ? "Poster view" : "Table view"}`}
        </span>
        <button
          className="text-button"
          disabled={storage.saving}
          onClick={() => {
            setParams(new URLSearchParams());
            void storage.updateSettings({
              library: DEFAULT_LIBRARY_PREFERENCES,
            });
          }}
        >
          Reset view
        </button>
      </div>
      {result.isLoading ? (
        <div className="library-skeleton-grid" aria-label="Loading library">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="library-skeleton" />
          ))}
        </div>
      ) : result.error ? (
        <section className="panel">
          <EmptyState
            icon={Film}
            title="The collection could not be opened."
            description={result.error.message}
          >
            <button className="button" onClick={clearFilters}>
              Reset filters
            </button>
          </EmptyState>
        </section>
      ) : result.data?.items.length ? (
        <LibraryResults
          key={queryKey}
          data={result.data}
          view={view}
          columns={preferences.columns}
          sort={query.sort!}
          onSort={(sort) => {
            update("sort", sort);
            void storage.updateSettings({ library: { ...preferences, sort } });
          }}
          returnTo={location.pathname + location.search}
        />
      ) : (
        <section className="panel library-empty">
          <EmptyState
            icon={scope === "favorites" ? Tags : Film}
            title={
              chips.length
                ? "No stories match this selection."
                : scope === "favorites"
                  ? "Keep the stories you love close."
                  : scope === "watchlist"
                    ? "Something to look forward to."
                    : (query.page ?? 1) > 1
                      ? "You’ve reached the end of this collection."
                      : "Your collection begins with one story."
            }
            description={
              chips.length
                ? "Try a different search or remove a filter. Your saved records have not changed."
                : scope === "favorites"
                  ? "Mark a movie or show as a favorite to gather it here."
                  : scope === "watchlist"
                    ? "Save a title with Watchlist status. Start watching later without creating another record."
                    : "Add a movie or TV show, from TMDB or in your own words."
            }
          >
            {chips.length ? (
              <button className="button" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (query.page ?? 1) > 1 ? (
              <button className="button" onClick={() => update("page", "1")}>
                First page
              </button>
            ) : (
              <button className="button" onClick={() => setAdd(true)}>
                Add a title
              </button>
            )}
          </EmptyState>
        </section>
      )}
      {result.data && result.data.totalPages > 1 && (
        <div className="movie-pagination">
          <button
            className="secondary-button"
            disabled={result.data.page <= 1}
            onClick={() => update("page", String(result.data!.page - 1))}
          >
            Previous
          </button>
          <span>
            Page {result.data.page} of {result.data.totalPages} ·{" "}
            {query.pageSize} per page
          </span>
          <button
            className="secondary-button"
            disabled={result.data.page >= result.data.totalPages}
            onClick={() => update("page", String(result.data!.page + 1))}
          >
            Next
          </button>
        </div>
      )}
      {advanced && (
        <LibraryFilters
          params={params}
          genres={genres.data ?? []}
          categories={categories.data ?? []}
          languages={options.data?.languages ?? []}
          countries={options.data?.countries ?? []}
          onApply={(next) => setParams(next)}
          onClose={() => setAdvanced(false)}
        />
      )}
      {manage && (
        <CategoryManager
          onClose={() => setManage(false)}
          onView={(id) =>
            navigate(`/library?category=${encodeURIComponent(id)}`)
          }
        />
      )}
      {(add || params.get("add") === "1") && (
        <AddTitleDialog
          onClose={() => {
            setAdd(false);
            if (params.has("add")) update("add", "");
          }}
        />
      )}
    </>
  );
}
function LibrarySearch({
  query,
  onSearch,
  focus,
}: {
  query: string;
  onSearch: (value: string) => void;
  focus: boolean;
}) {
  const [draft, setDraft] = useState(query),
    [previous, setPrevious] = useState(query);
  if (previous !== query) {
    setPrevious(query);
    setDraft(query);
  }
  useEffect(() => {
    if (draft.trim() === query) return;
    const timer = setTimeout(() => onSearch(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, query, onSearch]);
  return (
    <label className="library-search">
      <Search size={17} />
      <span className="sr-only">Search my library</span>
      <input
        autoFocus={focus}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search titles, people, genres, your words…"
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear library search"
          onClick={() => {
            setDraft("");
            onSearch("");
          }}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function LibraryResults({
  data,
  view,
  columns,
  sort,
  onSort,
  returnTo,
}: {
  data: PaginatedResult<LibraryItem>;
  view: "grid" | "table";
  columns: typeof DEFAULT_LIBRARY_PREFERENCES.columns;
  sort: NonNullable<LibraryQuery["sort"]>;
  onSort: (sort: NonNullable<LibraryQuery["sort"]>) => void;
  returnTo: string;
}) {
  const [selection, setSelection] = useState<LibraryTarget[]>([]),
    [selecting, setSelecting] = useState(false),
    [edit, setEdit] = useState<{
      item: LibraryItem;
      status?: WatchStatus;
    } | null>(null),
    [bulk, setBulk] = useState<BulkAction["kind"] | null>(null);
  const visible = new Set(data.items.map((item) => item.entry.id)),
    targets = selection.filter((row) => visible.has(row.id)),
    selected = new Set(targets.map((row) => row.id));
  function toggle(id: string) {
    const item = data.items.find((item) => item.entry.id === id);
    if (!item) return;
    setSelection(
      selected.has(id)
        ? targets.filter((row) => row.id !== id)
        : [...targets, { id, revision: item.entry.revision }],
    );
  }
  return (
    <>
      <div className="library-selection-tools">
        <button
          className="text-button"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting(!selecting);
            setSelection([]);
          }}
        >
          <CheckSquare size={14} />
          {selecting ? "Exit selection" : "Select titles"}
        </button>
        {(selecting || view === "table") && (
          <>
            <label>
              <input
                type="checkbox"
                checked={targets.length === data.items.length}
                onChange={(event) =>
                  setSelection(
                    event.target.checked
                      ? data.items.map((item) => ({
                          id: item.entry.id,
                          revision: item.entry.revision,
                        }))
                      : [],
                  )
                }
              />
              Select visible page ({data.items.length})
            </label>
            <span>{targets.length} selected</span>
            {targets.length > 0 && (
              <button className="text-button" onClick={() => setSelection([])}>
                Clear selection
              </button>
            )}
          </>
        )}
      </div>
      {targets.length > 0 && (
        <div className="panel library-bulk-toolbar" aria-label="Bulk actions">
          <strong>{targets.length} selected · current page only</strong>
          <AddToListButton
            titleIds={data.items
              .filter((i) => selected.has(i.entry.id))
              .map((i) => i.title.id)}
            label="Add selected to list"
          />
          <div>
            {(
              [
                ["category_add", "Add category"],
                ["category_remove", "Remove category"],
                ["favorite", "Favorite flag"],
                ["status", "Change status"],
                ["archive", "Archive"],
              ] as const
            ).map(([kind, label]) => (
              <button
                className="secondary-button"
                key={kind}
                onClick={() => setBulk(kind)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {view === "table" ? (
        <LibraryTable
          items={data.items}
          columns={columns}
          selected={selected}
          toggle={toggle}
          edit={(item, status) => setEdit({ item, status })}
          sort={sort}
          onSort={onSort}
          returnTo={returnTo}
        />
      ) : (
        <section
          className="movie-grid library-grid"
          aria-label="Library poster collection"
        >
          {data.items.map((item) => (
            <div
              className={`library-grid-item ${selected.has(item.entry.id) ? "is-selected" : ""}`}
              key={item.entry.id}
            >
              {selecting && (
                <label className="library-card-select">
                  <input
                    type="checkbox"
                    checked={selected.has(item.entry.id)}
                    onChange={() => toggle(item.entry.id)}
                    aria-label={`Select ${item.title.title}`}
                  />
                </label>
              )}
              <MovieCard item={item} returnTo={returnTo} />
              <div className="library-card-footer">
                <span>
                  {item.title.mediaType === "movie"
                    ? "Movie"
                    : item.title.mediaSubtype === "tv_miniseries"
                      ? "TV Mini Series"
                      : "TV Series"}
                </span>
                <button
                  className="text-button"
                  onClick={() => setEdit({ item })}
                  aria-label={`Quick edit ${item.title.title}`}
                >
                  Quick edit
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {edit && (
        <QuickEditDialog
          item={edit.item}
          initialStatus={edit.status}
          onClose={() => setEdit(null)}
        />
      )}
      {bulk && (
        <BulkActionDialog
          targets={targets}
          action={bulk}
          onClose={() => setBulk(null)}
          onSaved={() => setSelection([])}
        />
      )}
    </>
  );
}
