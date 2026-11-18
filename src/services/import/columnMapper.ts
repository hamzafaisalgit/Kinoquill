import type { Field, ParsedSheet, SheetConfig } from "../../types/imports";
export const FIELDS: { value: Field; label: string; aliases: string[] }[] = [
  ["ignore", "Ignore column", ""],
  [
    "title",
    "Title",
    "title,movie,movie name,film,film title,show,show name,series name",
  ],
  ["originalTitle", "Original title", "original title,original name"],
  ["type", "Media type / subtype", "title type,media type,type,content type"],
  ["year", "Release year", "year,release year,released"],
  ["genres", "Genres", "genre,genres,categories of genre"],
  ["directors", "Directors", "director,directors"],
  ["creators", "Creators", "creator,creators"],
  [
    "rating",
    "Personal rating",
    "rating,my rating,your rating,personal rating,my score",
  ],
  [
    "runtime",
    "Runtime (minutes)",
    "runtime,runtime mins,runtime minutes,duration,duration minutes",
  ],
  [
    "releaseDate",
    "Release / first air date",
    "release date,date released,first air date",
  ],
  ["watchedDate", "Date watched", "date watched,watched on,viewing date"],
  ["ratedDate", "Date rated (source only)", "date rated,rating date"],
  ["startedAt", "Date started", "date started,started at"],
  ["completedAt", "Date completed", "date completed,completed at"],
  ["status", "Watch status", "status,watch status,viewing status"],
  [
    "categories",
    "Personal categories",
    "category,categories,personal categories",
  ],
  ["review", "Personal review", "review,personal review"],
  ["notes", "Notes (append to review)", "notes"],
  ["language", "Original language", "language,original language"],
  [
    "countries",
    "Production countries",
    "country,countries,production countries",
  ],
  ["favorite", "Favorite", "favorite,favourite,is favorite"],
  ["tmdbId", "TMDB ID", "tmdb id"],
  ["imdbId", "IMDb ID", "imdb id"],
  ["posterPath", "Poster path / HTTPS URL", "poster,poster path,poster url"],
  ["backdropPath", "Backdrop path / HTTPS URL", "backdrop,backdrop path"],
  ["overview", "Overview", "overview,description"],
  ["position", "Legacy position (source only)", "position,legacy position"],
].map(([value, label, aliases]) => ({
  value: value as Field,
  label,
  aliases: aliases.split(","),
}));
const key = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function visibleColumns(sheet: ParsedSheet, headerRow: number) {
  const rows = sheet.rows.filter((row) => row.number >= headerRow),
    width = Math.max(0, ...rows.map((row) => row.cells.length));
  return Array.from({ length: width }, (_, index) => index).filter((index) =>
    rows.some(
      (row) =>
        row.cells[index] !== null &&
        String(row.cells[index] ?? "").trim() !== "",
    ),
  );
}
export function autoMapping(
  sheet: ParsedSheet,
  headerRow: number,
): Record<number, Field> {
  const header =
    sheet.rows.find((row) => row.number === headerRow)?.cells ?? [];
  return Object.fromEntries(
    visibleColumns(sheet, headerRow).map((index) => {
      const name = key(String(header[index] ?? ""));
      const field =
        FIELDS.find(
          (field) =>
            field.value !== "ignore" &&
            field.aliases.some((alias) => key(alias) === name),
        )?.value ?? "ignore";
      if (name === "type") {
        const sample = sheet.rows
          .filter((row) => row.number > headerRow)
          .slice(0, 10)
          .map((row) => String(row.cells[index] ?? "").toLowerCase());
        if (
          !sample.some((value) =>
            /^(movie|film|tv|tv series|tv mini series|miniseries|tv show)$/.test(
              value,
            ),
          )
        )
          return [index, "ignore"];
      }
      return [index, field];
    }),
  );
}
export function defaultSheetConfig(sheet: ParsedSheet): SheetConfig {
  const headerRow = sheet.rows[0]?.number ?? 1;
  return {
    name: sheet.name,
    selected:
      sheet.name !== "Instructions" && sheet.name !== "Export Information",
    headerRow,
    defaultType: "",
    category: "",
    mapping: autoMapping(sheet, headerRow),
  };
}
export function mappingErrors(sheet: ParsedSheet, config: SheetConfig) {
  const fields = Object.values(config.mapping).filter(
      (field) => field !== "ignore",
    ),
    errors: string[] = [];
  if (!fields.includes("title"))
    errors.push(`${sheet.name}: map a Title column.`);
  for (const field of new Set(fields))
    if (fields.filter((value) => value === field).length > 1)
      errors.push(
        `${sheet.name}: multiple source columns map to ${field}. Choose one and ignore the others.`,
      );
  return errors;
}
