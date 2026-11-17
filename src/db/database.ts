import Dexie, { type Table } from "dexie";
import type { AppSettings, LocalMetadata } from "../types/storage";

export const DATABASE_NAME = "kinoquill_local";
export const DATABASE_VERSION = 1;

export class KinoquillDatabase extends Dexie {
  appSettings!: Table<AppSettings, string>;
  localMetadata!: Table<LocalMetadata, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    // Keep the database name stable; evolve schemas with additive version upgrades.
    this.version(DATABASE_VERSION).stores({
      appSettings: "&id",
      localMetadata: "&key",
    });
  }
}
