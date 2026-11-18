import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import {
  EXPORT_FIELDS,
  collectionDownload,
  downloadFile,
  exportRows,
  templateDownload,
} from "../../services/export/spreadsheetExport";
import { importDatabase } from "../../services/import/runtime";
import { parseLibraryParams } from "../../utils/libraryState";
import type { LibraryQuery } from "../../types/domain";
export function ExportPanel() {
  const [params] = useSearchParams(),
    [scope, setScope] = useState(params.has("from") ? "filtered" : "all"),
    [format, setFormat] = useState<"csv" | "xlsx">("xlsx"),
    [fields, setFields] = useState(EXPORT_FIELDS),
    [templateFormat, setTemplateFormat] = useState<"csv" | "xlsx">("xlsx"),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState("");
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      await task();
    } catch (error) {
      setFailure(
        error instanceof Error && error.name === "ValidationError"
          ? error.message
          : "The file could not be generated or the download could not start. Your collection was not changed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function query(): LibraryQuery {
    if (scope === "movies") return { mediaType: "movie" };
    if (scope === "shows") return { mediaType: "tv" };
    if (scope === "watchlist") return { status: "watchlist" };
    if (scope === "favorites") return { favorite: true };
    if (scope === "filtered") {
      const url = new URL(
        params.get("from") ?? "/library",
        "https://kinoquill.local",
      );
      if (
        !["/library", "/movies", "/shows", "/favorites", "/watchlist"].includes(
          url.pathname,
        )
      )
        throw new Error("Invalid source collection.");
      return {
        ...parseLibraryParams(url.searchParams),
        ...(url.pathname === "/movies"
          ? { mediaType: "movie", mediaSubtype: undefined }
          : url.pathname === "/shows"
            ? { mediaType: "tv" }
            : url.pathname === "/favorites"
              ? { favorite: true }
              : url.pathname === "/watchlist"
                ? { status: "watchlist" }
                : {}),
      };
    }
    return {};
  }
  return (
    <>
      <section className="panel transfer-export-panel">
        <div className="transfer-section-heading">
          <Download size={25} />
          <div>
            <p className="eyebrow">A COPY YOU CAN HOLD</p>
            <h2>Export your collection.</h2>
          </div>
        </div>
        <p>
          Bring your saved records back to a spreadsheet. Exports use personal
          ratings and recorded dates, with blanks left blank.
        </p>
        <div className="import-options-grid">
          <label className="import-field">
            Collection
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="all">Entire active library</option>
              <option value="movies">Movies only</option>
              <option value="shows">TV shows only</option>
              <option value="watchlist">Watchlist</option>
              <option value="favorites">Favorites</option>
              {params.has("from") && (
                <option value="filtered">
                  Current filtered collection · all matching pages
                </option>
              )}
            </select>
          </label>
          <label className="import-field">
            File format
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as "csv" | "xlsx")
              }
            >
              <option value="xlsx">Excel workbook (.xlsx)</option>
              <option value="csv">Combined UTF-8 CSV (.csv)</option>
            </select>
          </label>
        </div>
        <details className="transfer-export-fields">
          <summary>
            Included fields <span>{fields.length} selected</span>
          </summary>
          <div>
            {EXPORT_FIELDS.map((field) => (
              <label className="import-check" key={field}>
                <input
                  type="checkbox"
                  checked={fields.includes(field)}
                  disabled={field === "Title" || field === "Title Type"}
                  onChange={(event) =>
                    setFields(
                      event.target.checked
                        ? [...fields, field]
                        : fields.filter((value) => value !== field),
                    )
                  }
                />
                {field}
              </label>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() => setFields(EXPORT_FIELDS)}
          >
            Reset fields
          </button>
        </details>
        <p className="import-callout">
          A flat export is not a full backup: episode-level history, rewatches,
          settings, and complete import provenance are not included. Progress
          columns are summaries. Full backup/restore belongs to Phase 9.
        </p>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const rows = await exportRows(importDatabase, query());
              downloadFile(await collectionDownload(rows, fields, format));
              setNotice(
                `${rows.length} active records exported. Your browser was asked to download the file; check its downloads list.`,
              );
            })
          }
        >
          <Download size={15} />
          {busy ? "Preparing locally…" : "Generate export"}
        </button>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        {notice && (
          <p className="transfer-download-notice" role="status">
            {notice}
          </p>
        )}
      </section>
      <section className="panel transfer-templates">
        <div className="transfer-section-heading">
          <div>
            <p className="eyebrow">START WITH A CLEAN PAGE</p>
            <h2>Official templates.</h2>
          </div>
          <select
            aria-label="Template format"
            value={templateFormat}
            onChange={(event) =>
              setTemplateFormat(event.target.value as "csv" | "xlsx")
            }
          >
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <p>
          Headers only, with no example records to accidentally import. Excel
          templates include a separate instructions sheet.
        </p>
        <div className="transfer-template-buttons">
          {(["movies", "shows", "combined"] as const).map((kind) => (
            <button
              className="secondary-button"
              key={kind}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  downloadFile(await templateDownload(kind, templateFormat));
                  setNotice(
                    "Template download requested. Fill in your own records before importing.",
                  );
                })
              }
            >
              {kind === "movies"
                ? "Movies Template"
                : kind === "shows"
                  ? "TV Shows Template"
                  : "Combined Template"}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
