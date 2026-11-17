# Kinoquill

**Every story you've watched. Every story you've kept.**

A premium, local-first personal cinema journal. Kinoquill is a React application that runs entirely in the browser, with IndexedDB persistence through Dexie. No account, custom API, cloud database, or second development server is required.

## Start locally

From this repository:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by Vite, normally **http://localhost:5173**. On shells without PowerShell execution-policy restrictions, `npm install` and `npm run dev` work equivalently. Node.js is used only for frontend tooling. No environment variables or credentials are required in Phase 1.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`test` runs Vitest once. `build` runs TypeScript before creating `dist/`. `preview` serves the production build locally. A production static host must route unknown application paths to `index.html` for React Router.

## Phase 1 implementation

- Preserved React, Vite, TypeScript, Tailwind, the cinematic midnight/amber design, all eight application routes, and the 404 page.
- Rebranded sidebar, dashboard, HTML metadata, browser titles, favicon, and settings as Kinoquill.
- Removed the entire retired backend directory, Python environment, migrations, endpoint tests, obsolete API client, health hooks, and API environment example.
- Removed TanStack Query, which was used only for the retired connectivity checks.
- Added a small versioned Dexie database, a typed local service, actual initialization/read-write verification, and an honest Local Storage Ready indicator.
- Implemented a functional sidebar preference in Settings and the desktop collapse control. Both use the same IndexedDB record and survive reloads.
- Added unavailable/blocked/quota/error handling, a retry action, disabled persistence controls when storage fails, and no silent in-memory fallback.
- Kept search, title creation, imports, charts, and backup controls clearly deferred. Movie entry is marked for Phase 4. No fake records or personal statistics are shown.
- Added isolated local database and navigation tests plus rendered-browser QA.
- Stored the full supplied master instructions verbatim in `AGENTS.md`.

## IndexedDB and data safety

The stable database name is **`kinoquill_local`**, schema **version 1**. It contains only:

| Store           | Key   | Purpose                                                                        |
| --------------- | ----- | ------------------------------------------------------------------------------ |
| `appSettings`   | `id`  | One `preferences` record with `sidebarCollapsed: boolean`; default is expanded |
| `localMetadata` | `key` | A storage-check timestamp written and read to verify actual availability       |

`src/db/database.ts` defines Dexie's versioned schema. `src/services/localDatabase.ts` owns initialization, reads, transactional preference updates, error reporting, subscriptions, and database version information. `src/hooks/useLocalStorage.ts` connects React to that service; despite the hook's name, persistence uses IndexedDB, never the browser's localStorage API. UI components do not access raw IndexedDB APIs.

Initialization runs once per page lifecycle, with concurrent requests deduplicated. There is no polling or backend connectivity check. Blocked opens have a finite timeout; schema updates must use additive Dexie versions and preserve records. A tab receiving a database version change closes its connection and explains that a reload is needed.

Storage is scoped to this browser profile and exact origin (scheme, hostname, and port). Stay on the same address to keep accessing the same archive. Normal refreshes and browser restarts retain settings, but clearing site data, browser eviction, private browsing, or device loss can remove them. Storage is not an infallible backup. Cloud synchronization is not enabled. Backup/export and restore will arrive in later phases; regular backups are recommended once those tools are available.

The frontend works without network access after its assets have loaded. Full offline reloads, installation, and service-worker/PWA support are deferred to Phase 10. No credentials are stored in these foundation stores.

## Legacy data preservation

Before removing the retired architecture, the existing database was inspected read-only. It contained only its migration-version marker, with no personal title tables. It was nevertheless copied byte-for-byte to:

```text
legacy-data/backend-2026-11-17/data/cinevault.db
```

SHA-256: `9162605579D0125F0F66A2C188BFF2164A7E571A46D6B6BAC22E8A5FF580AA92`.

