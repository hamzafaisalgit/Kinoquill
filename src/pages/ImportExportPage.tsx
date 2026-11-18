import { useRef, useState } from "react";
import {
  ArrowUpRight,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ImportBatch, ParsedFile } from "../types/imports";
import { PageHeader } from "../components/common/States";
import { useCatalogQuery } from "../hooks/useCatalog";
import { importer } from "../services/import/runtime";
import { parseFile } from "../services/import/fileParser";
import { ImportWizard } from "../components/import/ImportWizard";
import { ImportSummary } from "../components/import/ImportSummary";
import { ExportPanel } from "../components/import/ExportPanel";
import "../styles/transfer.css";
export default function ImportExportPage() {
  const [file, setFile] = useState<ParsedFile | null>(null),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [drag, setDrag] = useState(false),
    [history, setHistory] = useState<ImportBatch | null>(null),
    generation = useRef(0),
    input = useRef<HTMLInputElement>(null),
    batches = useCatalogQuery(() => importer.history(), []);
  async function read(selected: File) {
    const version = ++generation.current;
    setBusy(true);
    setFailure("");
    setHistory(null);
    try {
      const parsed = await parseFile(selected);
      if (version === generation.current) setFile(parsed);
    } catch (error) {
      if (version === generation.current)
        setFailure(
          error instanceof Error && error.name === "ValidationError"
            ? error.message
            : "The file could not be read. Your saved library was not changed.",
        );
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR COLLECTION, BETWEEN PAGES"
        title="Bring your history. Keep your story."
        description="Thoughtful tools for moving your collection into Kinoquill—and taking a copy with you."
        action={
          <Link className="secondary-button" to="/library">
            My Library
            <ArrowUpRight size={14} />
          </Link>
        }
      />
      <div className="transfer-privacy">
        <ShieldCheck size={18} />
        <p>
          Your files are processed locally in your browser. Your personal
          collection remains on this device.
        </p>
      </div>
      {file ? (
        <ImportWizard
          initial={file}
          onClose={() => {
            setFile(null);
            setHistory(null);
          }}
        />
      ) : history ? (
        <>
          <ImportSummary batch={history} />
          <button className="text-button" onClick={() => setHistory(null)}>
            Back to import & export
          </button>
        </>
      ) : (
        <div className="transfer-workspace">
          <div className="transfer-import-column">
            <section className="panel transfer-import-panel">
              <div className="transfer-section-heading">
                <FileSpreadsheet size={26} />
                <div>
                  <p className="eyebrow">YEARS OF STORIES, WELCOME HOME</p>
                  <h2>Import your collection.</h2>
                </div>
              </div>
              <p>
                Bring CSV files and multi-sheet Excel workbooks. Review columns,
                resolve duplicates, and choose exactly what changes before
                saving.
              </p>
              <div
                className={`transfer-dropzone ${drag ? "drag-active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDrag(false);
                  if (!busy && event.dataTransfer.files[0])
                    void read(event.dataTransfer.files[0]);
                }}
              >
                <Upload size={33} strokeWidth={1.2} />
                <strong>
                  {busy
                    ? "Reading your file locally…"
                    : "A new home for your spreadsheets."}
                </strong>
                <span>Drop a CSV or XLSX here, or choose a file.</span>
                <input
                  ref={input}
                  className="sr-only"
                  type="file"
                  accept=".csv,.xlsx"
                  aria-label="Choose CSV or Excel file"
                  disabled={busy}
                  onChange={(event) => {
                    const chosen = event.target.files?.[0];
                    event.target.value = "";
                    if (chosen) void read(chosen);
                  }}
                />
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  Import collection
                </button>
                <small>
                  CSV · XLSX · up to 10 MB and 5,000 data rows
                  <br />
                  No upload to a server. No .xls or macro support.
                </small>
                {busy && (
                  <button
                    className="text-button"
                    onClick={() => {
                      generation.current++;
                      setBusy(false);
                    }}
                  >
                    <X size={13} />
                    Cancel reading
                  </button>
                )}
              </div>
              {failure && (
                <p className="field-error" role="alert">
                  {failure}
                </p>
              )}
              <div className="transfer-import-notes">
                <span>01 · Map your own columns</span>
                <span>02 · Preview every change</span>
                <span>03 · Commit with confidence</span>
              </div>
            </section>
            <section className="panel transfer-import-history">
              <div className="transfer-section-heading">
                <div>
                  <p className="eyebrow">RECENT CHAPTERS</p>
                  <h2>Import history.</h2>
                </div>
                <span className="outline-pill">LOCAL</span>
              </div>
              {batches.isLoading ? (
                <p>Reading local import history…</p>
              ) : batches.error ? (
                <p className="field-error">
                  Import history could not be loaded.
                </p>
              ) : !batches.data?.length ? (
                <div className="transfer-history-empty">
                  <FileSpreadsheet size={23} />
                  <p>
                    Your first committed import will appear here. Original files
                    are not kept.
                  </p>
                </div>
              ) : (
                <div className="transfer-history-list">
                  {batches.data.map((batch) => (
                    <article key={batch.id}>
                      <div>
                        <strong>{batch.originalFileName}</strong>
                        <p>
                          {new Date(batch.importedAt).toLocaleString()} ·{" "}
                          {batch.fileType.toUpperCase()} ·{" "}
                          {batch.createdCount + batch.updatedCount} imported
                        </p>
                        <span>
                          {batch.status} · {batch.failedCount} excluded
                        </span>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setHistory(batch)}
                      >
                        View summary
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="transfer-export-column">
            <ExportPanel />
          </div>
        </div>
      )}
      <p className="transfer-storage-note">
        Browser storage can be cleared or evicted. Export periodically and keep
        original source files. Flat spreadsheets do not replace a complete
        backup.
      </p>
    </>
  );
}
