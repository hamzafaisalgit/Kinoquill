import { useCallback, useEffect, useRef, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import type {
  ImportBatch,
  ImportOptions,
  ImportPlan,
  ImportRow,
  ParsedFile,
  SheetConfig,
} from "../../types/imports";
import type { DiscoveryMetadata } from "../../services/tmdb/types";
import {
  autoMapping,
  defaultSheetConfig,
  FIELDS,
  mappingErrors,
  visibleColumns,
} from "../../services/import/columnMapper";
import { DEFAULT_IMPORT_OPTIONS } from "../../services/import/normalizer";
import {
  buildPlan,
  recheckPlan,
} from "../../services/import/duplicateResolver";
import { applyMissingMetadata } from "../../services/import/enrichment";
import { planCounts } from "../../services/import/importService";
import { importDatabase, importer } from "../../services/import/runtime";
import { STATUSES } from "../../utils/libraryState";
import { splitNames } from "../../services/import/normalizer";
import { LeaveMovieDialog } from "../movies/LeaveMovieDialog";
import { ImportReview } from "./ImportReview";
import { ImportSummary } from "./ImportSummary";

export function ImportWizard({
  initial,
  onClose,
}: {
  initial: ParsedFile;
  onClose: () => void;
}) {
  const [file, setFile] = useState(initial),
    [configs, setConfigs] = useState<SheetConfig[]>(() =>
      initial.sheets.map(defaultSheetConfig),
    ),
    [options, setOptions] = useState<ImportOptions>(() => ({
      ...DEFAULT_IMPORT_OPTIONS,
      decodeSafeText:
        initial.type === "csv" &&
        initial.sheets.some((sheet) =>
          sheet.rows[0]?.cells.includes("Kinoquill Format"),
        ),
    })),
    [stage, setStage] = useState(1),
    [plan, setPlan] = useState<ImportPlan | null>(null),
    [batch, setBatch] = useState<ImportBatch | null>(null),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"validate" | "commit" | null>(null),
    [categoriesText, setCategoriesText] = useState(""),
    [progress, setProgress] = useState({ count: 0, total: 0 }),
    [confirmed, setConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null),
    committing = useRef(false),
    dirty = !batch;
  useEffect(() => () => controller.current?.abort(), []);
  const blocker = useBlocker(useCallback(() => dirty, [dirty]));
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [dirty],
    ),
  );
  const selected = configs.filter((config) => config.selected),
    counts = plan ? planCounts(plan) : null;
  function patchConfig(name: string, patch: Partial<SheetConfig>) {
    setConfigs((current) =>
      current.map((config) =>
        config.name === name ? { ...config, ...patch } : config,
      ),
    );
    setPlan(null);
    setConfirmed(false);
  }
  function cancel() {
    if (busy) return;
    if (
      batch ||
      window.confirm(
        "Discard this in-memory import draft? No original file is stored, and your saved collection is unchanged.",
      )
    )
      onClose();
  }
  async function validate() {
    setMode("validate");
    setBusy(true);
    setFailure("");
    setConfirmed(false);
    controller.current = new AbortController();
    try {
      const next = await buildPlan(
        importDatabase,
        file,
        configs,
        options,
        controller.current.signal,
        (count, total) => setProgress({ count, total }),
      );
      setPlan(next);
      setStage(4);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setFailure(
          message(
            error,
            "Validation could not finish. Your file and mappings are still available.",
          ),
        );
    } finally {
      setBusy(false);
      setMode(null);
    }
  }
  async function commit() {
    if (!plan || committing.current) return;
    committing.current = true;
    setMode("commit");
    setBusy(true);
    setFailure("");
    try {
      const result = await importer.commit(plan, (count, total) =>
        setProgress({ count, total }),
      );
      setBatch(result);
      setStage(5);
      setPlan(null);
    } catch (error) {
      setFailure(
        message(
          error,
          "Import failed. The transaction was rolled back; no rows were committed. Your draft is still available.",
        ),
      );
    } finally {
      committing.current = false;
      setMode(null);
      setBusy(false);
    }
  }
  function editSource(
    sheetName: string,
    rowNumber: number,
    values: Record<number, string>,
  ) {
    setFile((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) =>
        sheet.name === sheetName
          ? {
              ...sheet,
              rows: sheet.rows.map((row) =>
                row.number === rowNumber
                  ? {
                      ...row,
                      cells: Array.from(
                        {
                          length: Math.max(
                            row.cells.length,
                            ...Object.keys(values).map(
                              (key) => Number(key) + 1,
                            ),
                          ),
                        },
                        (_, index) =>
                          index in values
                            ? values[index]
                            : (row.cells[index] ?? null),
                      ),
                    }
                  : row,
              ),
            }
          : sheet,
      ),
    }));
    setPlan(null);
    setStage(3);
    setConfirmed(false);
  }
  async function enrich(
    row: ImportRow,
    details: DiscoveryMetadata,
    people: boolean,
  ) {
    if (!plan) return;
    const updated = applyMissingMetadata(row, details, people);
    setPlan(
      await recheckPlan(importDatabase, {
        ...plan,
        rows: plan.rows.map((existing) =>
          existing.id === row.id ? updated : existing,
        ),
      }),
    );
    setConfirmed(false);
  }
  return (
    <div className="import-wizard">
      <div className="import-wizard-top">
        <div>
          <span className="outline-pill">
            LOCAL IMPORT · {file.type.toUpperCase()}
          </span>
          <h2>{file.name}</h2>
          <p>
            {(file.size / 1024).toFixed(1)} KB · {file.sheets.length} sheets
            detected
          </p>
        </div>
        <button className="text-button" disabled={busy} onClick={cancel}>
          {batch ? "Close results" : "Cancel import"}
        </button>
      </div>
      <ol className="import-steps" aria-label="Import steps">
        {[
          "Upload",
          "Select sheets",
          "Map columns",
          "Configure",
          "Review",
          "Results",
        ].map((label, index) => (
          <li
            className={
              stage === index ? "current" : stage > index ? "complete" : ""
            }
            key={label}
            aria-current={stage === index ? "step" : undefined}
          >
            <span>{stage > index ? <Check size={12} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {stage === 1 && (
        <section className="panel import-step-panel">
          <p className="eyebrow">CHOOSE THE CHAPTERS TO BRING WITH YOU</p>
          <h2>Your workbook, your choices.</h2>
          <p>
            Row-level Title Type always overrides the fallback below. A sheet
            name never determines media type automatically.
          </p>
          <div className="import-sheet-actions">
            <button
              className="text-button"
              onClick={() =>
                setConfigs(
                  configs.map((config) => ({
                    ...config,
                    selected:
                      config.name !== "Instructions" &&
                      config.name !== "Export Information",
                  })),
                )
              }
            >
              Select data sheets
            </button>
            <button
              className="text-button"
              onClick={() =>
                setConfigs(
                  configs.map((config) => ({ ...config, selected: false })),
                )
              }
            >
              Clear selection
            </button>
          </div>
          <div className="import-sheet-list">
            {configs.map((config) => {
              const sheet = file.sheets.find(
                (sheet) => sheet.name === config.name,
              )!;
              return (
                <article key={config.name}>
                  <label className="import-sheet-select">
                    <input
                      type="checkbox"
                      checked={config.selected}
                      onChange={(event) =>
                        patchConfig(config.name, {
                          selected: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>{config.name}</strong>
                      <small>
                        {
                          sheet.rows.filter(
                            (row) => row.number > config.headerRow,
                          ).length
                        }{" "}
                        data rows · empty rows ignored
                      </small>
                    </span>
                  </label>
                  <label className="import-field">
                    Fallback type
                    <select
                      value={config.defaultType}
                      onChange={(event) =>
                        patchConfig(config.name, {
                          defaultType: event.target
                            .value as SheetConfig["defaultType"],
                        })
                      }
                    >
                      <option value="">Unknown — resolve row type</option>
                      <option value="movie">Movie</option>
                      <option value="tv_series">TV Series</option>
                      <option value="tv_miniseries">TV Mini Series</option>
                    </select>
                  </label>
                  <label className="import-check">
                    <input
                      type="checkbox"
                      checked={config.category === config.name}
                      onChange={(event) =>
                        patchConfig(config.name, {
                          category: event.target.checked ? config.name : "",
                        })
                      }
                    />
                    Create a personal category from this sheet name
                  </label>
                  <label className="import-field">
                    Sheet category <small>Optional</small>
                    <input
                      value={config.category}
                      onChange={(event) =>
                        patchConfig(config.name, {
                          category: event.target.value,
                        })
                      }
                      placeholder="Leave blank for none"
                    />
                  </label>
                  {sheet.notices.map((notice) => (
                    <p className="import-callout" key={notice}>
                      {notice}
                    </p>
                  ))}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {stage === 2 && (
        <section className="panel import-step-panel">
          <p className="eyebrow">PUT EVERY COLUMN IN ITS PLACE</p>
          <h2>Familiar fields. Your final say.</h2>
          <p>
            Ignore fields you do not need. “Type” is only suggested when sample
            values look like media types. Position and Date Rated are
            provenance, not viewing history.
          </p>
          {selected.map((config) => {
            const sheet = file.sheets.find(
                (sheet) => sheet.name === config.name,
              )!,
              header =
                sheet.rows.find((row) => row.number === config.headerRow)
                  ?.cells ?? [],
              errors = mappingErrors(sheet, config);
            return (
              <section className="import-mapping-sheet" key={config.name}>
                <div className="import-mapping-heading">
                  <h3>{config.name}</h3>
                  <label className="import-field">
                    Header row <small>0 = no headers</small>
                    <input
                      type="number"
                      min="0"
                      max={sheet.rows.at(-1)?.number ?? 1}
                      value={config.headerRow}
                      onChange={(event) => {
                        const headerRow = Number(event.target.value);
                        patchConfig(config.name, {
                          headerRow,
                          mapping: autoMapping(sheet, headerRow),
                        });
                      }}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      patchConfig(config.name, {
                        mapping: autoMapping(sheet, config.headerRow),
                      })
                    }
                  >
                    Reset mapping
                  </button>
                </div>
                <div className="import-mapping-list">
                  {visibleColumns(sheet, config.headerRow).map((index) => (
                    <div key={index}>
                      <span>
                        <strong>
                          {String(header[index] ?? "").trim() ||
                            `Column ${index + 1}`}
                        </strong>
                        <small>
                          {sheet.rows
                            .filter((row) => row.number > config.headerRow)
                            .slice(0, 3)
                            .map(
                              (row) =>
                                String(row.cells[index] ?? "").slice(0, 75) ||
                                "Blank",
                            )
                            .join(" · ")}
                        </small>
                      </span>
                      <span className="import-mapping-arrow">→</span>
                      <select
                        aria-label={`${config.name} column ${index + 1} mapping`}
                        value={config.mapping[index] ?? "ignore"}
                        onChange={(event) =>
                          patchConfig(config.name, {
                            mapping: {
                              ...config.mapping,
                              [index]: event.target
                                .value as (typeof config.mapping)[number],
                            },
                          })
                        }
                      >
                        {FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {errors.map((error) => (
                  <p className="field-error" key={error}>
                    {error}
                  </p>
                ))}
              </section>
            );
          })}
        </section>
      )}
      {stage === 3 && (
        <section className="panel import-step-panel">
          <p className="eyebrow">BRING THE HISTORY. KEEP THE NUANCE.</p>
          <h2>Make the interpretation explicit.</h2>
          <div className="import-options-grid">
            <label className="import-field">
              Missing watch status
              <select
                value={options.defaultStatus}
                onChange={(event) =>
                  setOptions({
                    ...options,
                    defaultStatus: event.target
                      .value as ImportOptions["defaultStatus"],
                  })
                }
              >
                {STATUSES.map((status) => (
                  <option value={status.value} key={status.value}>
                    {status.value === "unknown"
                      ? "Unknown — review later"
                      : status.label}
                  </option>
                ))}
              </select>
              <small>
                A valid row status takes priority. No watched state is inferred
                from ratings.
              </small>
            </label>
            <label className="import-field">
              Source rating scale
              <select
                value={options.ratingScale}
                onChange={(event) =>
                  setOptions({
                    ...options,
                    ratingScale: Number(event.target.value) as 5 | 10 | 100,
                  })
                }
              >
                <option value={10}>0–10 · keep 8.7 as 8.7</option>
                <option value={5}>0–5 · 4.5 becomes 9.0</option>
                <option value={100}>0–100 · 87 becomes 8.7</option>
              </select>
              <small>
                Blank remains unrated. Historical decimal precision is never
                rounded to half points.
              </small>
            </label>
            <label className="import-field">
              Date interpretation
              <select
                value={options.dateFormat}
                onChange={(event) =>
                  setOptions({
                    ...options,
                    dateFormat: event.target
                      .value as ImportOptions["dateFormat"],
                  })
                }
              >
                <option value="auto">Automatic · flag ambiguous dates</option>
                <option value="dmy">
                  DD/MM/YYYY · 23/11/2022 → 2022-11-23
                </option>
                <option value="mdy">
                  MM/DD/YYYY · 11/23/2022 → 2022-11-23
                </option>
                <option value="iso">YYYY-MM-DD</option>
              </select>
              <small>
                ISO dates and typed Excel dates remain stable. Ambiguous
                03/04/2022 is never guessed in automatic mode.
              </small>
            </label>
            <label className="import-field">
              Categories for every imported row
              <input
                value={categoriesText}
                onChange={(event) => {
                  setCategoriesText(event.target.value);
                  setOptions({
                    ...options,
                    categories: splitNames(event.target.value),
                  });
                }}
                placeholder="Separate with semicolons"
              />
              <small>Names are created only when the import commits.</small>
            </label>
          </div>
          <label className="import-check">
            <input
              type="checkbox"
              checked={options.decodeSafeText}
              onChange={(event) =>
                setOptions({ ...options, decodeSafeText: event.target.checked })
              }
            />
            Decode formula-safe text prefixes from a trusted Kinoquill CSV
            export.
          </label>
          <div className="import-privacy-choice">
            <label className="import-check">
              <input
                type="checkbox"
                checked={options.enrichment}
                onChange={(event) =>
                  setOptions({ ...options, enrichment: event.target.checked })
                }
              />
              Fetch missing information from TMDB
            </label>
            <p>
              Off by default. When enabled, choose a row in the preview and
              explicitly search its title. One request workflow runs at a time,
              can be cancelled, and sends no personal ratings, reviews,
              statuses, or viewing history. Source data can be imported without
              enrichment.
            </p>
          </div>
        </section>
      )}
      {stage === 4 && plan && (
        <section className="panel import-step-panel">
          <p className="eyebrow">YOUR PREVIEW. STILL YOURS TO CHANGE.</p>
          <h2>Review every proposed change.</h2>
          <div className="import-counts">
            {[
              ["Source rows", counts!.total],
              ["Valid", counts!.valid],
              ["Warnings", counts!.warnings],
              ["Errors / excluded", counts!.errors],
              ["Existing / file matches", counts!.duplicates],
              ["New records", counts!.add],
              ["Proposed updates", counts!.update],
              ["Skipped", counts!.skip],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <ImportReview
            plan={plan}
            file={file}
            configs={configs}
            enrichment={options.enrichment}
            onEdit={editSource}
            onRow={(row) => {
              setPlan({
                ...plan,
                rows: plan.rows.map((existing) =>
                  existing.id === row.id ? row : existing,
                ),
              });
              setConfirmed(false);
            }}
            onSkip={(ids) => {
              setPlan({
                ...plan,
                rows: plan.rows.map((row) =>
                  ids.includes(row.id) ? { ...row, action: "skip" } : row,
                ),
              });
              setConfirmed(false);
            }}
            onEnriched={enrich}
          />
          <div className="import-final-confirm">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {counts!.add} new · {counts!.update} updated · {counts!.skip}{" "}
                skipped · {counts!.errors} invalid/excluded
              </strong>
              <p>
                No records have been written. Duplicate updates apply only
                checked fields; unchecked personal values, rewatches, and TV
                progress stay intact.
              </p>
              <label className="import-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I reviewed this plan, including skipped/error rows, and approve
                the stated additions and selected updates.
              </label>
            </div>
          </div>
        </section>
      )}
      {stage === 5 && batch && (
        <ImportSummary batch={batch} onAnother={onClose} />
      )}
      {failure && (
        <p className="field-error import-wizard-error" role="alert">
          {failure}
        </p>
      )}
      {busy && (
        <div className="panel import-progress" role="status">
          <strong>
            {mode === "commit"
              ? "Committing transaction — success is reported only after commit."
              : "Validating rows and checking local duplicates…"}
          </strong>
          <span>
            {progress.count} / {progress.total}
          </span>
          {mode !== "commit" && (
            <button
              className="text-button"
              onClick={() => controller.current?.abort()}
            >
              Cancel validation
            </button>
          )}
        </div>
      )}
      {stage < 5 && (
        <div className="import-wizard-footer">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setFailure("");
              if (stage === 1) cancel();
              else setStage(stage - 1);
            }}
          >
            <ArrowLeft size={14} />
            {stage === 1 ? "Choose another file" : "Back"}
          </button>
          <span>
            {stage === 4
              ? "Nothing changes until you confirm."
              : "Your file and choices remain in this tab."}
          </span>
          {stage < 3 ? (
            <button
              className="button"
              disabled={
                busy ||
                !selected.length ||
                (stage === 2 &&
                  selected.some(
                    (config) =>
                      mappingErrors(
                        file.sheets.find(
                          (sheet) => sheet.name === config.name,
                        )!,
                        config,
                      ).length > 0,
                  ))
              }
              onClick={() => {
                setFailure("");
                setStage(stage + 1);
              }}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : stage === 3 ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => void validate()}
            >
              Validate & preview
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="button"
              disabled={busy || !confirmed}
              onClick={() => void commit()}
            >
              Confirm import
            </button>
          )}
        </div>
      )}
      {blocker.state === "blocked" && <LeaveMovieDialog blocker={blocker} />}
    </div>
  );
}
function message(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === "QuotaExceededError")
    return "Browser storage is full. The transaction was rolled back. Free some storage and retry; existing records and this in-memory draft are preserved.";
  return error instanceof Error &&
    [
      "ValidationError",
      "ConflictError",
      "StorageUnavailableError",
      "RecordNotFoundError",
      "DuplicateTitleError",
    ].includes(error.name)
    ? error.message
    : fallback;
}
