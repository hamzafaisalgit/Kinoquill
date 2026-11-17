import { KinoquillDatabase } from "../db/database";
import { DEFAULT_SETTINGS } from "../types/storage";
import type { AppSettings, StorageSnapshot } from "../types/storage";
import { seedGenres } from "../db/seed";
import { libraryPreferences } from "../utils/libraryState";

export function describeStorageError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError")
    return "This browser has insufficient storage space. Free some space and try again. Your existing data has not been reset.";
  if (name === "SecurityError" || name === "MissingAPIError")
    return "Browser storage is unavailable. Allow site storage or use a browser profile that supports IndexedDB.";
  if (name === "BlockedError")
    return "A storage upgrade is blocked. Close other Kinoquill tabs, then try again.";
  return "Local storage could not be accessed. Check browser storage permissions and try again. No temporary storage fallback is being used.";
}

export class LocalDatabaseService {
  readonly database: KinoquillDatabase;
  private snapshot: StorageSnapshot = {
    phase: "initializing",
    settings: { ...DEFAULT_SETTINGS },
    saving: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private initializing: Promise<void> | null = null;

  constructor(database = new KinoquillDatabase()) {
    this.database = database;
    database.on("blocked", () => {
      this.publish({
        phase: "error",
        error: describeStorageError(new DOMException("", "BlockedError")),
      });
    });
    database.on("versionchange", () => {
      database.close();
      this.publish({
        phase: "error",
        error:
          "Another Kinoquill tab updated local storage. Reload this page to continue safely.",
      });
    });
  }

  getSnapshot = (): StorageSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<StorageSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  initialize = (): Promise<void> => {
    if (this.initializing) return this.initializing;
    if (this.snapshot.phase === "ready") return Promise.resolve();
    this.publish({ phase: "initializing", error: null });
    this.initializing = this.openAndCheck().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  };

  private async openAndCheck(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (typeof indexedDB === "undefined")
        throw new DOMException("", "MissingAPIError");
      await Promise.race([
        this.database.open(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new DOMException("", "BlockedError")),
            6000,
          );
        }),
      ]);
      const settings = await this.database.transaction(
        "rw",
        this.database.appSettings,
        this.database.localMetadata,
        async () => {
          const stored = await this.database.appSettings.get("preferences");
          const settings = { ...DEFAULT_SETTINGS, ...stored };
          if (!stored) await this.database.appSettings.put(settings);
          const check = new Date().toISOString();
          await this.database.localMetadata.put({
            key: "storage-check",
            value: check,
          });
          if (
            (await this.database.localMetadata.get("storage-check"))?.value !==
            check
          )
            throw new Error("Storage verification failed");
          return settings;
        },
      );
      await seedGenres(this.database);
      this.publish({ phase: "ready", settings, error: null });
    } catch (error) {
      this.database.close();
      const unavailable =
        error instanceof Error &&
        ["MissingAPIError", "SecurityError"].includes(error.name);
      this.publish({
        phase: unavailable ? "unavailable" : "error",
        error: describeStorageError(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async readSettings(): Promise<AppSettings> {
    return {
      ...DEFAULT_SETTINGS,
      ...(await this.database.appSettings.get("preferences")),
    };
  }

  updateSettings = async (
    patch: Partial<Pick<AppSettings, "sidebarCollapsed" | "library">>,
  ): Promise<void> => {
    if (this.snapshot.phase !== "ready" || this.snapshot.saving) return;
    this.publish({ saving: true });
    try {
      if (
        patch.sidebarCollapsed !== undefined &&
        typeof patch.sidebarCollapsed !== "boolean"
      )
        throw new TypeError("Invalid sidebar preference");
      const settings = await this.database.transaction(
        "rw",
        this.database.appSettings,
        async () => {
          const settings = {
            ...(await this.readSettings()),
            ...patch,
            ...(patch.library
              ? { library: libraryPreferences(patch.library) }
              : {}),
          };
          await this.database.appSettings.put(settings);
          return settings;
        },
      );
      this.publish({ settings, saving: false, error: null });
    } catch (error) {
      // Keep the last confirmed preference; never imply a failed write was saved.
      this.publish({
        phase: "error",
        saving: false,
        error: describeStorageError(error),
      });
    }
  };

  getVersionInfo() {
    return { name: this.database.name, version: this.database.verno };
  }
}

export const localDatabase = new LocalDatabaseService();
