import type { KinoquillDatabase } from "../db/database";
import type { DateValue, LibraryItem, LibraryQuery } from "../types/domain";
import { domainTables } from "./domainSupport";
import { pagination, paginate } from "./titleService";
import { normalizeName } from "../utils/normalization";
import { dateBounds, isCalendarDate, UNKNOWN_DATE } from "../utils/dates";
import { ValidationError, ConflictError } from "../utils/errors";

/** Shared read implementation for LibraryService; hydrate associations in batches. */
export async function queryLibrary(db: KinoquillDatabase, query: LibraryQuery) {
  const { page, pageSize } = pagination(query);
  for (const [low, high, min, max] of [
    [query.minRating, query.maxRating, 0, 10],
    [query.minYear, query.maxYear, 1, 9999],
  ])
    if (
      (low !== undefined &&
        (!Number.isFinite(low) || low < min! || low > max!)) ||
      (high !== undefined &&
        (!Number.isFinite(high) || high < min! || high > max!)) ||
      (low !== undefined && high !== undefined && low > high)
    )
      throw new ValidationError(
        "Filter minimum must not exceed maximum; use valid ratings (0–10) and years (1–9999).",
      );
  for (const [from, to] of [
    [query.addedFrom, query.addedTo],
    [query.watchedFrom, query.watchedTo],
  ])
    if (
      (from && !isCalendarDate(from)) ||
      (to && !isCalendarDate(to)) ||
      (from && to && from > to)
    )
      throw new ValidationError(
        "Use valid dates with the start no later than the end.",
      );
  return db.transaction("r", domainTables(db), async () => {
    const entries = await (
      query.status
        ? db.libraryEntries.where("status").equals(query.status)
        : db.libraryEntries.toCollection()
    )
      .filter(
        (entry) =>
          entry.deletedAt === null &&
          (query.favorite === undefined ||
            entry.isFavorite === query.favorite) &&
          (!query.unrated || entry.personalRating === null) &&
          (query.minRating === undefined ||
            (entry.personalRating !== null &&
              entry.personalRating >= query.minRating)) &&
          (query.maxRating === undefined ||
            (entry.personalRating !== null &&
              entry.personalRating <= query.maxRating)),
      )
      .toArray();
    // A single bulk cursor read avoids thousands of individual IDB requests.
    const titleMap =
      entries.length > 200
        ? new Map((await db.titles.toArray()).map((title) => [title.id, title]))
        : null;
    const titles = titleMap
      ? entries.map((entry) => titleMap.get(entry.titleId))
      : await db.titles.bulkGet(entries.map((entry) => entry.titleId));
    const titleIds = entries.map((entry) => entry.titleId),
      entryIds = entries.map((entry) => entry.id);
    const titleSet = new Set(titleIds),
      entrySet = new Set(entryIds),
      large = entries.length > 200;
    const [
      genres,
      people,
      categories,
      genreLinks,
      personLinks,
      categoryLinks,
      sessions,
    ] = await Promise.all([
      db.genres.toArray(),
      db.people.toArray(),
      db.categories.toArray(),
      large
        ? db.titleGenres
            .toArray()
            .then((rows) => rows.filter((row) => titleSet.has(row.titleId)))
        : db.titleGenres.where("titleId").anyOf(titleIds).toArray(),
      large
        ? db.titlePeople
            .toArray()
            .then((rows) => rows.filter((row) => titleSet.has(row.titleId)))
        : db.titlePeople.where("titleId").anyOf(titleIds).toArray(),
      large
        ? db.libraryCategories
            .toArray()
            .then((rows) =>
              rows.filter((row) => entrySet.has(row.libraryEntryId)),
            )
        : db.libraryCategories
            .where("libraryEntryId")
            .anyOf(entryIds)
            .toArray(),
      large
        ? db.viewingSessions
            .toArray()
            .then((rows) =>
              rows.filter((row) => entrySet.has(row.libraryEntryId)),
            )
        : db.viewingSessions.where("libraryEntryId").anyOf(entryIds).toArray(),
    ]);
    const group = <T>(rows: T[], key: (row: T) => string) => {
      const map = new Map<string, T[]>();
      for (const row of rows) {
        const id = key(row);
        map.set(id, [...(map.get(id) ?? []), row]);
      }
      return map;
    };
    const gMap = new Map(genres.map((row) => [row.id, row])),
      pMap = new Map(people.map((row) => [row.id, row])),
      cMap = new Map(categories.map((row) => [row.id, row]));
    const gs = group(genreLinks, (row) => row.titleId),
      ps = group(personLinks, (row) => row.titleId),
      cs = group(categoryLinks, (row) => row.libraryEntryId),
      vs = group(sessions, (row) => row.libraryEntryId);
    // Deleted references are ignored as stale URL filters, never dereferenced unsafely.
    const genreIds = [
      ...new Set([
        ...(query.genreIds ?? []),
        ...(query.genreId ? [query.genreId] : []),
      ]),
    ].filter((id) => gMap.has(id));
    const categoryIds = [
      ...new Set([
        ...(query.categoryIds ?? []),
        ...(query.categoryId ? [query.categoryId] : []),
      ]),
    ].filter((id) => cMap.has(id));
    const match = (wanted: string[], actual: string[], mode?: string) =>
      !wanted.length ||
      (mode === "all"
        ? wanted.every((id) => actual.includes(id))
        : wanted.some((id) => actual.includes(id)));
    const searchName = (value: string) =>
      normalizeName(value)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
    const words = searchName(query.search ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const items: LibraryItem[] = [];
    entries.forEach((entry, index) => {
      const title = titles[index];
      if (!title)
        throw new ConflictError(
          "A library entry references missing title metadata. No records were changed.",
        );
      if (
        (query.mediaType && title.mediaType !== query.mediaType) ||
        (query.mediaSubtype && title.mediaSubtype !== query.mediaSubtype) ||
        (query.releaseYear !== undefined &&
          title.releaseYear !== query.releaseYear) ||
        (query.minYear !== undefined &&
          (title.releaseYear === null || title.releaseYear < query.minYear)) ||
        (query.maxYear !== undefined &&
          (title.releaseYear === null || title.releaseYear > query.maxYear))
      )
        return;
      const genreRows = (gs.get(title.id) ?? []).flatMap(
        (link) => gMap.get(link.genreId) ?? [],
      );
      const personRows = [
        ...new Map(
          (ps.get(title.id) ?? [])
            .flatMap((link) => pMap.get(link.personId) ?? [])
            .map((person) => [person.id, person]),
        ).values(),
      ];
      const categoryRows = (cs.get(entry.id) ?? []).flatMap(
        (link) => cMap.get(link.categoryId) ?? [],
      );
      if (
        !match(
          genreIds,
          genreRows.map((row) => row.id),
          query.genreMatch,
        ) ||
        !match(
          categoryIds,
          categoryRows.map((row) => row.id),
          query.categoryMatch,
        )
      )
        return;
      if (
        query.languages?.length &&
        !query.languages.some(
          (value) =>
            normalizeName(value) ===
            normalizeName(title.originalLanguage ?? ""),
        )
      )
        return;
      if (
        query.countries?.length &&
        !query.countries.some((value) =>
          title.countries.some(
            (country) => normalizeName(country) === normalizeName(value),
          ),
        )
      )
        return;
      const text = words.length
        ? searchName(
            [
              title.title,
              title.originalTitle,
              entry.personalReview,
              ...genreRows.map((row) => row.name),
              ...personRows.map((row) => row.name),
              ...categoryRows.map((row) => row.name),
              ...(vs.get(entry.id) ?? []).map((row) => row.notes),
            ]
              .filter(Boolean)
              .join(" "),
          )
        : "";
      if (!words.every((word) => text.includes(word))) return;
      const dates = [
        entry.completedAt,
        ...(vs.get(entry.id) ?? []).map((row) => row.viewedDate),
      ]
        .filter((date) => date.precision !== "unknown")
        .sort((a, b) => dateBounds(b)![0].localeCompare(dateBounds(a)![0]));
      const watchedDate = dates[0] ?? UNKNOWN_DATE;
      const overlaps = (date: DateValue) => {
        const bounds = dateBounds(date);
        return (
          !!bounds &&
          (!query.watchedFrom || bounds[1] >= query.watchedFrom) &&
          (!query.watchedTo || bounds[0] <= query.watchedTo)
        );
      };
      if ((query.watchedFrom || query.watchedTo) && !dates.some(overlaps))
        return;
      const added = entry.dateAdded.slice(0, 10);
      if (
        (query.addedFrom && added < query.addedFrom) ||
        (query.addedTo && added > query.addedTo)
      )
        return;
      items.push({
        title,
        entry,
        genres: genreRows,
        people: personRows,
        categories: categoryRows,
        watchedDate,
      });
    });
    items.sort((a, b) => {
      const sort = query.sort ?? "newest";
      let result: number;
      const nullable = (
        a: number | string | null,
        b: number | string | null,
        desc: boolean,
      ) =>
        a === null
          ? b === null
            ? 0
            : 1
          : b === null
            ? -1
            : (typeof a === "number" && typeof b === "number"
                ? a - b
                : String(a).localeCompare(String(b))) * (desc ? -1 : 1);
      if (sort.startsWith("title_"))
        result =
          a.title.normalizedTitle.localeCompare(b.title.normalizedTitle) *
          (sort === "title_desc" ? -1 : 1);
      else if (sort.startsWith("rating_"))
        result = nullable(
          a.entry.personalRating,
          b.entry.personalRating,
          sort === "rating_desc",
        );
      else if (sort.startsWith("year_"))
        result = nullable(
          a.title.releaseYear,
          b.title.releaseYear,
          sort === "year_desc",
        );
      else if (sort.startsWith("runtime_"))
        result = nullable(
          a.title.runtimeMinutes,
          b.title.runtimeMinutes,
          sort === "runtime_desc",
        );
      else if (sort.startsWith("watched_"))
        result = nullable(
          dateBounds(a.watchedDate ?? UNKNOWN_DATE)?.[0] ?? null,
          dateBounds(b.watchedDate ?? UNKNOWN_DATE)?.[0] ?? null,
          sort === "watched_desc",
        );
      else
        result =
          a.entry.dateAdded.localeCompare(b.entry.dateAdded) *
          (sort === "newest" ? -1 : 1);
      return result || a.entry.id.localeCompare(b.entry.id);
    });
    return paginate(items, page, pageSize);
  });
}
