import type {
  Episode,
  EpisodeProgress,
  Season,
  SeasonTracking,
  ShowMetadata,
} from "../types/domain";
import { seasonProgress, tvProgress } from "./tvProgress";
/** Phase 2 public names delegate to the shared Phase 5 calculation engine. */
export function calculateSeasonProgress(
  season: Season,
  episodes: Episode[],
  progress: EpisodeProgress[],
  tracking?: SeasonTracking,
) {
  const result = seasonProgress(season, episodes, progress, tracking);
  return {
    ...result,
    watchedEpisodes: result.watched,
    cataloguedEpisodes: result.rows.length,
    totalKnownEpisodes: result.total,
  };
}
export function calculateShowProgress(
  seasons: Season[],
  episodes: Episode[],
  progress: EpisodeProgress[],
  tracking: SeasonTracking[] = [],
  metadata?: ShowMetadata,
) {
  const result = tvProgress(seasons, episodes, progress, tracking, metadata);
  return {
    ...result,
    watchedEpisodes: result.watched,
    totalKnownEpisodes: result.total,
    seasons: result.seasons.map((item) => ({
      ...item,
      watchedEpisodes: item.watched,
      totalKnownEpisodes: item.total,
      cataloguedEpisodes: item.rows.length,
    })),
  };
}
