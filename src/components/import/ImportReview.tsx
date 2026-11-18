import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type {
  ImportPlan,
  ImportRow,
  ParsedFile,
  SheetConfig,
} from "../../types/imports";
import type {
  DiscoveryMetadata,
  SearchResult,
} from "../../services/tmdb/types";
import { Dialog } from "../common/Dialog";
import {
  UPDATE_FIELDS,
  validateApprovedUpdate,
} from "../../services/import/importService";
import { strongMatch } from "../../services/import/duplicateResolver";
import {
  enrichmentCandidates,
  enrichmentDetails,
} from "../../services/import/enrichment";
import { FIELDS, visibleColumns } from "../../services/import/columnMapper";
export function ImportReview({
  plan,
  onRow,
  onSkip,
  enrichment,
  file,
  configs,
  onEdit,
  onEnriched,
}: {
  plan: ImportPlan;
  onRow: (row: ImportRow) => void;
  onSkip: (ids: string[]) => void;
  enrichment: boolean;
  file: ParsedFile;
  configs: SheetConfig[];
  onEdit: (sheet: string, row: number, values: Record<number, string>) => void;
  onEnriched: (
    row: ImportRow,
    details: DiscoveryMetadata,
    people: boolean,
  ) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("source"),
    [selected, setSelected] = useState<string[]>([]),
    [duplicate, setDuplicate] = useState<string | null>(null),
    [edit, setEdit] = useState<string | null>(null),
    [enrich, setEnrich] = useState<string | null>(null);
  const rows = plan.rows
      .filter(
        (row) =>
          (!search ||
            `${row.data.metadata.title} ${row.sheet}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (filter === "all" ||
            (filter === "errors" &&
              row.issues.some((issue) => issue.severity === "error")) ||
            (filter === "warnings" &&
              !row.issues.some((issue) => issue.severity === "error") &&
              row.issues.some((issue) => issue.severity === "warning")) ||
            (filter === "valid" && !row.issues.length) ||
            (filter === "duplicates" &&
              (row.matches.length || row.fileMatches.length))),
      )
      .sort((a, b) =>
        sort === "source"
          ? 0
          : a.data.metadata.title.localeCompare(b.data.metadata.title) *
            (sort === "desc" ? -1 : 1),
      ),
    visible = rows.slice((page - 1) * 25, page * 25),
    current = (id: string | null) => plan.rows.find((row) => row.id === id);
  return (
    <>
      <div className="import-preview-toolbar">
        <label>
          Search preview
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Title or sheet name"
          />
        </label>
        <label>
          Show
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            {["all", "valid", "warnings", "errors", "duplicates"].map(
              (value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Order
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="source">Source order</option>
            <option value="asc">Title A–Z</option>
            <option value="desc">Title Z–A</option>
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={!selected.length}
          onClick={() => {
            onSkip(selected);
            setSelected([]);
          }}
        >
          Skip {selected.length} selected rows
        </button>
      </div>
      <div
        className="import-preview-scroll"
        role="region"
        aria-label="Import preview table, scroll horizontally"
        tabIndex={0}
      >
        <table className="import-preview-table">
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Select visible preview rows"
                  type="checkbox"
                  checked={
                    visible.length > 0 &&
                    visible.every((row) => selected.includes(row.id))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? visible.map((row) => row.id) : [],
                    )
                  }
                />
              </th>
              {[
                "Source",
                "Title",
                "Type / year",
                "Genres",
                "My rating",
                "Status",
                "Validation / duplicate",
                "Action",
                "Review",
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const errors = row.issues.some(
                  (issue) => issue.severity === "error",
                ),
                dupe = row.matches.length > 0 || row.fileMatches.length > 0;
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      aria-label={`Select source row ${row.row} in ${row.sheet}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, row.id]
                            : selected.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    {row.sheet}
                    <small>Row {row.row}</small>
                  </td>
                  <td>
                    <strong>
                      {row.data.metadata.title || "Missing title"}
                    </strong>
                  </td>
                  <td>
                    {row.data.metadata.mediaSubtype.replaceAll("_", " ")}
                    <small>
                      {row.data.metadata.releaseYear ?? "Year unknown"}
                    </small>
                  </td>
                  <td>{row.data.genres.join(", ") || "Not recorded"}</td>
                  <td>{row.data.library.personalRating ?? "Unrated"}</td>
                  <td>{row.data.library.status?.replaceAll("_", " ")}</td>
                  <td>
                    <span
                      className={`import-badge ${errors ? "has-errors" : row.issues.length ? "has-warnings" : "is-valid"}`}
                    >
                      {errors
                        ? "Errors"
                        : row.issues.length
                          ? "Warnings"
                          : "Valid"}
                    </span>
                    {dupe && (
                      <span className="import-badge has-duplicates">
                        Duplicate review
                      </span>
                    )}
                    <small>{row.issues.length} notices</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Import action for ${row.data.metadata.title || `row ${row.row}`}`}
                      value={row.action}
                      disabled={errors}
                      onChange={(event) => {
                        const action = event.target
                          .value as ImportRow["action"];
                        if (action === "update") {
                          setDuplicate(row.id);
                          return;
                        }
                        onRow({ ...row, action });
                      }}
                    >
                      <option value="skip">Skip</option>
                      <option value="add">Add new</option>
                      <option
                        value="separate"
                        disabled={row.matches.some((match) =>
                          strongMatch(row, match),
                        )}
                      >
                        Separate · confirm distinct
                      </option>
                      <option value="update" disabled={!row.matches.length}>
                        Update approved fields…
                      </option>
                    </select>
                  </td>
                  <td>
                    <div className="import-row-actions">
                      <button
                        className="text-button"
                        onClick={() => setDuplicate(row.id)}
                      >
                        Review row{dupe ? " / match" : ""}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setEdit(row.id)}
                      >
                        Edit source values
                      </button>
                      {enrichment && (
                        <button
                          className="text-button"
                          disabled={errors || !row.data.metadata.title}
                          onClick={() => setEnrich(row.id)}
                        >
                          Find missing metadata
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="preference-note">No rows match this preview filter.</p>
      )}
      <div className="movie-pagination">
        <button
          className="secondary-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>
          {rows.length} matching rows · page {page} of{" "}
          {Math.max(1, Math.ceil(rows.length / 25))}
        </span>
        <button
          className="secondary-button"
          disabled={page >= Math.ceil(rows.length / 25)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
      {current(duplicate) && (
        <DuplicateDecision
          row={current(duplicate)!}
          onClose={() => setDuplicate(null)}
          onSave={(row) => {
            onRow(row);
            setDuplicate(null);
          }}
        />
      )}
      {current(edit) && (
        <SourceEditor
          row={current(edit)!}
          file={file}
          config={configs.find(
            (config) => config.name === current(edit)!.sheet,
          )!}
          onClose={() => setEdit(null)}
          onSave={(values) => {
            onEdit(current(edit)!.sheet, current(edit)!.row, values);
            setEdit(null);
          }}
        />
      )}
      {current(enrich) && (
        <EnrichmentDialog
          row={current(enrich)!}
          onClose={() => setEnrich(null)}
          onUse={async (details, people) => {
            await onEnriched(current(enrich)!, details, people);
            setEnrich(null);
          }}
        />
      )}
    </>
  );
}
function DuplicateDecision({
  row,
  onClose,
  onSave,
}: {
  row: ImportRow;
  onClose: () => void;
  onSave: (row: ImportRow) => void;
}) {
  const [target, setTarget] = useState(
      row.targetId ?? row.matches[0]?.title.id ?? "",
    ),
    [fields, setFields] = useState(row.updateFields),
    [failure, setFailure] = useState("");
  const match = row.matches.find((match) => match.title.id === target),
    errors = row.issues.some((issue) => issue.severity === "error");
  const incoming = (field: string) =>
    field === "watchedDate"
      ? row.data.watchedDate
      : (row.data.library[field as keyof typeof row.data.library] ??
        row.data.metadata[field as keyof typeof row.data.metadata]);
  const existing = (field: string) =>
    field === "watchedDate"
      ? match?.entry?.completedAt
      : (match?.entry?.[field as keyof NonNullable<typeof match.entry>] ??
        match?.title[field as keyof typeof match.title]);
  return (
    <Dialog title="Review this source row" onClose={onClose} wide>
      <p>
        <strong>{row.data.metadata.title || "Missing title"}</strong> ·{" "}
        {row.sheet}, row {row.row}
      </p>
      <div className="import-issue-list">
        {row.issues.map((issue, index) => (
          <article
            key={index}
            className={
              issue.severity === "error" ? "has-errors" : "has-warnings"
            }
          >
            <strong>
              {issue.severity.toUpperCase()} · {issue.field}
            </strong>
            <p>{issue.message}</p>
            <small>{issue.suggestion}</small>
          </article>
        ))}
        {!row.issues.length && <p>No validation issues found.</p>}
      </div>
      {row.fileMatches.length > 0 && (
        <p className="import-callout">
          Matches earlier workbook row(s):{" "}
          {row.fileMatches.map((match) => match.id).join(", ")}. Repeated
          external IDs must not be imported twice. Skip unwanted rows, or
          explicitly confirm genuinely distinct name matches.
        </p>
      )}
      {row.matches.length > 0 && (
        <>
          <label className="import-field">
            Existing match
            <select
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
                setFields([]);
              }}
            >
              {row.matches.map((match) => (
                <option key={match.title.id} value={match.title.id}>
                  {match.title.title} ·{" "}
                  {match.title.releaseYear ?? "Unknown year"} ·{" "}
                  {strongMatch(row, match)
                    ? "External ID match"
                    : "Possible name/year match"}
                  {match.entry?.deletedAt ? " · archived" : ""}
                </option>
              ))}
            </select>
          </label>
          <p>
            Default: keep existing values. Check only fields you explicitly
            approve. Incoming genres, categories, and people are added without
            removing existing links. TV progress and rewatches are preserved.
          </p>
          <div className="import-update-fields">
            {UPDATE_FIELDS.map((field) => (
              <label key={field.value}>
                <span>
                  <input
                    type="checkbox"
                    checked={fields.includes(field.value)}
                    onChange={(event) =>
                      setFields(
                        event.target.checked
                          ? [...fields, field.value]
                          : fields.filter((value) => value !== field.value),
                      )
                    }
                  />
                  {field.label}
                </span>
                {field.kind !== "association" && (
                  <small>
                    Existing: {display(existing(field.value))}
                    <br />
                    Incoming: {display(incoming(field.value))}
                  </small>
                )}
              </label>
            ))}
          </div>
          {match && (
            <Link
              className="text-link"
              to={`/${match.title.mediaType === "movie" ? "movies" : "shows"}/${match.title.id}`}
            >
              Open existing record ↗
            </Link>
          )}
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <button
          className="secondary-button"
          onClick={() => onSave({ ...row, action: "skip" })}
        >
          Skip this row
        </button>
        {!errors && !row.matches.some((match) => strongMatch(row, match)) && (
          <button
            className="secondary-button"
            onClick={() =>
              onSave({
                ...row,
                action:
                  row.matches.length || row.fileMatches.length
                    ? "separate"
                    : "add",
              })
            }
          >
            {row.matches.length || row.fileMatches.length
              ? "Confirm distinct · separate"
              : "Add new record"}
          </button>
        )}
        {!errors && row.matches.length > 0 && (
          <button
            className="button"
            disabled={!!match?.entry?.deletedAt || !match?.entry}
            onClick={() => {
              if (!fields.length) {
                setFailure(
                  "Select at least one approved field. Unchecked personal values are kept.",
                );
                return;
              }
              const approved = {
                ...row,
                action: "update" as const,
                targetId: target,
                updateFields: fields,
              };
              try {
                validateApprovedUpdate(approved);
                onSave(approved);
              } catch (error) {
                setFailure(
                  error instanceof Error
                    ? error.message
                    : "These selected fields do not form a valid record.",
                );
              }
            }}
          >
            Use approved updates
          </button>
        )}
      </div>
    </Dialog>
  );
}
function SourceEditor({
  row,
  file,
  config,
  onClose,
  onSave,
}: {
  row: ImportRow;
  file: ParsedFile;
  config: SheetConfig;
  onClose: () => void;
  onSave: (values: Record<number, string>) => void;
}) {
  const sheet = file.sheets.find((sheet) => sheet.name === row.sheet)!,
    source = sheet.rows.find((source) => source.number === row.row)!;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(
      Object.fromEntries(
        [...new FormData(event.currentTarget).entries()].map(([key, value]) => [
          Number(key),
          String(value),
        ]),
      ),
    );
  }
  return (
    <Dialog title="Correct mapped source values" onClose={onClose} wide>
      <p>
        {row.sheet}, row {row.row}. Changes remain in memory. Revalidate to
        refresh the preview and duplicate decisions.
      </p>
      <form className="import-source-form" onSubmit={submit}>
        {visibleColumns(sheet, config.headerRow)
          .filter(
            (index) =>
              config.mapping[index] && config.mapping[index] !== "ignore",
          )
          .map((index) => (
            <label className="import-field" key={index}>
              {
                FIELDS.find((field) => field.value === config.mapping[index])
                  ?.label
              }
              <textarea
                rows={
                  ["review", "notes", "overview"].includes(
                    config.mapping[index],
                  )
                    ? 4
                    : 2
                }
                name={String(index)}
                defaultValue={String(source.cells[index] ?? "")}
              />
            </label>
          ))}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="button">Use corrected values</button>
        </div>
      </form>
    </Dialog>
  );
}
function EnrichmentDialog({
  row,
  onClose,
  onUse,
}: {
  row: ImportRow;
  onClose: () => void;
  onUse: (details: DiscoveryMetadata, people: boolean) => Promise<void>;
}) {
  const controller = useRef(new AbortController()),
    [results, setResults] = useState<SearchResult[] | null>(null),
    [details, setDetails] = useState<DiscoveryMetadata | null>(null),
    [people, setPeople] = useState(false),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  async function search() {
    setBusy(true);
    setFailure("");
    try {
      setResults(await enrichmentCandidates(row, controller.current.signal));
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Metadata search failed. Continue without enrichment.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function choose(result: SearchResult) {
    setBusy(true);
    setFailure("");
    try {
      setDetails(
        await enrichmentDetails(result.id, row, controller.current.signal),
      );
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Metadata could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Optional metadata, on your terms"
      onClose={() => {
        controller.current.abort();
        onClose();
      }}
      wide
    >
      <p>
        Only this title and its media type are sent to TMDB. Ratings, reviews,
        statuses, and viewing dates stay on this device. Choose the correct
        production; no match is selected automatically.
      </p>
      <strong>
        {row.data.metadata.title} ·{" "}
        {row.data.metadata.releaseYear ?? "Year unknown"}
      </strong>
      {!results && !details && (
        <div className="dialog-actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => void search()}
          >
            {busy ? "Searching…" : "Search this title on TMDB"}
          </button>
        </div>
      )}
      {results && !details && (
        <div className="import-enrichment-results">
          {results.length ? (
            results.slice(0, 8).map((result) => (
              <button
                className="secondary-button"
                key={result.id}
                disabled={busy}
                onClick={() => void choose(result)}
              >
                {result.title} · {result.releaseYear ?? "Unknown year"}
                {result.releaseYear === row.data.metadata.releaseYear
                  ? " · Same year"
                  : ""}
              </button>
            ))
          ) : (
            <p>
              No matches. Keep the original spreadsheet data or correct the
              title and try again.
            </p>
          )}
        </div>
      )}
      {details && (
        <>
          <h3>
            {details.metadata.title} ·{" "}
            {details.metadata.releaseYear ?? "Unknown year"}
          </h3>
          <p>{details.metadata.overview || "No overview available."}</p>
          <p>
            Only empty source metadata fields and missing genres will be filled.
            Nonempty source fields and all personal fields remain unchanged.
          </p>
          <label className="import-check">
            <input
              type="checkbox"
              checked={people}
              onChange={(event) => setPeople(event.target.checked)}
            />
            Use creator/director suggestions if the source has no people:{" "}
            {details.suggestions.map((person) => person.name).join(", ") ||
              "None"}
          </label>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setDetails(null)}
            >
              Back to matches
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onUse(details, people);
                } catch (error) {
                  setFailure(
                    error instanceof Error
                      ? error.message
                      : "Draft could not be updated.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Approve missing metadata
            </button>
          </div>
        </>
      )}
      {failure && (
        <p className="field-error" role="alert">
          {failure} Importing without enrichment remains available.{" "}
          <Link to="/settings">TMDB settings</Link>
        </p>
      )}
      <button
        className="text-button"
        onClick={() => {
          controller.current.abort();
          onClose();
        }}
      >
        Cancel enrichment · keep source values
      </button>
    </Dialog>
  );
}
function display(value: unknown) {
  return value === null || value === undefined || value === ""
    ? "Blank / unknown"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