`legacy-data/backend-2026-11-17/ARCHIVE.txt` records the audit and checksum. The entire `legacy-data/` directory is excluded from source control and frontend runtime. Do not remove this archive as routine cleanup. No automatic transfer into IndexedDB was performed; any future legacy-data transfer requires a defined import procedure. No user uploads or private backend environment file were found.

## Stack

React, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React, and Dexie. Vitest and fake-indexeddb provide isolated tests. No charting, form, spreadsheet, or server packages were added. The local service's subscriptions provide the reactive settings view without requiring a separate Dexie React integration package.

## Project structure

```text
AGENTS.md                         Full current master development instructions
src/db/database.ts                Stable Dexie name and versioned schema
src/types/storage.ts              Typed settings and storage states
src/services/localDatabase.ts     Persistence, transactions, and storage checks
src/hooks/useLocalStorage.ts      React subscription to the local service
src/components/layout/            Desktop/mobile application shell
src/components/common/            Headers, states, and LocalStorageStatus
src/pages/                        Dashboard and all route scaffolds
src/lib/routes.ts                 Navigation definitions
src/services/localDatabase.test.ts
src/pages/navigation.test.tsx
public/favicon.svg                Kinoquill vector mark
tools/verify-ui.mjs                Optional Chrome DevTools browser QA
legacy-data/                      Ignored, non-runtime preservation archive
```

## Tests and browser QA

`npm.cmd test` runs isolated IndexedDB tests with unique test database names. They cover initialization, schema version, default settings, saves/reads/updates, recreation of service and database instances, failed opens, missing storage, blocked opens, quota errors, retries, and a non-destructive test migration. Navigation tests cover every page and the 404 recovery link without requesting any API. Test cleanup deletes only uniquely named test databases, never the real browser database.

`node tools/verify-ui.mjs` additionally checks a running frontend using a task-owned headless Chrome profile with DevTools on port 9222. It verifies all routes at 1440, 1024, 768, and 390 pixels; horizontal overflow; mobile focus/Escape/navigation; settings and sidebar persistence through reloads; loaded-app navigation without network access; unavailable IndexedDB; branding; absence of old API requests; and browser runtime errors. Dashboard screenshots and a Settings screenshot go to ignored `.qa/`. It requires an already-running Chrome DevTools session and does not install a browser or add runtime dependencies. Use a dedicated QA browser profile, not your everyday profile. `UI_ORIGIN` and `CHROME_DEBUG_ORIGIN` customize the optional QA addresses.

## Roadmap

Phase 1 verification completed: `npm.cmd run typecheck`, `npm.cmd test` (22 tests passed), `npm.cmd run lint`, and `npm.cmd run build` all succeeded. `node tools/verify-ui.mjs` passed the route, viewport, persistence, unavailable-storage, offline-navigation, and request-audit checks. Rendered desktop, mobile, and Settings screenshots were inspected.

1. **Foundation (current):** remove retired architecture, establish IndexedDB, preserve the premium shell.
2. **Local data models:** normalized local entities, shared validation, persistence services, and CRUD logic.
3. **TMDB:** optional direct-browser metadata search, permitted API usage and attribution, with honest credential limitations. Browser code cannot keep tokens secret; no credential entry exists yet.
4. **Movies:** functional movie creation/editing, genres, directors, ratings, reviews, and statuses.
5. **TV shows:** seasons, episodes, progress, and show ratings.
6. **Organization:** library views, searching, sorting, filters, watchlist, favorites, and categories.
7. **Spreadsheets:** browser-only XLSX/CSV import/export, multiple sheets, mapping, previews, validation, duplicate handling, and templates.
8. **Analytics:** accurate charts and insights calculated from local records.
9. **Personal tools:** history, rewatches, lists, saved views, preferences, and backup/restore.
10. **Final polish:** accessibility, responsive refinements, performance, offline/PWA support, and broader testing.

Phase 1 intentionally contains no title tables or operational collection editing, TMDB calls, spreadsheet processing, analytics calculations, or backup implementation.
