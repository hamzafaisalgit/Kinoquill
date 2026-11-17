import { useEffect, useSyncExternalStore } from "react";
import { localDatabase } from "../services/localDatabase";

export function useLocalStorage() {
  const snapshot = useSyncExternalStore(
    localDatabase.subscribe,
    localDatabase.getSnapshot,
    localDatabase.getSnapshot,
  );
  useEffect(() => {
    void localDatabase.initialize();
  }, []);
  return {
    ...snapshot,
    retry: localDatabase.initialize,
    updateSettings: localDatabase.updateSettings,
    version: localDatabase.getVersionInfo(),
  };
}
