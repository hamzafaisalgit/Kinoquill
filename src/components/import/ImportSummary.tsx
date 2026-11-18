import { Link } from "react-router-dom";
import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import type { ImportBatch } from "../../types/imports";
import { importer } from "../../services/import/runtime";
import {
  downloadFile,
  reportDownload,
} from "../../services/export/spreadsheetExport";
export function ImportSummary({
  batch,
  onAnother,
}: {
  batch: ImportBatch;
  onAnother?: () => void;
}) {
  const [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel import-summary">
      <div className="import-summary-intro">
        <CheckCircle2 size={32} />
        <div>
          <p className="eyebrow">COMMITTED TO YOUR PERSONAL CINEMA</p>
          <h2>Your collection has a new chapter.</h2>
          <p>
            {batch.originalFileName} ·{" "}
            {new Date(batch.importedAt).toLocaleString()} ·{" "}
            {batch.fileType.toUpperCase()}
          </p>
        </div>
      </div>
      <div className="import-counts">
        {[
          ["Source rows", batch.totalRows],
          ["Created", batch.createdCount],
          ["Updated", batch.updatedCount],
          ["Skipped", batch.skippedCount],
          ["Invalid / excluded", batch.failedCount],
          ["Rows with warnings", batch.warningsCount],
          ["Categories created", batch.categoriesCreated],
          ["Movies imported", batch.movies],
          ["TV shows imported", batch.shows],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p>
        All accepted rows and this report were committed together. Invalid and
        skipped rows are listed in the downloadable report. No original file is
        stored.
      </p>
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      <div className="import-summary-actions">
        <Link className="button" to={`/library?importBatch=${batch.id}`}>
          View imported titles
        </Link>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFailure("");
            try {
              downloadFile(
                reportDownload(batch, await importer.records(batch.id)),
              );
            } catch {
              setFailure(
                "The report could not be downloaded. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={14} />
          Download import report
        </button>
        {onAnother && (
          <button className="text-button" onClick={onAnother}>
            Import another file
          </button>
        )}
        <Link className="text-link" to="/library">
          Return to Library
        </Link>
      </div>
    </section>
  );
}
