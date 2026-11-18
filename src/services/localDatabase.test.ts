import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import {
  KinoquillDatabase,
  DATABASE_NAME,
  DATABASE_VERSION,
} from "../db/database";
import { LocalDatabaseService } from "./localDatabase";
import { DEFAULT_SETTINGS } from "../types/storage";

const databases: KinoquillDatabase[] = [];
function createService() {
  const database = new KinoquillDatabase(
    `kinoquill_test_${crypto.randomUUID()}`,
  );
  databases.push(database);
  return new LocalDatabaseService(database);
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("local database foundation", () => {
  it("defines a stable production name and schema version", () => {
    expect(DATABASE_NAME).toBe("kinoquill_local");
    expect(DATABASE_VERSION).toBe(4);
    expect(createService().getVersionInfo().version).toBe(4);
  });

  it("retains foundation stores and verifies an actual write/read", async () => {
    const service = createService();
    await service.initialize();
    expect(service.getSnapshot().phase).toBe("ready");
    expect(service.database.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["appSettings", "localMetadata"]),
    );
    expect(
      (await service.database.localMetadata.get("storage-check"))?.value,
    ).toBeTruthy();
  });

  it("applies default settings without requiring a record", async () => {
    const service = createService();
    expect(await service.readSettings()).toEqual(DEFAULT_SETTINGS);
    await service.initialize();
    expect(service.getSnapshot().settings.sidebarCollapsed).toBe(false);
  });

  it("saves and retrieves a typed preference", async () => {
    const service = createService();
    await service.initialize();
    await service.updateSettings({ sidebarCollapsed: true });
    expect((await service.readSettings()).sidebarCollapsed).toBe(true);
    expect(service.getSnapshot().settings.sidebarCollapsed).toBe(true);
  });

  it("retains settings across database and service instance recreation", async () => {
    const first = createService();
    await first.initialize();
    await first.updateSettings({ sidebarCollapsed: true });
    first.database.close();
    const secondDatabase = new KinoquillDatabase(first.database.name);
    databases.push(secondDatabase);
    const second = new LocalDatabaseService(secondDatabase);
    await second.initialize();
    expect(second.getSnapshot().settings.sidebarCollapsed).toBe(true);
  });

  it("updates the preference in both directions without duplicating records", async () => {
    const service = createService();
    await service.initialize();
    await service.updateSettings({ sidebarCollapsed: true });
    await service.updateSettings({ sidebarCollapsed: false });
    expect(await service.readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await service.database.appSettings.count()).toBe(1);
  });

  it("deduplicates initialization and notifies subscribers", async () => {
    const service = createService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    const first = service.initialize();
    expect(service.initialize()).toBe(first);
    await first;
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("handles a denied open without claiming storage is ready", async () => {
    const service = createService();
    vi.spyOn(service.database, "open").mockRejectedValue(
      new DOMException("denied", "SecurityError"),
    );
    await service.initialize();
    expect(service.getSnapshot().phase).toBe("unavailable");
    expect(service.getSnapshot().error).toContain(
      "Browser storage is unavailable",
    );
  });

  it("handles missing IndexedDB with no in-memory fallback", async () => {
    const service = createService();
    vi.stubGlobal("indexedDB", undefined);
    await service.initialize();
    expect(service.getSnapshot().phase).toBe("unavailable");
    expect(service.database.isOpen()).toBe(false);
  });

  it("handles blocked opens with a finite wait and actionable feedback", async () => {
    vi.useFakeTimers();
    const service = createService();
    vi.spyOn(service.database, "open").mockImplementation(
      () => new Dexie.Promise<Dexie>(() => {}),
    );
    const initializing = service.initialize();
    await vi.advanceTimersByTimeAsync(6000);
    await initializing;
    expect(service.getSnapshot().phase).toBe("error");
    expect(service.getSnapshot().error).toContain("Close other Kinoquill tabs");
  });

  it("preserves the last saved preference when a quota error prevents an update", async () => {
    const service = createService();
    await service.initialize();
    vi.spyOn(service.database.appSettings, "put").mockRejectedValue(
      new DOMException("full", "QuotaExceededError"),
    );
    await service.updateSettings({ sidebarCollapsed: true });
    expect(service.getSnapshot().phase).toBe("error");
    expect(service.getSnapshot().error).toContain("insufficient storage");
    expect(service.getSnapshot().settings.sidebarCollapsed).toBe(false);
    expect((await service.readSettings()).sidebarCollapsed).toBe(false);
  });

  it("can retry a failed initialization without deleting records", async () => {
    const service = createService();
    const opening = vi
      .spyOn(service.database, "open")
      .mockRejectedValueOnce(new Error("temporary failure"));
    await service.initialize();
    expect(service.getSnapshot().phase).toBe("error");
    opening.mockRestore();
    await service.initialize();
    expect(service.getSnapshot().phase).toBe("ready");
  });

  it("supports an additive test migration while preserving settings", async () => {
    const service = createService();
    await service.initialize();
    await service.updateSettings({ sidebarCollapsed: true });
    service.database.close();
    const future = new Dexie(service.database.name);
    future.version(1).stores({ appSettings: "&id", localMetadata: "&key" });
    future.version(5).stores({ localMetadata: "&key,value" });
    try {
      await future.open();
      expect(
        (await future.table("appSettings").get("preferences")).sidebarCollapsed,
      ).toBe(true);
    } finally {
      future.close();
    }
  });
});
