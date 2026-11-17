# Kinoquill

**Every story you've watched. Every story you've kept.**

A premium, local-first personal cinema journal. Kinoquill is a React application that runs entirely in the browser, with IndexedDB persistence through Dexie. No account, custom API, cloud database, or second development server is required.

## Start locally

From this repository:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by Vite, normally **http://localhost:5173**. On shells without PowerShell execution-policy restrictions, `npm install` and `npm run dev` work equivalently. Node.js is used only for frontend tooling. No environment variables or credentials are required.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`test` runs Vitest once. `build` runs TypeScript before creating `dist/`. `preview` serves the production build locally. A production static host must route unknown application paths to `index.html` for React Router.

## Phase 4 — movie management

**Movies → Add movie** offers TMDB search or manual entry. Dashboard and topbar actions open the same workflow. A prepared movie draft from Discover continues into the shared add/edit form with its artwork, external IDs, genres, and runtime intact. Nothing enters the library until **Save movie** commits successfully.

- Required: title, at least one genre, and watch status. **Watched** also requires a personal rating. Statuses are Watchlist, Watching, Watched, On Hold, and Dropped.
- Ratings use **0–10 in half points**; zero is a real rating, while blank means unrated. Existing historical precision such as 8.7 survives unrelated edits.
- Optional: release year/date, original title, runtime, language/countries, overview, poster/backdrop, external IDs, directors, viewing date, favorite, categories, and multiline personal review. Overview and review remain separate. Artwork accepts TMDB paths or HTTPS image URLs; image files are not stored.
- Genres and categories support searchable selection, removal, and new names. Directors support explicit existing-person selection or creation; matching names are never silently merged. Removing a director only unlinks that movie.
- Movie cards, details, Favorites, Watchlist, recently added movies, and watched counts react to IndexedDB changes. Collection pages show 24 movies per page. Details use stable local title IDs.
- **Edit movie → Save changes** updates the same record and preserves its original date added. Stale edits are rejected, failed saves retain form values, and unsaved navigation asks whether to stay or discard.
- An explicitly entered viewing date creates or updates the first-watch session atomically. Dates retain day/month/year precision; no date is invented. Clearing a date preserves unrelated rewatches.
- **Delete movie** asks for confirmation and moves the record to **Movies → Recently Deleted**. **Restore** brings it back with its rating, review, associations, and viewing history. There is no permanent-delete action.

All personal writes use the existing Phase 2 services in one transaction. Database **`kinoquill_local` remains schema v2**, with no reset or migration. New dependencies are `react-hook-form` and `sonner`. Main implementation: `src/components/movies/`, `src/pages/Movie*`, `src/services/movieService.ts`, and `src/styles/movies.css`.

Verification uses TypeScript, ESLint, the production build, and this focused regression selection (six new movie-service checks alongside existing regressions):

```powershell
npm.cmd test -- src/services/movieService.test.ts src/services/tmdb/tmdb.test.ts src/pages/navigation.test.tsx src/services/localDatabase.test.ts
```

All **33 selected tests** passed, along with TypeScript, ESLint, and the production build. A separate browser profile exercised manual add, conditional rating validation, optional directors/categories/date/review, unsaved navigation, same-ID editing, refresh persistence, Favorites, confirmed deletion/restoration, and desktop/mobile layouts. A TMDB-shaped draft fixture verified metadata handoff and refresh recovery; live authenticated TMDB access remains unverified without a valid token. TV management, advanced library filtering, spreadsheet import, rewatches UI, and charts remain for later phases.

## Phase 3 — discovery and metadata

Open **Discover** in the topbar, or **Discover movies/shows** from the collection pages. `/discover` provides debounced live search with All titles, Movies, and TV shows filters, keyboard result navigation, validated poster URLs with local fallbacks, loading/error states, selected-title details, editable director/creator suggestions, and a manual metadata alternative. `/draft` shows the prepared metadata and allows editing or discarding it. Discovery does not create title or library records, and it never changes existing personal ratings or reviews.

### Configure TMDB

