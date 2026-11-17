import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Pencil, ArrowUpDown } from "lucide-react";
import type { LibraryItem, LibrarySort, WatchStatus } from "../../types/domain";
import type { ColumnId } from "../../utils/libraryState";
import { COLUMNS, STATUSES, titleHref } from "../../utils/libraryState";
import { PosterArtwork } from "../discovery/PosterArtwork";
import { catalog } from "../../services/catalog";
import { toast } from "sonner";
export function LibraryTable({
  items,
  columns,
  selected,
  toggle,
  edit,
  sort,
  onSort,
  returnTo,
}: {
  items: LibraryItem[];
  columns: ColumnId[];
  selected: Set<string>;
  toggle: (id: string) => void;
  edit: (item: LibraryItem, status?: WatchStatus) => void;
  sort: LibrarySort;
  onSort: (sort: LibrarySort) => void;
  returnTo: string;
}) {
  const visible = COLUMNS.filter(([key]) => columns.includes(key));
  const sortKeys: Partial<Record<ColumnId, [LibrarySort, LibrarySort]>> = {
    title: ["title_asc", "title_desc"],
    year: ["year_desc", "year_asc"],
    rating: ["rating_desc", "rating_asc"],
    watched: ["watched_desc", "watched_asc"],
    added: ["newest", "oldest"],
  };
  return (
    <div
      className="library-table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Library table, scroll horizontally for more columns"
    >
      <table
        className="library-table"
        style={{ minWidth: Math.max(420, visible.length * 118) }}
      >
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Select title</span>
            </th>
            {visible.map(([key, label]) => (
              <th
                key={key}
                scope="col"
                aria-sort={
                  sortKeys[key]?.includes(sort)
                    ? sort.endsWith("asc") || sort === "oldest"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {sortKeys[key] ? (
                  <button
                    onClick={() => {
                      const values = sortKeys[key]!;
                      onSort(sort === values[0] ? values[1] : values[0]);
                    }}
                  >
                    {label}
                    <ArrowUpDown size={11} />
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.entry.id}
              className={selected.has(item.entry.id) ? "is-selected" : ""}
            >
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title.title}`}
                  checked={selected.has(item.entry.id)}
                  onChange={() => toggle(item.entry.id)}
                />
              </td>
              {visible.map(([key]) => (
                <td key={key}>
                  {key === "poster" ? (
                    <Link
                      to={titleHref(item)}
                      state={{ returnTo }}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <PosterArtwork
                        path={item.title.posterPath}
                        title={item.title.title}
                        allowExternal
                      />
                    </Link>
                  ) : key === "title" ? (
                    <Link
                      className="library-table-title"
                      to={titleHref(item)}
                      state={{ returnTo }}
                    >
                      {item.title.title}
                      {item.title.originalTitle &&
                        item.title.originalTitle !== item.title.title && (
                          <small>{item.title.originalTitle}</small>
                        )}
                    </Link>
                  ) : key === "type" ? (
                    <span className="library-type">
                      {item.title.mediaType === "movie"
                        ? "Movie"
                        : item.title.mediaSubtype === "tv_miniseries"
                          ? "TV Mini Series"
                          : "TV Series"}
                    </span>
                  ) : key === "year" ? (
                    (item.title.releaseYear ?? "—")
                  ) : key === "genres" ? (
                    (item.genres ?? []).map((row) => row.name).join(", ") || "—"
                  ) : key === "people" ? (
                    (item.people ?? []).map((row) => row.name).join(", ") || "—"
                  ) : key === "rating" ? (
                    <button
                      className="library-inline-rating"
                      aria-label={`Edit personal rating for ${item.title.title}`}
                      onClick={() => edit(item)}
                    >
                      {item.entry.personalRating ?? "Unrated"}
                      <Pencil size={10} />
                    </button>
                  ) : key === "status" ? (
                    <select
                      aria-label={`Watch status for ${item.title.title}`}
                      value={item.entry.status}
                      onChange={(event) =>
                        edit(item, event.target.value as WatchStatus)
                      }
                    >
                      {STATUSES.filter(
                        (option) =>
                          option.value !== "unknown" ||
                          item.entry.status === "unknown",
                      )
                        .filter(
                          (option) =>
                            option.value !== "caught_up" ||
                            item.title.mediaType === "tv" ||
                            item.entry.status === "caught_up",
                        )
                        .map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.value === "completed"
                              ? item.title.mediaType === "movie"
                                ? "Watched"
                                : "Completed"
                              : option.label}
                          </option>
                        ))}
                    </select>
                  ) : key === "watched" ? (
                    <span>
                      {item.watchedDate?.value ?? "Not recorded"}
                      {item.watchedDate &&
                        ["month", "year"].includes(
                          item.watchedDate.precision,
                        ) && <small>{item.watchedDate.precision} only</small>}
                    </span>
                  ) : key === "favorite" ? (
                    <FavoriteCell item={item} />
                  ) : key === "categories" ? (
                    <button className="text-button" onClick={() => edit(item)}>
                      {(item.categories ?? [])
                        .map((row) => row.name)
                        .join(", ") || "Assign categories"}
                    </button>
                  ) : key === "added" ? (
                    item.entry.dateAdded.slice(0, 10)
                  ) : (
                    <div className="library-row-actions">
                      <Link
                        className="text-link"
                        to={titleHref(item)}
                        state={{ returnTo }}
                      >
                        Details
                      </Link>
                      <button
                        className="text-button"
                        onClick={() => edit(item)}
                      >
                        Quick edit
                      </button>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function FavoriteCell({ item }: { item: LibraryItem }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`library-favorite ${item.entry.isFavorite ? "active" : ""}`}
      disabled={busy}
      aria-pressed={item.entry.isFavorite}
      aria-label={`${item.entry.isFavorite ? "Unfavorite" : "Favorite"} ${item.title.title}`}
      onClick={async () => {
        setBusy(true);
        try {
          await catalog.library.quickUpdate(
            { id: item.entry.id, revision: item.entry.revision },
            { isFavorite: !item.entry.isFavorite },
          );
        } catch {
          toast.error(
            "Favorite could not be saved. Refresh the record and try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart size={16} fill={item.entry.isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
