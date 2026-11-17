import type {
  Episode,
  EpisodeProgress,
  Season,
  SeasonTracking,
  ShowMetadata,
} from "../types/domain";
import { localToday } from "./dates";

export function seasonProgress(
  season: Season,
  episodes: Episode[],
  progress: EpisodeProgress[],
  tracking?: SeasonTracking,
  today = localToday(),
) {
  const rows = [
    ...new Map(
      episodes
        .filter((episode) => episode.seasonId === season.id)
        .map((episode) => [episode.id, episode]),
    ).values(),
  ].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const watchedIds = new Set(
    progress.filter((item) => item.watched).map((item) => item.episodeId),
  );
  const approximate = tracking?.mode === "approximate";
  const watched = approximate
    ? tracking.approximateWatched
    : rows.filter((episode) => watchedIds.has(episode.id)).length;
  const total = season.episodeCount;
  const completeCatalog =
    total !== null &&
    rows.length === total &&
    rows.every((episode, index) => episode.episodeNumber === index + 1);
  const firstUnwatched = rows.find((episode) => !watchedIds.has(episode.id));
  const next =
    !approximate &&
    completeCatalog &&
    firstUnwatched?.airDate &&
    firstUnwatched.airDate <= today
      ? firstUnwatched
      : null;
  const future = rows.filter(
    (episode) => episode.airDate !== null && episode.airDate > today,
  ).length;
  return {
    season,
    tracking,
    rows,
    watched,
    total,
    approximate,
    completeCatalog,
    next,
    future,
    percentage:
      total !== null && total > 0
        ? Math.min(100, (watched / total) * 100)
        : null,
  };
}
export function tvProgress(
  seasons: Season[],
  episodes: Episode[],
  progress: EpisodeProgress[],
  tracking: SeasonTracking[],
  metadata?: ShowMetadata,
  today?: string,
) {
  const selected = seasons
    .filter((season) => metadata?.includeSpecials || season.seasonNumber !== 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const results = selected.map((season) =>
    seasonProgress(
      season,
      episodes,
      progress,
      tracking.find((item) => item.seasonId === season.id),
      today,
    ),
  );
  const missingSeasons =
    metadata?.totalSeasons != null &&
    seasons.filter((season) => season.seasonNumber > 0).length <
      metadata.totalSeasons;
  const knownTotal =
    results.length > 0 &&
    !missingSeasons &&
    results.every((item) => item.total !== null)
      ? results.reduce((sum, item) => sum + item.total!, 0)
      : null;
  // Show-level totals are useful even when season breakdowns have not been entered.
  const total =
    !metadata?.includeSpecials && metadata?.totalEpisodes != null
      ? Math.max(knownTotal ?? 0, metadata.totalEpisodes)
      : knownTotal;
  const watched = results.reduce((sum, item) => sum + item.watched, 0);
  const completeCatalog =
    !missingSeasons &&
    knownTotal !== null &&
    knownTotal === total &&
    results.every((item) => item.completeCatalog && !item.approximate);
  return {
    watched,
    total,
    percentage:
      total !== null && total > 0 && watched <= total
        ? (watched / total) * 100
        : null,
    approximate: results.some((item) => item.approximate),
    completedSeasons: results.filter(
      (item) =>
        item.total !== null && item.total > 0 && item.watched >= item.total,
    ).length,
    partialSeasons: results.filter(
      (item) =>
        item.watched > 0 && (item.total === null || item.watched < item.total),
    ).length,
    next: completeCatalog
      ? (results.find(
          (item) => item.total !== null && item.watched < item.total,
        )?.next ?? null)
      : null,
    future: results.reduce((sum, item) => sum + item.future, 0),
    seasons: results,
  };
}
export type TvProgress = ReturnType<typeof tvProgress>;
