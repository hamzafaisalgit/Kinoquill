import { useLiveQuery } from "dexie-react-hooks";
import type { DependencyList } from "react";
import { catalog } from "../services/catalog";
import type { LibraryQuery } from "../types/domain";
import { useLocalStorage } from "./useLocalStorage";

export interface LocalQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useCatalogQuery<T>(
  query: () => Promise<T>,
  dependencies: DependencyList,
): LocalQueryResult<T> {
  const storage = useLocalStorage();
  const queryKey = JSON.stringify([
    ...dependencies,
    storage.phase,
    storage.error,
  ]);
  const result = useLiveQuery(
    async (): Promise<LocalQueryResult<T> & { queryKey: string }> => {
      if (storage.phase === "initializing")
        return { queryKey, data: undefined, isLoading: true, error: null };
      if (storage.phase !== "ready")
        return {
          queryKey,
          data: undefined,
          isLoading: false,
          error: new Error(storage.error ?? "Local storage is unavailable."),
        };
      try {
        return { queryKey, data: await query(), isLoading: false, error: null };
      } catch (error) {
        return {
          queryKey,
          data: undefined,
          isLoading: false,
          error:
            error instanceof Error
              ? error
              : new Error("Local data could not be read."),
        };
      }
    },
    [queryKey],
    { queryKey: "", data: undefined, isLoading: true, error: null },
  );
  // Dexie retains the previous result while resubscribing. A changed query must
  // show loading rather than another filter/title's stale records.
  return result.queryKey === queryKey
    ? result
    : { data: undefined, isLoading: true, error: null };
}

export function useLibrary(query: LibraryQuery = {}) {
  return useCatalogQuery(
    () => catalog.library.listLibraryEntries(query),
    [JSON.stringify(query)],
  );
}
export function useTitle(id: string) {
  return useCatalogQuery(() => catalog.titles.getTitleById(id), [id]);
}
export function useTitles(
  query: Parameters<typeof catalog.titles.listTitles>[0] = {},
) {
  return useCatalogQuery(
    () => catalog.titles.listTitles(query),
    [JSON.stringify(query)],
  );
}
export function useGenres() {
  return useCatalogQuery(() => catalog.genres.listGenres(), []);
}
export function useCategories() {
  return useCatalogQuery(() => catalog.categories.listCategories(), []);
}
export function useFavorites(query: LibraryQuery = {}) {
  return useLibrary({ ...query, favorite: true });
}
export function useWatchlist(query: LibraryQuery = {}) {
  return useLibrary({ ...query, status: "watchlist" });
}
export function useLibrarySummary() {
  return useCatalogQuery(() => catalog.library.getSummary(), []);
}
export function useMovie(id: string) {
  return useCatalogQuery(() => catalog.movies.getMovie(id), [id]);
}
export function useDeletedMovies() {
  return useCatalogQuery(() => catalog.movies.listDeletedMovies(), []);
}
export function usePeople() {
  return useCatalogQuery(() => catalog.people.listPeople(), []);
}
export function useMovieSummary() {
  return useCatalogQuery(() => catalog.movies.getSummary(), []);
}
export function useShow(id: string) {
  return useCatalogQuery(() => catalog.shows.getShow(id), [id]);
}
export function useShowTracking(id: string) {
  return useCatalogQuery(() => catalog.shows.tracking(id), [id]);
}
export function useContinueWatching() {
  return useCatalogQuery(() => catalog.shows.continueWatching(), []);
}
