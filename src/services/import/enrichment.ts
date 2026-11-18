import type { ImportRow } from "../../types/imports";
import type { DiscoveryMetadata } from "../tmdb/types";
import { searchTitles, getTitleDetails } from "../tmdb/api";
export function enrichmentCandidates(row: ImportRow, signal: AbortSignal) {
  return searchTitles(
    row.data.metadata.title,
    row.data.metadata.mediaType,
    signal,
  );
}
export function enrichmentDetails(
  id: number,
  row: ImportRow,
  signal: AbortSignal,
) {
  return getTitleDetails(id, row.data.metadata.mediaType, signal);
}
export function applyMissingMetadata(
  row: ImportRow,
  details: DiscoveryMetadata,
  includePeople: boolean,
): ImportRow {
  const next = structuredClone(row);
  const warnings: ImportRow["issues"] = [];
  for (const [key, value] of Object.entries(details.metadata)) {
    if (
      [
        "title",
        "mediaType",
        "mediaSubtype",
        "metadataSource",
        "metadataLastSyncedAt",
      ].includes(key)
    )
      continue;
    const current = next.data.metadata[key as keyof typeof next.data.metadata];
    if (
      (key === "releaseDate" &&
        typeof value === "string" &&
        next.data.metadata.releaseYear != null &&
        Number(value.slice(0, 4)) !== next.data.metadata.releaseYear) ||
      (key === "releaseYear" &&
        typeof value === "number" &&
        next.data.metadata.releaseDate &&
        Number(next.data.metadata.releaseDate.slice(0, 4)) !== value)
    ) {
      warnings.push({
        field: key,
        severity: "warning",
        message:
          "TMDB release information conflicts with the source year/date, so that field was not filled.",
        suggestion:
          "Choose another production or correct source release information explicitly.",
      });
      continue;
    }
    if (
      current == null ||
      current === "" ||
      (Array.isArray(current) && current.length === 0)
    )
      Object.assign(next.data.metadata, { [key]: value });
  }
  if (!next.data.genres.length) next.data.genres = details.genres;
  if (includePeople && !next.data.people.length)
    next.data.people = details.suggestions;
  next.issues = next.issues.filter(
    (issue) =>
      !(
        issue.severity === "warning" &&
        ((issue.field === "year" && next.data.metadata.releaseYear) ||
          (issue.field === "genres" && next.data.genres.length) ||
          (issue.field === "people" && next.data.people.length))
      ),
  );
  next.issues.push(...warnings);
  return next;
}