1. Sign in to your own [TMDB account and API settings](https://www.themoviedb.org/settings/api), apply for API access if needed, and obtain the **API Read Access Token**. See [TMDB's official authentication guide](https://developer.themoviedb.org/docs/authentication-application).
2. In Kinoquill, open **Settings → Movie & TV Metadata — TMDB**.
3. Paste the token (without the word `Bearer`) and choose **Test connection**. Connected is shown only after a real validation request succeeds. Show/hide controls affect the input; it is cleared after the token is accepted into memory.
4. Return to Discover. Enter at least two characters; search starts after 350 ms without typing. Outdated requests are cancelled, and detailed metadata/credits are fetched only after selecting a result.

The credential is held only in this tab's memory. Reloading the page removes it. There is no persistence opt-in, Vite token variable, credential storage in IndexedDB/localStorage, custom proxy, or backend. A browser-held token is visible to scripts and browser developer tools; frontend code cannot provide server-side secret protection. Requests use an Authorization header only to the fixed TMDB API origin, reject redirects, and do not include tokens in URLs or error messages. Without a token, no TMDB API request is made. Local records and manual metadata preparation remain independent of TMDB.

### Drafts, duplicates, and caching

Selecting a result opens a metadata preview. Director/creator suggestions are not selected automatically: add the names you want, edit them, or leave them blank. **Use this title** checks the existing Phase 2 duplicate service before preparing a typed draft. Strong external-ID matches show the existing local information and block a separate draft. Possible name/year matches require an explicit confirmation. No existing record is merged or overwritten.

**Enter manually** prepares the same draft contract from a title, media type, optional year/runtime/overview, local genre selections, and optional directors/creators. A draft may be incomplete; the movie form applies final library validation. The prepared screen allows metadata editing and clearly states that nothing has been saved. Drafts are session-only and disappear on reload; revisiting `/draft` or the draft movie form after reload shows a recovery screen. Movie drafts now continue to the Phase 4 form; TV management remains Phase 5.

Selected metadata is cached only in memory for five minutes, with a maximum of 24 details records. Search responses are not kept indefinitely, and no image blobs or credentials enter the cache. Changing/removing the token clears the cache; Settings also provides **Clear metadata cache**. Artwork uses validated TMDB image paths and may require internet access even when the personal library is available offline. Network/CORS restrictions, rate limiting, invalid credentials, timeouts, and service errors have explicit messages and manual alternatives. No unauthorized proxy fallback is used.

Important new files: `src/services/tmdb/` (client, schemas/mapping, search/details, images, errors, cache), `src/services/titleDraft.ts`, the draft/session/preparation hooks, `src/components/discovery/`, `src/pages/DiscoverPage.tsx`, `src/pages/TitleDraftPage.tsx`, and `src/styles/discovery.css`. Existing shell, collection pages, Settings, and routing were extended. **No dependencies were added.** The database remains schema v2 without a reset or migration.

### Attribution and verification

Settings contains TMDB's approved logo and the required notice: “This product uses the TMDB API but is not endorsed or certified by TMDB.” The local `public/tmdb-logo.svg` is an unmodified copy of TMDB's [official short-logo asset](https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg). Attribution guidance: [TMDB FAQ](https://developer.themoviedb.org/docs/faq).

Phase 3 checks use `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and the focused regression command below. Five targeted TMDB tests cover movie/TV mapping, missing data/cache behavior, safe authorization failures, and reuse of local duplicate identities. Existing navigation/storage regressions run alongside them:

```powershell
npm.cmd test -- src/services/tmdb/tmdb.test.ts src/pages/navigation.test.tsx src/services/localDatabase.test.ts
```

All **27 selected tests** passed. A separate browser-profile smoke check verified no-token discovery at desktop/mobile widths, manual draft preparation and editing, token input controls, reload recovery, no unintended library writes, and zero TMDB API requests without a token. Live authenticated TMDB searching was **not tested** because no real token was configured. Browser authentication/CORS behavior must still be verified with the user's token and permitted TMDB access. No full movie forms, TV progress interfaces, spreadsheet parsing, or charts were implemented in this phase.

## Phase 2 — local data engine (preserved)

The production database is now **schema version 2**. Both version definitions are retained, with a tested upgrade preserving existing settings and metadata. The twelve new domain stores cover titles, genres, people, title/genre and title/person associations, categories, library/category associations, library entries, viewing sessions, seasons, episodes, and episode progress.

Typed domain services now implement atomic collection creation, reads and patches, relationship integrity, controlled historical intake, duplicate detection, soft deletion/restoration, local filters/search/sorts/pagination, and TV progress. Zod centralizes validation; Dexie React hooks provide reactive query results and actual dashboard counts. New dependencies: `zod` and `dexie-react-hooks`. Existing layout, routes, branding, storage status, and sidebar preference are preserved. No personal sample records are seeded.

See [DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md) for all stores, keys, models, service methods, validation policies, date precision, transaction scope, archive behavior, duplicate resolution, and usage examples for future phases. The new source lives in `src/types/domain.ts`, `src/utils/`, `src/db/seed.ts`, `src/services/*Service.ts`, `src/services/domainSupport.ts`, `src/services/catalog.ts`, and `src/hooks/useCatalog.ts`. Domain integration tests are in `src/services/catalog.test.ts`; existing storage tests now verify v2 compatibility.

Phase 2 verification: **106 tests passed**; TypeScript, ESLint, and the production build succeeded. Browser regression checks passed at 1440, 1024, 768, and 390 pixels, including live numeric dashboard counts, routes, storage failures, offline navigation after assets load, and preference persistence. Desktop and mobile dashboard screenshots were inspected. The dashboard is loaded as a separate chunk, keeping the production build below Vite's default per-chunk warning threshold.

Dependency audit limitation: npm currently reports 12 high-severity findings in the existing build/lint/test dependency chain, originating in picomatch. The registry's latest reported picomatch version is also affected. The audit's suggested changes downgrade the existing frontend tooling; no forced downgrade or unrelated stack replacement was applied. These findings remain unresolved.

Manual completed entries require a rating at half-point increments from 0 to 10 and at least one genre. Historical ratings preserve values such as 8.7 and incomplete entries receive review flags. Patches never erase omitted values. Soft deletion preserves ratings, reviews, dates, categories, viewing history and TV progress. External IDs are scoped to media type; possible duplicate names need explicit confirmation. All related writes commit or roll back together, and stale revision checks are available for edits.

## Phase 1 foundation (preserved)

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

The stable database name is **`kinoquill_local`**, schema **version 2**. Its original stores remain intact:

| Store           | Key   | Purpose                                                                        |
| --------------- | ----- | ------------------------------------------------------------------------------ |
| `appSettings`   | `id`  | One `preferences` record with `sidebarCollapsed: boolean`; default is expanded |
| `localMetadata` | `key` | A storage-check timestamp written and read to verify actual availability       |

`src/db/database.ts` defines Dexie's versioned schema. `src/services/localDatabase.ts` owns initialization, transactional preference updates, storage checks, and genre seeding. `src/hooks/useLocalStorage.ts` connects React to that service; despite the hook's name, persistence uses IndexedDB, never the browser's localStorage API. Domain records use the separate typed catalog services. UI components do not access raw IndexedDB APIs.

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

React, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide React, Dexie, dexie-react-hooks, and Zod. Vitest and fake-indexeddb provide isolated tests. No charting, form, spreadsheet, or server packages were added. The Phase 1 settings subscription remains intact; catalog hooks use `useLiveQuery`.

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

`npm.cmd test` runs isolated IndexedDB tests with unique test database names. In addition to the original storage and navigation coverage, the domain suite verifies v1→v2 migration, genre seeding, CRUD, manual and historical validation, references, archives, duplicate conflicts, rollback after late writes fail, concurrent creation, reactive updates, filters, sorts, pagination, and a generated 5,000-title test. Test cleanup deletes only uniquely named test databases, never the real browser database.

`node tools/verify-ui.mjs` additionally checks a running frontend using a task-owned headless Chrome profile with DevTools on port 9222. It verifies all routes at 1440, 1024, 768, and 390 pixels; horizontal overflow; mobile focus/Escape/navigation; settings and sidebar persistence through reloads; loaded-app navigation without network access; unavailable IndexedDB; branding; absence of old API requests; and browser runtime errors. Dashboard screenshots and a Settings screenshot go to ignored `.qa/`. It requires an already-running Chrome DevTools session and does not install a browser or add runtime dependencies. Use a dedicated QA browser profile, not your everyday profile. `UI_ORIGIN` and `CHROME_DEBUG_ORIGIN` customize the optional QA addresses.

## Roadmap

Phase 1 verification completed: `npm.cmd run typecheck`, `npm.cmd test` (22 tests passed), `npm.cmd run lint`, and `npm.cmd run build` all succeeded. `node tools/verify-ui.mjs` passed the route, viewport, persistence, unavailable-storage, offline-navigation, and request-audit checks. Rendered desktop, mobile, and Settings screenshots were inspected.

1. **Foundation (complete):** remove retired architecture, establish IndexedDB, preserve the premium shell.
2. **Local data models (complete):** normalized local entities, shared validation, persistence services, and CRUD logic.
3. **TMDB (current):** optional direct-browser discovery, metadata previews, manual drafts, session-only token configuration, and honest credential limitations.
4. **Movies:** functional movie creation/editing, genres, directors, ratings, reviews, and statuses.
5. **TV shows:** seasons, episodes, progress, and show ratings.
6. **Organization:** library views, searching, sorting, filters, watchlist, favorites, and categories.
7. **Spreadsheets:** browser-only XLSX/CSV import/export, multiple sheets, mapping, previews, validation, duplicate handling, and templates.
8. **Analytics:** accurate charts and insights calculated from local records.
9. **Personal tools:** history, rewatches, lists, saved views, preferences, and backup/restore.
10. **Final polish:** accessibility, responsive refinements, performance, offline/PWA support, and broader testing.

Phase 2 provides the local data engine and live dashboard counts. Full collection-management forms, TMDB calls, spreadsheet processing, analytics charts, and backup/export interfaces remain deferred to their assigned phases.
