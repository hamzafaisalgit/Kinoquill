import type { KinoquillDatabase } from "../../db/database";
import type {
  ImportMatch,
  ImportOptions,
  ImportPlan,
  ImportRow,
  ParsedFile,
  SheetConfig,
} from "../../types/imports";
import { TitleService } from "../titleService";
import { normalizeRow } from "./normalizer";
import { mappingErrors } from "./columnMapper";
import { ValidationError } from "../../utils/errors";
import { normalizeName } from "../../utils/normalization";
export async function localMatches(
  db: KinoquillDatabase,
  row: ImportRow,
): Promise<ImportMatch[]> {
  if (row.issues.some((issue) => issue.severity === "error")) return [];
  return Promise.all(
    (
      await new TitleService(db).findDuplicates({
        title: row.data.metadata.title,
        mediaType: row.data.metadata.mediaType,
        releaseYear: row.data.metadata.releaseYear,
        tmdbId: row.data.metadata.tmdbId,
        imdbId: row.data.metadata.imdbId,
      })
    ).map(async (match) => ({
      title: match.title,
      entry:
        (await db.libraryEntries
          .where("titleId")
          .equals(match.title.id)
          .first()) ?? null,
    })),
  );
}
export function strongMatch(row: ImportRow, match: ImportMatch) {
  return (
    (row.data.metadata.tmdbId != null &&
      row.data.metadata.tmdbId === match.title.tmdbId) ||
    (row.data.metadata.imdbId != null &&
      row.data.metadata.imdbId === match.title.imdbId)
  );
}
export async function buildPlan(
  db: KinoquillDatabase,
  file: ParsedFile,
  configs: SheetConfig[],
  options: ImportOptions,
  signal?: AbortSignal,
  onProgress?: (count: number, total: number) => void,
): Promise<ImportPlan> {
  const selected = configs.filter((config) => config.selected),
    rows: ImportRow[] = [];
  if (!selected.length) throw new ValidationError("Choose at least one sheet.");
  for (const config of selected) {
    const sheet = file.sheets.find((sheet) => sheet.name === config.name)!;
    const errors = mappingErrors(sheet, config);
    if (errors.length) throw new ValidationError(errors.join("\n"));
    for (const row of sheet.rows.filter((row) => row.number > config.headerRow))
      rows.push(normalizeRow(sheet, config, row, options));
  }
  if (!rows.length)
    throw new ValidationError(
      "Selected sheets contain no data below their header rows.",
    );
  return recheckPlan(
    db,
    {
      fileName: file.name,
      fileType: file.type,
      sheetNames: selected.map((config) => config.name),
      rows,
    },
    signal,
    onProgress,
  );
}
export async function recheckPlan(
  db: KinoquillDatabase,
  input: ImportPlan,
  signal?: AbortSignal,
  onProgress?: (count: number, total: number) => void,
): Promise<ImportPlan> {
  const plan = structuredClone(input),
    rows = plan.rows;
  const names = new Map<string, ImportRow[]>(),
    external = new Map<string, ImportRow[]>();
  for (let index = 0; index < rows.length; index++) {
    signal?.throwIfAborted();
    const row = rows[index],
      meta = row.data.metadata;
    row.matches = await localMatches(db, row);
    row.fileMatches = [];
    row.targetId = null;
    row.updateFields = [];
    row.action = row.issues.some((issue) => issue.severity === "error")
      ? "skip"
      : "add";
    if (row.issues.some((issue) => issue.severity === "error")) {
      onProgress?.(index + 1, rows.length);
      continue;
    }
    const nameKey = `${meta.mediaType}:${normalizeName(meta.title)}`,
      ids = [
        ...(meta.tmdbId != null
          ? [`${meta.mediaType}:tmdb:${meta.tmdbId}`]
          : []),
        ...(meta.imdbId ? [`${meta.mediaType}:imdb:${meta.imdbId}`] : []),
      ];
    const previous = new Map<string, { id: string; strong: boolean }>();
    for (const candidate of names.get(nameKey) ?? [])
      if (
        meta.releaseYear == null ||
        candidate.data.metadata.releaseYear == null ||
        meta.releaseYear === candidate.data.metadata.releaseYear
      )
        previous.set(candidate.id, { id: candidate.id, strong: false });
    for (const id of ids)
      for (const candidate of external.get(id) ?? [])
        previous.set(candidate.id, { id: candidate.id, strong: true });
    row.fileMatches = [...previous.values()];
    names.set(nameKey, [...(names.get(nameKey) ?? []), row]);
    for (const id of ids) external.set(id, [...(external.get(id) ?? []), row]);
    if (row.matches.length || row.fileMatches.length) {
      row.action = "skip";
      row.targetId = row.matches[0]?.title.id ?? null;
    }
    onProgress?.(index + 1, rows.length);
  }
  return plan;
}
