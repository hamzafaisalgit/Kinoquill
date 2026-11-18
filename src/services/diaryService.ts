import type { KinoquillDatabase } from "../db/database";
import { domainTables } from "./domainSupport";
import { dateWithin } from "../analytics/filters";
import { isCalendarDate } from "../utils/dates";
import type { DiaryQuery } from "./personalService";
export function readDiary(
  db: KinoquillDatabase,
  query: DiaryQuery = {},
  entryId?: string,
  episodeId?: string,
) {
  return db.transaction("r", domainTables(db), async () => {
    if (
      (query.from && !isCalendarDate(query.from)) ||
      (query.to && !isCalendarDate(query.to)) ||
      (query.from && query.to && query.from > query.to)
    )
      throw new Error(
        "Use valid viewing dates with the start no later than the end.",
      );
    const [entries, titles, categories] = await Promise.all([
      db.libraryEntries.toArray(),
      db.titles.toArray(),
      db.libraryCategories.toArray(),
    ]);
    const active = new Map(
        entries.filter((e) => e.deletedAt === null).map((e) => [e.id, e]),
      ),
      ts = new Map(titles.map((t) => [t.id, t]));
    const categoryEntries = query.categoryId
      ? new Set(
          categories
            .filter((c) => c.categoryId === query.categoryId)
            .map((c) => c.libraryEntryId),
        )
      : null;
    const sessions = await (
      entryId
        ? db.viewingSessions.where("libraryEntryId").equals(entryId)
        : db.viewingSessions.toCollection()
    ).toArray();
    const matching = sessions
      .flatMap((session) => {
        const entry = active.get(session.libraryEntryId),
          title = entry ? ts.get(entry.titleId) : null;
        if (!entry || !title || (episodeId && session.episodeId !== episodeId))
          return [];
        if (
          (query.media === "movie" && title.mediaType !== "movie") ||
          (query.media === "episode" && !session.episodeId) ||
          (query.media === "show" &&
            (title.mediaType !== "tv" || session.episodeId))
        )
          return [];
        if (query.kind && query.kind !== session.sessionType) return [];
        if (query.categoryId && !categoryEntries!.has(entry.id)) return [];
        if (
          (query.from || query.to) &&
          !dateWithin(session.viewedDate, [
            query.from || "0001-01-01",
            query.to || "9999-12-31",
          ])
        )
          return [];
        return [{ session, entry, title }];
      })
      .sort((a, b) => {
        if (a.session.viewedDate.precision === "unknown")
          return b.session.viewedDate.precision === "unknown"
            ? a.session.id.localeCompare(b.session.id)
            : 1;
        if (b.session.viewedDate.precision === "unknown") return -1;
        return (
          a.session.viewedDate.value!.localeCompare(
            b.session.viewedDate.value!,
          ) * (query.sort === "oldest" ? 1 : -1) ||
          a.session.id.localeCompare(b.session.id)
        );
      });
    const page = Math.max(1, Math.floor(query.page ?? 1)),
      pageSize = 24;
    const selected = matching.slice((page - 1) * pageSize, page * pageSize);
    const episodeRows = await db.episodes.bulkGet([
      ...new Set(
        selected.flatMap((r) =>
          r.session.episodeId ? [r.session.episodeId] : [],
        ),
      ),
    ]);
    const episodes = episodeRows.flatMap((ep) => ep ?? []),
      es = new Map(episodes.map((ep) => [ep.id, ep]));
    const seasonRows = await db.seasons.bulkGet([
        ...new Set(episodes.map((ep) => ep.seasonId)),
      ]),
      ss = new Map(seasonRows.flatMap((s) => (s ? [[s.id, s] as const] : [])));
    const known = matching
      .filter((r) => r.session.viewedDate.precision !== "unknown")
      .sort((a, b) =>
        a.session.viewedDate.value!.localeCompare(b.session.viewedDate.value!),
      );
    const first = known.find((r) => r.session.sessionType === "first_watch");
    return {
      items: selected.map((row) => {
        const episode = row.session.episodeId
          ? es.get(row.session.episodeId)
          : undefined;
        return {
          ...row,
          episode,
          season: episode ? ss.get(episode.seasonId) : undefined,
        };
      }),
      firstWatchDate: first?.session.viewedDate ?? null,
      latestDate: known.at(-1)?.session.viewedDate ?? null,
      total: matching.length,
      page,
      totalPages: Math.ceil(matching.length / pageSize),
      undated: matching.filter(
        (r) => r.session.viewedDate.precision === "unknown",
      ).length,
    };
  });
}
export type DiaryItem = Awaited<ReturnType<typeof readDiary>>["items"][number];
