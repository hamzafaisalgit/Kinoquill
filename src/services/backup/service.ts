import type { KinoquillDatabase } from "../../db/database";
import {
  BACKUP_STORES,
  validateBackup,
  MAX_BACKUP_BYTES,
  type CompleteBackup,
} from "./validation";
import { DEFAULT_SETTINGS } from "../../types/storage";
import { localToday } from "../../utils/dates";
export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  if (blob.size > MAX_BACKUP_BYTES)
    throw new Error(
      "This complete backup exceeds the 25 MB browser limit. No data was changed.",
    );
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export class BackupService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async snapshot(): Promise<CompleteBackup> {
    return this.db.transaction(
      "r",
      BACKUP_STORES.map((n) => this.db.table(n)),
      async () => {
        const data = Object.fromEntries(
          await Promise.all(
            BACKUP_STORES.map(async (name) => [
              name,
              await this.db.table(name).toArray(),
            ]),
          ),
        );
        return validateBackup({
          format: "kinoquill-backup",
          backupVersion: 1,
          schemaVersion: 5,
          appVersion: "0.1.0",
          exportedAt: new Date().toISOString(),
          data,
        });
      },
    );
  }
  async download() {
    const backup = await this.snapshot();
    downloadJson(backup, `kinoquill-backup-${localToday()}.json`);
    return backup;
  }
  async parse(file: File) {
    if (!file.name.toLowerCase().endsWith(".json"))
      throw new Error("Select a Kinoquill JSON backup.");
    if (file.size > MAX_BACKUP_BYTES)
      throw new Error("Backup exceeds the 25 MB browser restore limit.");
    let value: unknown;
    try {
      value = JSON.parse(await file.text());
    } catch {
      throw new Error("This file is not valid JSON. Select another backup.");
    }
    return validateBackup(value);
  }
  async restore(input: unknown, confirmation: string) {
    if (confirmation !== "REPLACE")
      throw new Error("Type REPLACE to confirm replacement.");
    const backup = validateBackup(structuredClone(input));
    await this.db.transaction(
      "rw",
      BACKUP_STORES.map((n) => this.db.table(n)),
      async () => {
        for (const name of BACKUP_STORES) await this.db.table(name).clear();
        for (const name of BACKUP_STORES)
          await this.db.table(name).bulkPut(backup.data[name]);
        for (const name of BACKUP_STORES) {
          const rows = await this.db.table(name).toArray();
          if (rows.length !== backup.data[name].length)
            throw new Error(`Restore verification failed for ${name}.`);
          const keys = (values: unknown[]) =>
            values
              .map((row) =>
                JSON.stringify(
                  this.db.table(name).schema.primKey.keyPath instanceof Array
                    ? (
                        this.db.table(name).schema.primKey.keyPath as string[]
                      ).map((k) => (row as Record<string, unknown>)[k])
                    : (row as Record<string, unknown>)[
                        this.db.table(name).schema.primKey.keyPath as string
                      ],
                ),
              )
              .sort()
              .join("\n");
          if (keys(rows) !== keys(backup.data[name]))
            throw new Error(
              `Restore identity verification failed for ${name}.`,
            );
        }
      },
    );
    return Object.fromEntries(
      BACKUP_STORES.map((n) => [n, backup.data[n].length]),
    );
  }
  async clear(confirmation: string) {
    if (confirmation !== "DELETE")
      throw new Error("Type DELETE to clear local data.");
    await this.db.transaction(
      "rw",
      BACKUP_STORES.map((n) => this.db.table(n)),
      async () => {
        for (const name of BACKUP_STORES) await this.db.table(name).clear();
        await this.db.appSettings.put({ ...DEFAULT_SETTINGS });
      },
    );
  }
}
