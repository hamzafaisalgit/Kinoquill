import { useSyncExternalStore } from "react";
import { getTmdbSession, subscribeTmdbSession } from "../services/tmdb/client";
export function useTmdbSession() {
  return useSyncExternalStore(
    subscribeTmdbSession,
    getTmdbSession,
    getTmdbSession,
  );
}
