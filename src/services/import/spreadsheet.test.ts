import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { KinoquillDatabase } from "../../db/database";
import { parseCsv, parseFile, excelModule } from "./fileParser";
import {
  autoMapping,
  defaultSheetConfig,
  visibleColumns,
} from "./columnMapper";
import { buildPlan, recheckPlan } from "./duplicateResolver";
import { DEFAULT_IMPORT_OPTIONS, parseDate } from "./normalizer";
import { ImportService } from "./importService";
import {
  collectionDownload,
  exportRows,
  EXPORT_FIELDS,
  workbookBytes,
  csvText,
} from "../export/spreadsheetExport";
import { LibraryService } from "../libraryService";
import { TvProgressService } from "../tvProgressService";
import {
  enrichmentCandidates,
  enrichmentDetails,
  applyMissingMetadata,
} from "./enrichment";
import { configureTmdbToken, removeTmdbToken } from "../tmdb/client";
import type { ImportOptions, ParsedFile } from "../../types/imports";
let db: KinoquillDatabase, importer: ImportService;
beforeEach(() => {
  db = new KinoquillDatabase(
    `kinoquill_test_spreadsheets_${crypto.randomUUID()}`,
  );
  importer = new ImportService(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  removeTmdbToken();
  db.close();
  await db.delete();
});
const headers = [
  "Position",
  "Title",
  "Title Type",
  "Runtime (mins)",
  "Year",
  "Genres",
  "Release Date",
  "Directors",
  "Your Rating",
  "Date Rated",
  "",
  "",
];
const rows = [
  [
    "1",
    "Wednesday",
    "TV Series",
    "45",
    "2022",
    "Comedy, Fantasy",
    "23/11/2022",
    "",
    "8.7",
    "24/11/2022",
    "",
    "",
  ],
  [
    "2",
    "WandaVision",
    "TV Mini Series",
    "30",
    "2021",
    "Drama",
    "15/01/2021",
    "Matt Shakman",
    "",
    "",
    "",
    "",
  ],
  [
    "3",
    "The Social Dilemma",
    "Movie",
    "94 minutes",
    "2020",
    "Documentary",
    "09/09/2020",
    "",
    "0",
    "",
    "",
    "",
  ],
];
function source(): ParsedFile {
  return {
    name: "documented-schema.csv",
    size: 500,
    type: "csv",
    sheets: [parseCsv(csvText(headers, rows))],
  };
}
function plan(
  file = source(),
  options: ImportOptions = {
    ...DEFAULT_IMPORT_OPTIONS,
    dateFormat: "dmy",
    defaultStatus: "completed",
  },
) {
  return buildPlan(db, file, file.sheets.map(defaultSheetConfig), options);
}
it("recognizes the documented CSV columns, quoted values, blank columns, types, day-first dates, decimal and blank ratings", async () => {
  const file = source(),
    sheet = file.sheets[0],
    config = defaultSheetConfig(sheet);
  expect(visibleColumns(sheet, config.headerRow)).toHaveLength(10);
  expect(autoMapping(sheet, config.headerRow)[9]).toBe("ratedDate");
  const preview = await plan(file);
  expect(preview.rows.map((row) => row.data.metadata.mediaSubtype)).toEqual([
    "tv_series",
    "tv_miniseries",
    "movie",
  ]);
  expect(preview.rows[0].data.metadata.releaseDate).toBe("2022-11-23");
  expect(preview.rows[0].data.library.personalRating).toBe(8.7);
  expect(preview.rows[1].data.library.personalRating).toBeNull();
  expect(preview.rows[2].data.library.personalRating).toBe(0);
  expect(preview.rows[0].data.ratedDate.value).toBe("2022-11-24");
  expect(preview.rows[0].data.watchedDate.precision).toBe("unknown");
  expect(preview.rows[2].data.metadata.runtimeMinutes).toBe(94);
  expect(await db.titles.count()).toBe(0);
  expect(await db.categories.count()).toBe(0);
});
it("flags ambiguous/invalid values, respects row types over sheet defaults, and detects duplicate rows across sheets", async () => {
  expect(() => parseDate("03/04/2022", "auto")).toThrow("Ambiguous");
  expect(parseDate("03/04/2022", "dmy").value).toBe("2022-04-03");
  expect(() => parseDate("31/02/2020", "dmy")).toThrow("invalid");
  const file = source();
  file.sheets.push({ ...file.sheets[0], name: "Another sheet" });
  const configs = file.sheets
    .map(defaultSheetConfig)
    .map((config) => ({ ...config, defaultType: "tv_series" as const }));
  const preview = await buildPlan(db, file, configs, {
    ...DEFAULT_IMPORT_OPTIONS,
    dateFormat: "dmy",
  });
  expect(preview.rows[2].data.metadata.mediaType).toBe("movie");
  expect(preview.rows[3].fileMatches[0].id).toBe(preview.rows[0].id);
  expect(preview.rows[3].action).toBe("skip");
  file.sheets[0].rows[1].cells[8] = "11";
  const invalid = await buildPlan(db, file, configs, {
    ...DEFAULT_IMPORT_OPTIONS,
    dateFormat: "dmy",
  });
  expect(
    invalid.rows[0].issues.some(
      (issue) => issue.severity === "error" && issue.field === "rating",
    ),
  ).toBe(true);
});
it("commits historical rows, source provenance and history atomically, with no fabricated watch sessions", async () => {
  const file = source(),
    configs = file.sheets
      .map(defaultSheetConfig)
      .map((config) => ({ ...config, category: "Imported history" })),
    preview = await buildPlan(db, file, configs, {
      ...DEFAULT_IMPORT_OPTIONS,
      dateFormat: "dmy",
      defaultStatus: "completed",
    });
  const report = await importer.commit(preview);
  expect(report).toMatchObject({
    createdCount: 3,
    updatedCount: 0,
    categoriesCreated: 1,
    movies: 1,
    shows: 2,
  });
  const entries = await db.libraryEntries.toArray();
  expect(
    entries.find((entry) => entry.personalRating === null)?.needsReview,
  ).toBe(true);
  expect(await db.viewingSessions.count()).toBe(0);
  expect(await db.importBatches.count()).toBe(1);
  expect(await db.importRecords.count()).toBe(3);
  expect(
    (await importer.records(report.id)).find(
      (record) => record.sourceTitle === "Wednesday",
    )?.ratedDate.value,
  ).toBe("2022-11-24");
  expect(
    (
      await new LibraryService(db).listLibraryEntries({
        importBatchId: report.id,
      })
    ).total,
  ).toBe(3);
});
it("round-trips real CSV and XLSX exports safely, retaining personal data and defaulting existing matches to skip", async () => {
  const preview = await plan();
  preview.rows[2].data.metadata.title = "=SUM(1,2)";
  preview.rows[2].data.genres = ["Drama, Comedy"];
  preview.rows[2].data.categories = ["Together; Alone"];
  preview.rows[2].data.people = [{ name: "Doe, Jane", role: "director" }];
  preview.rows[2].data.library.personalReview =
    'A quoted “story”, with "escaped quotes"\nand a second line.';
  await importer.commit(preview);
  const original = await db.libraryEntries.toArray(),
    output = await exportRows(db);
  for (const format of ["csv", "xlsx"] as const) {
    const result = await collectionDownload(output, EXPORT_FIELDS, format),
      file = await parseFile(
        new File([new Uint8Array(result.bytes)], result.name),
      ),
      configs = file.sheets.map(defaultSheetConfig),
      again = await buildPlan(db, file, configs, {
        ...DEFAULT_IMPORT_OPTIONS,
        dateFormat: "iso",
        decodeSafeText: format === "csv",
      });
    expect(again.rows).toHaveLength(3);
    expect(
      again.rows.every(
        (row) => row.action === "skip" && row.matches.length === 1,
      ),
    ).toBe(true);
    expect(
      again.rows.find((row) => row.data.metadata.title === "=SUM(1,2)"),
    ).toBeTruthy();
    const special = again.rows.find(
      (row) => row.data.metadata.title === "=SUM(1,2)",
    )!;
    expect(special.data.people[0].name).toBe("Doe, Jane");
    expect(special.data.genres).toEqual(["Drama, Comedy"]);
    expect(special.data.categories).toEqual(["Together; Alone"]);
    expect(
      again.rows.find((row) => row.data.metadata.title === "=SUM(1,2)")?.data
        .library.personalReview,
    ).toBe(preview.rows[2].data.library.personalReview);
    await importer.commit(again);
  }
  expect(await db.titles.count()).toBe(3);
  expect(await db.libraryEntries.toArray()).toEqual(original);
});
it("applies only approved duplicate fields, preserves TV progress and historical precision, and rejects stale previews", async () => {
  await importer.commit(await plan());
  let incoming = await plan();
  const row = incoming.rows[0],
    match = row.matches[0];
  const tv = new TvProgressService(db),
    season = await tv.createSeason({
      titleId: match.title.id,
      seasonNumber: 1,
      episodeCount: 1,
    }),
    episode = await tv.createEpisode({ seasonId: season.id, episodeNumber: 1 });
  await tv.setEpisodeProgress({
    libraryEntryId: match.entry!.id,
    episodeId: episode.id,
    watched: true,
  });
  row.data.library.personalRating = 9.3;
  row.data.library.personalReview = "Approved imported review";
  row.action = "update";
  row.targetId = match.title.id;
  row.updateFields = ["personalReview"];
  const result = await importer.commit(incoming);
  expect(result.updatedCount).toBe(1);
  expect((await db.libraryEntries.get(match.entry!.id))?.personalRating).toBe(
    8.7,
  );
  expect(await db.episodeProgress.count()).toBe(1);
  incoming = await plan();
  incoming.rows[0].action = "update";
  incoming.rows[0].targetId = match.title.id;
  incoming.rows[0].data.library.personalRating = 9.3;
  incoming.rows[0].updateFields = ["personalRating"];
  await importer.commit(incoming);
  expect((await db.libraryEntries.get(match.entry!.id))?.personalRating).toBe(
    9.3,
  );
  incoming = await plan();
  incoming.rows[0].action = "update";
  incoming.rows[0].targetId = match.title.id;
  incoming.rows[0].updateFields = ["personalReview"];
  await new LibraryService(db).setFavorite(match.entry!.id, true);
  await expect(importer.commit(incoming)).rejects.toThrow(
    "changed after preview",
  );
});
it("rolls back a late failure completely and upgrades a v3 database without changing existing records", async () => {
  const preview = await plan();
  vi.spyOn(db.importBatches, "add").mockRejectedValueOnce(
    new Error("Injected report failure"),
  );
  await expect(importer.commit(preview)).rejects.toThrow(
    "Injected report failure",
  );
  expect(await db.titles.count()).toBe(0);
  expect(await db.genres.count()).toBe(0);
  expect(await db.importRecords.count()).toBe(0);
  vi.restoreAllMocks();
  await importer.commit(preview);
  const original = await db.libraryEntries.toArray(),
    name = `kinoquill_test_v3_${crypto.randomUUID()}`,
    old = new Dexie(name),
    schema = Object.fromEntries(
      db.tables
        .filter(
          (table) =>
            ![
              "importBatches",
              "importRecords",
              "customLists",
              "listItems",
              "savedViews",
              "tags",
              "titleTags",
            ].includes(table.name),
        )
        .map((table) => [
          table.name,
          [
            table.schema.primKey.src,
            ...table.schema.indexes.map((index) => index.src),
          ].join(","),
        ]),
    );
  old.version(3).stores(schema);
  await old.open();
  for (const table of db.tables.filter((table) => table.name in schema)) {
    const records = await table.toArray();
    if (records.length) await old.table(table.name).bulkAdd(records);
  }
  old.close();
  const upgraded = new KinoquillDatabase(name);
  try {
    await upgraded.open();
    expect(await upgraded.libraryEntries.toArray()).toEqual(original);
    expect(await upgraded.importBatches.count()).toBe(0);
    expect(await upgraded.importRecords.count()).toBe(0);
  } finally {
    upgraded.close();
    await upgraded.delete();
  }
});
it("enriches only explicitly requested missing metadata and never sends personal values to TMDB", async () => {
  const preview = await plan(),
    row = preview.rows[0];
  const fetchMock = vi.spyOn(globalThis, "fetch");
  expect(fetchMock).not.toHaveBeenCalled();
  configureTmdbToken("test-only-token");
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        results: [{ id: 42, name: "Wednesday", first_air_date: "2022-11-23" }],
      }),
      { status: 200 },
    ),
  );
  const signal = new AbortController().signal;
  expect((await enrichmentCandidates(row, signal))[0].id).toBe(42);
  expect(String(fetchMock.mock.calls[0][0])).not.toContain("8.7");
  expect(String(fetchMock.mock.calls[0][0])).toContain("query=Wednesday");
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        id: 42,
        name: "Remote name",
        first_air_date: "2020-01-01",
        overview: "Missing overview",
        poster_path: "/poster.jpg",
        genres: [{ id: 18, name: "Drama" }],
      }),
      { status: 200 },
    ),
  );
  const details = await enrichmentDetails(42, row, signal),
    enriched = applyMissingMetadata(row, details, false);
  expect(enriched.data.metadata.title).toBe("Wednesday");
  expect(enriched.data.metadata.releaseYear).toBe(2022);
  expect(enriched.data.metadata.overview).toBe("Missing overview");
  expect(enriched.data.library.personalRating).toBe(8.7);
  expect(
    (await recheckPlan(db, { ...preview, rows: [enriched] })).rows[0].data
      .metadata.tmdbId,
  ).toBe(42);
});
it("reads typed dates and multiple XLSX sheets, ignores formatting blanks, and rejects malformed uploads", async () => {
  const bytes = await workbookBytes([
    {
      name: "Films",
      headers: ["Title", "Title Type", "Release Date"],
      rows: [["Typed movie", "Movie", "2020-02-29"]],
    },
    {
      name: "Series",
      headers: ["Title", "Title Type"],
      rows: [["Typed show", "TV Series"]],
    },
  ]);
  const Excel = await excelModule(),
    typed = new Excel.Workbook();
  await typed.xlsx.load(new Uint8Array(bytes).buffer);
  typed.properties.date1904 = true;
  const films = typed.getWorksheet("Films")!;
  films.getCell("C2").value = new Date("2020-02-29T00:00:00.000Z");
  films.getCell("C2").numFmt = "yyyy-mm-dd";
  films.getCell("D1").value = "Runtime (mins)";
  films.getCell("D2").value = { formula: "40+2", result: 42 };
  films.getRow(30).height = 25;
  const file = await parseFile(
    new File([new Uint8Array(await typed.xlsx.writeBuffer())], "multi.xlsx"),
  );
  expect(file.sheets.map((sheet) => sheet.name)).toEqual([
    "Films",
    "Series",
    "Instructions",
  ]);
  expect(defaultSheetConfig(file.sheets[2]).selected).toBe(false);
  const parsed = await buildPlan(
    db,
    file,
    file.sheets.map(defaultSheetConfig),
    DEFAULT_IMPORT_OPTIONS,
  );
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0].data.metadata.releaseDate).toBe("2020-02-29");
  expect(parsed.rows[0].data.metadata.runtimeMinutes).toBe(42);
  await expect(
    parseFile(new File(["bad bytes"], "broken.xlsx")),
  ).rejects.toThrow("container");
  await expect(parseFile(new File(["hello"], "legacy.xls"))).rejects.toThrow(
    ".csv or .xlsx",
  );
});
