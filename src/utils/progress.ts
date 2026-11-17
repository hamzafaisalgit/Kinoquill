import type { Episode, EpisodeProgress, Season } from "../types/domain";

export function calculateSeasonProgress(
  season: Season,
  episodes: Episode[],
  progress: EpisodeProgress[],
) {
  const episodeIds = new Set(
    episodes
      .filter((episode) => episode.seasonId === season.id)
      .map((episode) => episode.id),
  );
  const watched = new Set(
    progress
      .filter((item) => item.watched && episodeIds.has(item.episodeId))
      .map((item) => item.episodeId),
  ).size;
  // A partial episode catalog provides a lower bound, never a fabricated total.
  const totalKnownEpisodes = season.episodeCount;
  const percentage =
    totalKnownEpisodes !== null && totalKnownEpisodes > 0
      ? Math.min(100, (watched / totalKnownEpisodes) * 100)
      : null;
  return {
    watchedEpisodes: watched,
    cataloguedEpisodes: episodeIds.size,
    totalKnownEpisodes,
    percentage,
  };
}
export function calculateShowProgress(
  seasons: Season[],
  episodes: Episode[],
  progress: EpisodeProgress[],
) {
  const results = seasons.map((season) =>
    calculateSeasonProgress(season, episodes, progress),
  );
  const watchedEpisodes = results.reduce(
    (sum, result) => sum + result.watchedEpisodes,
    0,
  );
  const totalKnownEpisodes =
    results.length &&
    results.every((result) => result.totalKnownEpisodes !== null)
      ? results.reduce((sum, result) => sum + result.totalKnownEpisodes!, 0)
      : null;
  return {
    watchedEpisodes,
    totalKnownEpisodes,
    percentage:
      totalKnownEpisodes !== null && totalKnownEpisodes > 0
        ? (watchedEpisodes / totalKnownEpisodes) * 100
        : null,
    seasons: results,
  };
}
