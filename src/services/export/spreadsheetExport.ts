import Papa from "papaparse";
import type { KinoquillDatabase } from "../../db/database";
import type { Cell, ImportBatch, ImportRecord } from "../../types/imports";
import type { LibraryQuery } from "../../types/domain";
import { LibraryService } from "../libraryService";
import { ShowService } from "../showService";
import { domainTables } from "../domainSupport";
import { excelModule } from "../import/fileParser";
import { ValidationError } from "../../utils/errors";
export const EXPORT_FIELDS = [
  "Title",
  "Title Type",
  "Year",
  "Genres",
  "Directors",
  "Creators",
  "Runtime (mins)",
  "Release Date",
  "Your Rating",
  "Status",
  "Date Watched",
  "Date Started",
  "Date Completed",
  "Date Rated",
  "Favorite",
  "Categories",
  "Language",
  "Country",
  "Personal Review",
  "TMDB ID",
  "IMDb ID",
  "Original Title",
  "Overview",
  "Poster Path",
  "Backdrop Path",
  "Position",
  "Seasons Watched",
  "Episodes Watched",
];
export interface ExportRow {
  mediaType: "movie" | "tv";
  values: Record<string, Cell>;
}
export const CSV_FORMAT = "kinoquill-csv-v1";
export async function exportRows(
  db: KinoquillDatabase,
  query: LibraryQuery = {},
): Promise<ExportRow[]> {
  return db.transaction(
    "r",
    [...domainTables(db), db.importRecords, db.importBatches],
    async () => {
      const items = await new LibraryService(db).exportLibraryEntries(query),
        provenance = await db.importRecords
          .where("entryId")
          .anyOf(items.map((item) => item.entry.id))
          .toArray();
      const batchesById = new Map(
        (await db.importBatches.toArray()).map((batch) => [
          batch.id,
          batch.importedAt,
        ]),
      );
      const sourceFor = (id: string) =>
        provenance
          .filter((record) => record.entryId === id)
          .sort((a, b) =>
            (batchesById.get(b.batchId) ?? "").localeCompare(
              batchesById.get(a.batchId) ?? "",
            ),
          )[0];
      const rows: ExportRow[] = [];
      for (const item of items) {
        const { title, entry } = item,
          source = sourceFor(entry.id),
          tracking =
            title.mediaType === "tv"
              ? await new ShowService(db).tracking(title.id)
              : null;
        rows.push({
          mediaType: title.mediaType,
          values: {
            Title: title.title,
            "Title Type":
              title.mediaSubtype === "movie"
                ? "Movie"
                : title.mediaSubtype === "tv_miniseries"
                  ? "TV Mini Series"
                  : "TV Series",
            Year: title.releaseYear,
            Genres: exportList((item.genres ?? []).map((row) => row.name)),
            Directors:
              title.mediaType === "movie"
                ? exportList((item.people ?? []).map((row) => row.name))
                : "",
            Creators:
              title.mediaType === "tv"
                ? exportList((item.people ?? []).map((row) => row.name))
                : "",
            "Runtime (mins)": title.runtimeMinutes,
            "Release Date": title.releaseDate,
            "Your Rating": entry.personalRating,
            Status: entry.status,
            "Date Watched":
              title.mediaType === "movie"
                ? (item.watchedDate?.value ?? null)
                : null,
            "Date Started": entry.startedAt.value,
            "Date Completed": entry.completedAt.value,
            "Date Rated": source?.ratedDate.value ?? null,
            Favorite: entry.isFavorite ? "Yes" : "No",
            Categories: exportList(
              (item.categories ?? []).map((row) => row.name),
            ),
            Language: title.originalLanguage,
            Country: exportList(title.countries),
            "Personal Review": entry.personalReview,
            "TMDB ID": title.tmdbId,
            "IMDb ID": title.imdbId,
            "Original Title": title.originalTitle,
            Overview: title.overview,
            "Poster Path": title.posterPath,
            "Backdrop Path": title.backdropPath,
            Position: source?.legacyPosition ?? null,
            "Seasons Watched": tracking?.summary.completedSeasons ?? null,
            "Episodes Watched": tracking?.summary.watched ?? null,
          },
        });
      }
      return rows;
    },
  );
}
function exportList(values: string[]) {
  return values.some((value) => /[,;\n|]/.test(value))
    ? JSON.stringify(values)
    : values.join("; ");
}
function safeText(value: Cell): Cell {
  return typeof value === "string" &&
    (/^[\s]*[=+\-@\t\r]/.test(value) || value.startsWith("'"))
    ? `'${value}`
    : value;
}
export function csvText(headers: string[], rows: Cell[][], marker = false) {
  const fields = marker ? [...headers, "Kinoquill Format"] : headers,
    data = rows.map((row) =>
      (marker ? [...row, CSV_FORMAT] : row).map(safeText),
    );
  return "\uFEFF" + Papa.unparse({ fields, data }, { newline: "\r\n" });
}
export async function workbookBytes(
  sheets: { name: string; headers: string[]; rows: Cell[][] }[],
  instructions = true,
) {
  const Excel = await excelModule(),
    workbook = new Excel.Workbook();
  workbook.creator = "Kinoquill";
  workbook.created = new Date();
  for (const sheet of sheets) {
    const page = workbook.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    page.addRow(sheet.headers);
    page.addRows(sheet.rows);
    page.getRow(1).font = { bold: true, color: { argb: "FFF3F5F8" } };
    page.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF282E3A" },
    };
    page.getRow(1).height = 25;
    page.columns.forEach((column, index) => {
      column.width = Math.min(
        55,
        Math.max(15, sheet.headers[index].length + 3),
      );
      column.alignment = { vertical: "top", wrapText: true };
    });
    page.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, page.rowCount), column: sheet.headers.length },
    };
  }
  if (instructions) {
    const page = workbook.addWorksheet("Instructions");
    page.getColumn(1).width = 105;
    page.addRows([
      ["Kinoquill collection exchange · not a full backup"],
      [
        "Title and a known Title Type are required; choose a sheet fallback if type is blank.",
      ],
      [
        "Types: Movie, TV Series, TV Mini Series. Statuses: watchlist, watching, completed, on_hold, dropped, caught_up, unknown.",
      ],
      [
        "Ratings: 0–10; blank is unrated. Historical decimals are preserved. Configure 0–5 or 0–100 explicitly if needed.",
      ],
      [
        "Dates: ISO YYYY-MM-DD. Viewing dates can also be YYYY-MM or YYYY. Date Rated is source provenance, never Date Watched.",
      ],
      [
        'Separate genres, people, countries and categories with semicolons. JSON arrays preserve names containing separators, e.g. ["Doe, Jane"].',
      ],
      [
        "Choose Unknown when watch status is not known. No viewing date is assumed.",
      ],
      [
        "Seasons Watched / Episodes Watched are summaries, not episode history. Instructions are not selected for import.",
      ],
      [
        "CSV exports prefix dangerous text with an apostrophe and carry a Kinoquill Format marker; enable decoding only for trusted Kinoquill exports.",
      ],
      [
        "Exported sheets omit per-episode history, rewatches, settings and full provenance. Full backup/restore belongs to Phase 9.",
      ],
    ]);
    page.eachRow(
      (row) => (row.alignment = { wrapText: true, vertical: "top" }),
    );
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function collectionDownload(
  rows: ExportRow[],
  fields: string[],
  format: "csv" | "xlsx",
) {
  const selected = EXPORT_FIELDS.filter((field) => fields.includes(field));
  if (!selected.includes("Title"))
    throw new ValidationError(
      "Keep the Title field selected for a usable export.",
    );
  if (!selected.includes("Title Type")) selected.splice(1, 0, "Title Type");
  const matrix = (rows: ExportRow[]) =>
    rows.map((row) => selected.map((field) => row.values[field] ?? null));
  if (format === "csv")
    return {
      bytes: new TextEncoder().encode(csvText(selected, matrix(rows), true)),
      mime: "text/csv;charset=utf-8",
      name: "Kinoquill_Collection.csv",
    };
  return {
    bytes: await workbookBytes([
      {
        name: "Movies",
        headers: selected,
        rows: matrix(rows.filter((row) => row.mediaType === "movie")),
      },
      {
        name: "TV Shows",
        headers: selected,
        rows: matrix(rows.filter((row) => row.mediaType === "tv")),
      },
    ]),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    name: "Kinoquill_Collection.xlsx",
  };
}
export async function templateDownload(
  scope: "movies" | "shows" | "combined",
  format: "csv" | "xlsx",
) {
  const headers = EXPORT_FIELDS.filter(
      (field) => !["Seasons Watched", "Episodes Watched"].includes(field),
    ),
    sheet = { headers, rows: [] as Cell[][] };
  return format === "csv"
    ? {
        bytes: new TextEncoder().encode(csvText(headers, [])),
        mime: "text/csv;charset=utf-8",
        name: `Kinoquill_${scope}_Template.csv`,
      }
    : {
        bytes: await workbookBytes(
          scope === "combined"
            ? [
                { ...sheet, name: "Movies" },
                { ...sheet, name: "TV Shows" },
              ]
            : [{ ...sheet, name: scope === "movies" ? "Movies" : "TV Shows" }],
        ),
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        name: `Kinoquill_${scope}_Template.xlsx`,
      };
}
export function downloadFile(file: {
  bytes: Uint8Array;
  mime: string;
  name: string;
}) {
  const blob = new Blob([new Uint8Array(file.bytes)], { type: file.mime }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportDownload(batch: ImportBatch, records: ImportRecord[]) {
  const headers = [
    "File",
    "Batch",
    "Imported At",
    "Sheet",
    "Row",
    "Title",
    "Action",
    "Warnings",
    "Errors",
    "Source Date Rated",
    "Legacy Position",
  ];
  return {
    bytes: new TextEncoder().encode(
      csvText(
        headers,
        records.map((record) => [
          batch.originalFileName,
          batch.id,
          batch.importedAt,
          record.sheet,
          record.row,
          record.sourceTitle,
          record.action,
          record.warnings.join(" | "),
          record.errors.join(" | "),
          record.ratedDate.value,
          record.legacyPosition,
        ]),
      ),
    ),
    mime: "text/csv;charset=utf-8",
    name: "Kinoquill_Import_Report.csv",
  };
}
