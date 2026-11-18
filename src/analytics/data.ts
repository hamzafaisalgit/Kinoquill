import type { KinoquillDatabase } from "../db/database";
import { domainTables } from "../services/domainSupport";
import { localDatabase } from "../services/localDatabase";
import { useCatalogQuery } from "../hooks/useCatalog";
import type { AnalyticsSnapshot } from "./types";
/** One consistent read observed by Dexie. Charts never query storage individually. */
export function readAnalytics(
  db: KinoquillDatabase,
): Promise<AnalyticsSnapshot> {
  return db.transaction("r", domainTables(db), async () => {
    const [
      titles,
      entries,
      genres,
      people,
      categories,
      titleGenres,
      titlePeople,
      libraryCategories,
      sessions,
      seasons,
      episodes,
      progress,
      metadata,
      tracking,
    ] = await Promise.all([
      db.titles.toArray(),
      db.libraryEntries.toArray(),
      db.genres.toArray(),
      db.people.toArray(),
      db.categories.toArray(),
      db.titleGenres.toArray(),
      db.titlePeople.toArray(),
      db.libraryCategories.toArray(),
      db.viewingSessions.toArray(),
      db.seasons.toArray(),
      db.episodes.toArray(),
      db.episodeProgress.toArray(),
      db.showMetadata.toArray(),
      db.seasonTracking.toArray(),
    ]);
    return {
      titles,
      entries,
      genres,
      people,
      categories,
      titleGenres,
      titlePeople,
      libraryCategories,
      sessions,
      seasons,
      episodes,
      progress,
      metadata,
      tracking,
    };
  });
}
export function useAnalyticsData() {
  return useCatalogQuery(() => readAnalytics(localDatabase.database), []);
}
