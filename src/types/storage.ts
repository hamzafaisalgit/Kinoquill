import type { LibraryPreferences } from "../utils/libraryState";
import type { JournalPreferences } from "./personal";
export interface AppSettings {
  id: "preferences";
  sidebarCollapsed: boolean;
  library?: LibraryPreferences;
  journal?: JournalPreferences;
}

export interface LocalMetadata {
  key: string;
  value: string;
}

export type StoragePhase = "initializing" | "ready" | "unavailable" | "error";
export interface StorageSnapshot {
  phase: StoragePhase;
  settings: AppSettings;
  saving: boolean;
  error: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "preferences",
  sidebarCollapsed: false,
};
