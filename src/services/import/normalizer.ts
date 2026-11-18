import type {
  Cell,
  ImportData,
  ImportOptions,
  ImportRow,
  ParsedSheet,
  RowIssue,
  SheetConfig,
} from "../../types/imports";
import type { DateValue, MediaSubtype, WatchStatus } from "../../types/domain";
import { UNKNOWN_DATE, isCalendarDate } from "../../utils/dates";
import { titleCreateSchema, libraryBaseSchema } from "../../utils/validation";
import { normalizeName } from "../../utils/normalization";
import { movieImage } from "../../utils/movieImages";
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  defaultStatus: "unknown",
  ratingScale: 10,
  dateFormat: "auto",
  categories: [],
  enrichment: false,
  decodeSafeText: false,
};
export function splitNames(value: string) {
  let values = value.split(/[,;\n|]/);
  if (value.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string")
      )
        values = parsed;
    } catch {
      /* Ordinary delimited text remains supported. */
    }
  }
  return uniqueNames(values);
}
function uniqueNames(values: string[]) {
  return [
    ...new Map(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((name) => [normalizeName(name), name]),
    ).values(),
  ];
}
export function mediaType(value: string): MediaSubtype | null {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
  return ["movie", "film"].includes(key)
    ? "movie"
    : ["tv", "tv series", "tv show", "series"].includes(key)
      ? "tv_series"
      : [
            "tv mini series",
            "tv miniseries",
            "mini series",
            "miniseries",
            "limited series",
          ].includes(key)
        ? "tv_miniseries"
        : null;
}
export function parseDate(
  value: Cell,
  format: ImportOptions["dateFormat"],
): DateValue {
  const text = String(value ?? "").trim();
  if (!text) return UNKNOWN_DATE;
  if (/^(?!0000)\d{4}$/.test(text)) return { precision: "year", value: text };
  if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(text))
    return { precision: "month", value: text };
  if (isCalendarDate(text)) return { precision: "day", value: text };
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!parts || format === "iso")
    throw new Error(
      "Use a valid ISO date or choose the matching day/month date format.",
    );
  const a = Number(parts[1]),
    b = Number(parts[2]);
  let day: number, month: number;
  if (format === "dmy" || (format === "auto" && a > 12)) {
    day = a;
    month = b;
  } else if (format === "mdy" || (format === "auto" && b > 12)) {
    day = b;
    month = a;
  } else if (format === "auto" && a === b) {
    day = a;
    month = b;
  } else
    throw new Error(
      "Ambiguous date. Choose DD/MM/YYYY or MM/DD/YYYY explicitly.",
    );
  const iso = `${parts[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isCalendarDate(iso))
    throw new Error(
      "This calendar date is invalid. Correct it or clear the source value.",
    );
  return { precision: "day", value: iso };
}
const statusMap: Record<string, WatchStatus> = {
  watchlist: "watchlist",
  "to watch": "watchlist",
  watching: "watching",
  completed: "completed",
  watched: "completed",
  "on hold": "on_hold",
  paused: "on_hold",
  dropped: "dropped",
  "caught up": "caught_up",
  unknown: "unknown",
};
export function normalizeRow(
  sheet: ParsedSheet,
  config: SheetConfig,
  row: ParsedSheet["rows"][number],
  options: ImportOptions,
): ImportRow {
  const issues: RowIssue[] = [];
  const error = (
    field: string,
    message: string,
    suggestion = "Correct the mapped value or skip this row.",
  ) => issues.push({ field, message, severity: "error", suggestion });
  const warn = (field: string, message: string) =>
    issues.push({
      field,
      message,
      severity: "warning",
      suggestion:
        "Review before importing; incomplete historical records are allowed.",
    });
  const source: Record<string, string> = {};
  for (const [index, field] of Object.entries(config.mapping)) {
    if (field === "ignore") continue;
    let value = String(row.cells[Number(index)] ?? "").trim();
    if (
      options.decodeSafeText &&
      (/^'(?=\s*[=+\-@\t\r])/.test(value) || value.startsWith("''"))
    )
      value = value.slice(1);
    source[field] = value;
  }
  const numeric = (field: string, pattern?: RegExp) => {
    const text = source[field];
    if (!text) return null;
    const clean = pattern ? text.replace(pattern, "") : text;
    const number = Number(clean);
    if (!clean.trim() || !Number.isFinite(number)) {
      error(field, "Not a valid number.");
      return null;
    }
    return number;
  };
  const date = (field: string): DateValue => {
    try {
      return parseDate(source[field] ?? "", options.dateFormat);
    } catch (cause) {
      error(field, cause instanceof Error ? cause.message : "Invalid date.");
      return UNKNOWN_DATE;
    }
  };
  const type = source.type
    ? mediaType(source.type)
    : config.defaultType || null;
  if (!type)
    error(
      "type",
      source.type
        ? `Unrecognized media type “${source.type}”.`
        : "Media type is missing.",
      "Map a Title Type column or choose the sheet fallback. Explicit row types take priority.",
    );
  const release = date("releaseDate"),
    watched = date("watchedDate"),
    startedAt = date("startedAt"),
    completed = date("completedAt"),
    ratedDate = date("ratedDate");
  if (release.precision !== "unknown" && release.precision !== "day")
    error(
      "releaseDate",
      "Release dates require an exact day. Put year-only values in Release Year.",
    );
  const rating = numeric("rating"),
    personalRating =
      rating === null
        ? null
        : options.ratingScale === 5
          ? rating * 2
          : options.ratingScale === 100
            ? rating / 10
            : rating;
  if (rating !== null && (rating < 0 || rating > options.ratingScale))
    error("rating", `Rating must be between 0 and ${options.ratingScale}.`);
  const runtime = numeric("runtime", /\s*(min|mins|minute|minutes)\s*$/i);
  if (runtime !== null && (!Number.isInteger(runtime) || runtime <= 0))
    error("runtime", "Runtime must be a positive whole number of minutes.");
  const releaseYear = numeric("year");
  let status: WatchStatus = options.defaultStatus;
  if (source.status) {
    const mapped =
      statusMap[
        source.status.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ")
      ];
    if (mapped) status = mapped;
    else error("status", `Unknown watch status “${source.status}”.`);
  }
  let favorite = false;
  if (source.favorite) {
    if (/^(true|yes|1|y)$/i.test(source.favorite)) favorite = true;
    else if (!/^(false|no|0|n)$/i.test(source.favorite))
      error("favorite", "Use Yes/No, True/False, or 1/0.");
  }
  const genres = splitNames(source.genres ?? ""),
    categories = uniqueNames([
      ...splitNames(source.categories ?? ""),
      config.category,
      ...options.categories,
    ]);
  const people = uniqueNames([
    ...splitNames(source.directors ?? ""),
    ...splitNames(source.creators ?? ""),
  ]).map((name) => ({
    name,
    role: type === "movie" ? ("director" as const) : ("creator" as const),
  }));
  if (source.notes)
    warn(
      "notes",
      "Notes are appended to the personal review, keeping both text values.",
    );
  const review =
    [source.review, source.notes ? `Notes: ${source.notes}` : ""]
      .filter(Boolean)
      .join("\n\n") || null;
  const data: ImportData = {
    metadata: {
      title: source.title ?? "",
      originalTitle: source.originalTitle || null,
      mediaType: type === "movie" ? "movie" : "tv",
      mediaSubtype: type || "tv_series",
      releaseYear,
      releaseDate: release.precision === "day" ? release.value : null,
      runtimeMinutes: runtime,
      overview: source.overview || null,
      originalLanguage: source.language || null,
      countries: splitNames(source.countries ?? ""),
      posterPath: source.posterPath || null,
      backdropPath: source.backdropPath || null,
      tmdbId: numeric("tmdbId"),
      imdbId: source.imdbId || null,
      metadataSource: "import",
    },
    library: {
      status,
      personalRating,
      personalReview: review,
      isFavorite: favorite,
      startedAt,
      completedAt: completed.precision !== "unknown" ? completed : watched,
    },
    genres,
    people,
    categories,
    ratedDate,
    legacyPosition: source.position || null,
    watchedDate: watched,
  };
  for (const schemaResult of [
    titleCreateSchema.safeParse(data.metadata),
    libraryBaseSchema.safeParse(data.library),
  ])
    if (!schemaResult.success)
      for (const issue of schemaResult.error.issues)
        error(issue.path.join("."), issue.message);
  for (const field of ["posterPath", "backdropPath"] as const)
    if (data.metadata[field] && !movieImage(data.metadata[field]))
      error(field, "Use a safe TMDB image path or HTTPS artwork URL.");
  if (!genres.length)
    warn(
      "genres",
      "No genre recorded. The imported entry will be flagged for review.",
    );
  if (!releaseYear) warn("year", "Release year is unknown.");
  if (personalRating === null)
    warn("rating", "Unrated is preserved; no zero rating will be invented.");
  if (!people.length)
    warn("people", "No directors or creators were supplied; this is optional.");
  if (status === "unknown")
    warn("status", "Watch status remains Unknown — review later.");
  if (source.ratedDate)
    warn(
      "ratedDate",
      "Date Rated is kept as source provenance only. It never becomes a viewing date.",
    );
  if (sheet.notices.length)
    for (const notice of sheet.notices) warn("sheet", notice);
  return {
    id: `${config.name}:${row.number}`,
    sheet: config.name,
    row: row.number,
    data,
    issues,
    matches: [],
    fileMatches: [],
    action: issues.some((issue) => issue.severity === "error") ? "skip" : "add",
    targetId: null,
    updateFields: [],
  };
}
