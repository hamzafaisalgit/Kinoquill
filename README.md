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

## Phase 9 — your personal journal and complete backups

**Viewing Diary** (`/diary`) shows actual local sessions with posters, chronological date groups, media/session/category/date filters, newest/oldest sorting, an undated history area and 24-row pagination. Log first watches or rewatches from the diary or title details, edit dates/ratings/notes/platform/context/duration, and confirm individual deletions. Session ratings are separate from overall ratings. Dates begin as Unknown; no historical session is created automatically from Completed status. Movie/show status and overall rating remain unchanged when logging a viewing.

TV episode rows open their own history. First-viewing sessions can explicitly mark an episode watched through the existing progress service; approximate seasons require a deliberate switch to exact tracking before that option can apply. Rewatches add sessions, never episode definitions or unique progress. Editing/deleting sessions preserves original episode progress. Analytics prefers an explicit episode first-watch session over its progress-derived event, counts episode rewatches separately, and uses runtime estimates only where defensible. An explicitly undated session stays undated. If the last explicit first-watch session is deleted, existing completion/progress data can still contribute a labeled analytics fallback, without becoming a stored diary entry.

**My Lists** (`/lists`, `/lists/:id`) provides private mixed movie/TV collections, descriptions, automatic poster covers, add/remove actions, persistent numbered ordering with accessible move controls, and confirmed list deletion. Cards, details and Library selection support **Add to list**, including creating a list while assigning titles. Membership is unique per title/list. Removing a list never deletes its titles. List detail pages paginate at 24 items.

Library supports **Save current view**, opening, renaming/describing, updating, duplicating and deleting saved views. These preserve route scope, filters, sorting, page size, grid/table layout and visible columns; results always use current records. Missing genre/category/tag references are reported before opening a view without those filters. Flexible descriptive **tags** are separate from structured personal categories and official genres; create/rename/delete them, assign multiple tags in details, and filter Library by tag.

**Settings** now persists collection layout/sorting, 12/24/48 items per page, card artwork/year/rating display, reduced animation, sidebar layout, default season expansion, progress-bar display and Specials default for newly added shows. Existing shows retain their own Specials choice. TMDB remains optional and its token stays in memory, with existing configure/test/clear controls. Settings also show local store counts, approximate origin usage/quota where available, and a user-triggered persistent-storage request. Browser retention is never guaranteed.

**Download Complete Backup** creates `kinoquill-backup-YYYY-MM-DD.json` locally with format `kinoquill-backup`, backup version **1**, schema **5**, actual timestamps and all 22 user-data stores, including relationships, archived entries, exact/approximate TV progress, session detail, lists/order, saved views, preferences, import batches and row provenance. Nulls, IDs, timestamps and historical decimal ratings survive. TMDB credentials, metadata cache, storage-check/seed markers, temporary drafts and poster image bytes are excluded. Remote poster URLs remain references to external images.

Restore accepts the supported version only, validates complete store/record shapes, keys, relationships, dates, ratings, statuses, list order and TV ownership, and shows incoming/current counts before mutation. **Replace is the only mode**; Merge is not exposed. A pre-operation backup is offered, acknowledgment is required, and the user must type **REPLACE**. All replacements and count/ID checks share one atomic transaction; errors and quota failures roll back. Invalid files never clear data. Browser processing is bounded to **25 MB JSON** and **200,000 records**; oversized exports are rejected rather than producing a file the app cannot restore. The limit is not a claim of unlimited backup capacity.

Optional backup reminders are Off/7/30/90 days and run only while the Dashboard is open. **Remind me tomorrow** postpones a prompt without recording a backup. “Last backup” tracks successful file generation/download initiation, since the browser cannot confirm that a file was saved. **Clear All Local Data** offers a backup and requires acknowledgment plus typing **DELETE**; only Kinoquill's user stores/preferences are cleared. Its seed marker remains so intentionally cleared genres do not reappear. Unrelated databases, application assets and the current in-memory TMDB token are retained as explained in the dialog.

Schema **v5** adds `customLists`, `listItems`, `savedViews`, `tags`, `titleTags` and viewing-session indexes. Existing session rows retain their data and may omit new optional fields. No dependencies were added. Main implementation: `src/services/personalService.ts`, `diaryService.ts`, `backup/`, `src/components/personal/`, and the Diary/Lists/Settings pages. See [data architecture](docs/DATA_ARCHITECTURE.md) and [metric definitions](docs/analytics-definitions.md). Phases **1–9** are implemented; Phase 10 can begin.

Verification: **154 tests** passed, including seven targeted personal-data checks, plus TypeScript, ESLint and a production build. Isolated Chrome checks covered diary logging/editing/deletion, episode rewatches without progress resets, list ordering, saved views, tag filtering, a real secret-free JSON download, invalid-file rejection, a previewed/confirmed restore with an exact all-store round-trip, guarded clearing, preference persistence and 1440/1024/768/390 layouts. No destructive checks were run on actual user data. Existing dependency audit findings and the lazy ExcelJS chunk-size warning remain unchanged; live authenticated TMDB testing still requires a real token.

## Phase 8 — local analytics and insights

**Analytics** now provides live collection metrics, yearly/monthly viewing charts and daily activity, rating distributions and ranked titles, genres and trends, directors/creators, release years/decades, languages/countries, television progress, recorded versus estimated watch time, rewatches, year comparisons and deterministic personal insights. The home Dashboard reuses the same local calculation engine for its summaries, recently viewed titles, genre insight and activity preview.

Filter by media, personal viewing period (all time/current/previous/custom year or range), release years, multiple genres/categories, personal rating/rating availability and status. Viewing filters use actual personal events; release dates, import Date Rated, and dates added never become watch dates. Partial dates must fit the selected range; unknown dates are excluded. With a date filter, title statistics describe qualifying titles while current TV progress and current ratings remain snapshots, not historical reconstructions.

Null ratings stay unrated, zero and historical decimals are preserved, archived titles are excluded, and rewatches never inflate unique-title totals. Multi-genre/country counts overlap. Missing dates, runtimes, metadata and episode totals remain unknown. Genre/person rankings show sample sizes and require three ratings; highlighted genre insights require five. Recorded duration and runtime estimates are explicitly separated. Detailed definitions: [analytics-definitions.md](docs/analytics-definitions.md).

Every Recharts card offers an accessible supporting table and **CSV data** download; populated charts also offer **PNG** download with title/context. Genre, release decade, status and title links reuse existing library filters/detail pages. Responsive tabs render only the selected section. All calculations, insights, PNG rendering and CSV generation run in the browser. Recharts and `react-is` are the only added dependencies; no server, analytics API, schema migration or sample user records are introduced. Heatmap PNG and historical rating snapshots are outside this implementation; diary editing and complete backups are implemented in Phase 9 above.

Verification: **145 tests** passed (six focused analytics tests), along with TypeScript, ESLint and the production build. An isolated Chrome profile verified empty/populated states, all analytics sections, reactive rating changes, media/personal-date filters, year comparison, genre links, Dashboard reuse, actual CSV/PNG downloads and 1440/768/390-pixel layouts. The existing lazy ExcelJS chunk size warning remains; dependency audit counts are unchanged.

## Phase 7 — local spreadsheet import and export

**Import & Export** now reads UTF-8 **CSV** (including BOM, quoted commas/quotes/newlines) and **XLSX** entirely in the browser. Choose or drop a file, select sheets, review mappings/header rows, configure interpretation, inspect the preview and duplicates, then explicitly confirm. Back navigation preserves sheet/mapping choices; source values can be corrected and revalidated. Nothing creates personal records during parsing or preview.

- Limits: **10 MB**, **5,000 data rows**, **100 populated columns**, **50 sheets**, and an **80 MB expanded workbook** limit. Oversized/corrupted files are rejected, never truncated. `.xls`, encrypted workbooks, ZIP64, and macros are unsupported. Spreadsheet formulas are never executed; XLSX formula cells use cached results with a warning. Blank rows and genuinely empty columns are ignored while original source row numbers are preserved.
- Automatic mapping recognizes the documented `Position`, `Title`, `Title Type`, `Runtime (mins)`, `Year`, `Genres`, `Release Date`, `Directors`, `Your Rating`, and `Date Rated` columns, plus personal statuses, reviews/notes, categories, language/countries, favorites, artwork, and external IDs. Duplicate target mappings require correction. Use header row **0** for headerless files and map columns manually. Explicit row media types override sheet fallbacks; sheet names never determine media type automatically. Creating a category from a sheet name requires an explicit choice.
- Missing status defaults to **Unknown — review later**. Select a fallback if appropriate; valid row statuses take priority. Choose **0–10**, **0–5**, or **0–100** ratings explicitly. Blank is unrated; genuine zero and historical decimals such as 8.7 survive. Missing historical genres/completed ratings remain importable with review flags. Notes append to the review; people populate the movie Directors or TV Creators / Directors field without automatically merging existing people by name.
- Choose automatic, **DD/MM/YYYY**, **MM/DD/YYYY**, or ISO dates. `23/11/2022` becomes `2022-11-23` with day-first interpretation; ambiguous dates are errors until resolved. Typed Excel dates are supported. Viewing dates retain known day/month/year precision. **Date Rated and Position are stored as source provenance only**, never inferred watch dates or collection ordering.
- Preview supports source/title ordering, search, validation/duplicate filters, pagination, source correction, and skipping selected rows. Existing and within-file/across-sheet matches default to **Skip**. Strong external-ID matches cannot become duplicate titles. Possible name/year matches may be explicitly confirmed as distinct. **Update approved fields** shows existing/incoming values and defaults to preserving all personal values; selected associations are added without removing existing links. Selected merged metadata/personal values are validated before approval. Archived matches must be restored separately.
- Accepted rows, report metadata, and provenance commit in **one transaction**. Duplicates and revisions are checked again immediately before writing. Any failure rolls back the whole import and retains the draft for correction/revalidation. No partial-commit mode or automatic import undo is provided. Only successful transactions enter import history; excluded invalid rows and skipped rows have separate report counts. Original files are not stored.
- Optional **Fetch missing information from TMDB** is **off by default**. Enable it, open one preview row, explicitly search, select a production, and approve missing metadata. Requests run one selected workflow at a time and can be cancelled. Only title/media identification is sent; personal values never go to TMDB. Nonempty source fields are preserved, people suggestions need opt-in, and duplicates are checked again afterward. Missing tokens/network failures leave source-only importing available.

Export the entire active library, movies, shows, watchlist, favorites, or **Export results** from a filtered collection (all matching pages). Choose fields and CSV/XLSX. Excel exports separate Movies/TV Shows, freeze/filter headers, set widths, and include instructions. Lists normally use semicolons; JSON arrays preserve literal names containing separators, such as `["Doe, Jane"]`. CSV is UTF-8 with BOM and escaped fields; formula-like text is protected with an apostrophe and a `Kinoquill Format` marker. Trust decoding only for Kinoquill CSV exports; it is selected automatically for marked exports. CSV/XLSX exports can be reimported with duplicate protection. Download Movies, TV Shows, and Combined templates in either format; templates have headers only and no example personal records.

Recent import history and CSV reports show actual created/updated/skipped/invalid counts, warnings, categories, media totals, and source rows. **View imported titles** opens the active library filtered to that batch. Flat exports include recorded personal fields and TV progress summaries, **not** individual episode history, rewatches, settings, or full provenance. They are not lossless backups; use the complete JSON backup in Phase 9 to preserve all records. Keep source files and export periodically because browser storage can be cleared or evicted.

Schema **v4** adds `importBatches` and `importRecords` without altering existing stores or records. New dependencies: **ExcelJS** and **Papa Parse**, plus development types for Papa Parse; see [third-party notices](THIRD_PARTY_NOTICES.md). XLSX code loads only when needed, producing a roughly 930 kB minified lazy chunk and a corresponding Vite size warning. `npm audit` reports the preexisting 12 high tooling findings plus two moderate entries for ExcelJS/its UUID dependency; upstream ExcelJS uses UUID v4, while the reported advisory concerns other UUID APIs with explicit buffers. No forced tooling downgrade was applied.

Verification: TypeScript, ESLint, production build, and **139 tests** passed, including eight focused spreadsheet checks for parsing/normalization, duplicates, approved updates, rollback, v3→v4 migration, formula-safe CSV/XLSX round-trips, typed dates, and mocked enrichment. A separate browser profile verified actual CSV upload, mappings/configuration, no writes before confirmation, import/Library visibility, a browser-generated XLSX download and reupload, multiple sheets, duplicate skips, and desktop/mobile preview layouts. **The actual 38-row `shows.csv` was not available**, including in preserved repository data; compatibility was checked against its documented schema. Live authenticated TMDB enrichment was not tested without a real token.

The sections below document earlier phase deliveries. Current features and run commands are described above.

## Phase 6 — unified library and organization

Open **Library** (`/library`) for movies and shows together. Movies, TV Shows, Watchlist, and Favorites use the same explorer with fixed collection scopes; details, TV Continue Watching, and archive restoration remain available. Header counts use active IndexedDB records. No dependencies or schema migrations were added; the database remains **v3**.

- Switch between a cinematic **poster grid** and a horizontally scrollable **table** with 24 results per page. Table headers sort relevant fields, while **Columns** controls optional columns and offers Reset Columns. Quick edits explicitly save personal rating, status, and category changes. Historical values such as 8.7 remain unchanged until explicitly edited; zero and unrated remain distinct.
- **Search my library** is local, debounced, case/accent insensitive, and matches partial words across title/original title, directors/creators, genres, categories, personal reviews, and viewing-session notes. All entered words must match the combined record. **Discover · TMDB** remains a separate external search; library search makes no metadata API requests.
- **Filters** combines media/subtype, status, ANY/ALL genres and categories, personal rating bounds/unrated, release-year bounds, favorites, recorded languages/countries, added dates, and watched/completed dates. Groups combine with AND. Active chips remove individual filters; Clear All Filters preserves display preferences.
- Viewing-date ranges overlap recorded day/month/year precision and exclude unknown dates. The table and watched-date sorts use the latest recorded completion or viewing-session date, independent of release date. Missing ratings, runtime, release years, and viewing dates sort last; stable local IDs break ties.
- URL parameters retain active filters, sorting, and pagination through navigation and refresh. **Back to collection** returns from details to the originating filtered view. Grid/table choice, preferred sort, and visible columns persist in the existing IndexedDB settings record. Invalid preferences fall back safely, deleted category/genre filters are cleared, and **Reset view** restores defaults. Named Saved Views remain Phase 9.
- **Manage categories** creates, renames/edits, deletes with confirmation, shows active-title counts, and opens all assigned titles in Library. Deleting a category removes its assignments while keeping every title. Quick edits allow multiple assignments; duplicate normalized names are rejected rather than merged.
- **Select titles** or table checkboxes select only the **visible page**. Bulk category add/remove, favorite flag, status, and archive actions require an explicit Apply/Confirm step. The service checks IDs/revisions and commits the whole selection atomically. Completed requires existing ratings; invalid records stop the entire operation without invented ratings or dates. Archived titles retain their data and can be restored from Movies or TV Shows.

Main source: `src/components/library/`, `src/pages/LibraryPage.tsx`, the extended `LibraryService`/`CategoryService`, `src/services/libraryQuery.ts`, `src/utils/libraryState.ts`, and `src/styles/library.css`. Phase 6 adds seven focused checks. **131 selected regressions passed**, including existing movie/TV/storage/navigation/TMDB checks and the existing 5,000-title pagination fixture. Browser smoke checks used a separate profile at 1440/1024/768/390 pixels for views, local search, filtering, sorting, quick edits, categories, bulk validation, persistence, and contained table scrolling; no TMDB API requests or runtime exceptions occurred.

This section records the Phase 6 delivery; spreadsheet tools and analytics were subsequently implemented in Phases 7–8. Custom lists and named saved views remain future work. Live authenticated TMDB access requires the user's own valid token.

## Phase 5 — TV shows and progress

**TV Shows → Add TV show** offers TV-only TMDB discovery or manual entry. Both continue into the shared add/edit form. Choose **TV Series** or **TV Mini Series**; K-Dramas, Anime, and similar groups are personal categories. Title, genre, and status are required. **Completed** requires an overall rating for ordinary entries; ratings use 0–10 in half points, zero is valid, and unchanged historical precision is preserved. Creators, air dates, totals, artwork, personal dates, review, categories, and seasons are optional.

- **Watchlist** means saved for later; **Watching** means actively tracking; **Caught Up** means current with the episodes you intend to watch. **Completed** is an explicit personal decision. **On Hold** and **Dropped** preserve progress. Episode progress never changes status automatically.
- Show details include expandable seasons, manually added/edited episodes, watched checkboxes and optional watched dates, separate season ratings, and confirmed bulk actions. Overall ratings remain independent of season ratings.
- Exact quick tracking requires a complete episode catalog and marks the **first N episodes** watched, with the rest unwatched, after confirmation. With incomplete metadata, quick tracking uses a labeled **approximate count**. One mode contributes per season: approximate counts replace exact counts in totals, while exact records remain stored. Switching back requires confirmation; no episode identities are fabricated.
- Progress uses known episode totals, handles unknown totals without fake percentages, and excludes **Specials (season 0)** by default. Details let you include Specials explicitly. Totals include future episodes and say so; a next episode is offered only with sufficient exact metadata and a known released air date.
- **Continue Watching** on Dashboard and TV Shows opens the relevant season and highlights the next episode when determinable. Otherwise it says **Continue tracking**. Favorites and Watchlist now include both movies and shows.
- Editing preserves IDs, date added, episode progress, and season ratings. **Archive show** asks for confirmation; restore the same record from **TV Shows → Archived shows**. No permanent deletion is provided.
- TMDB-selected season summaries are saved with the show. **Load missing episodes from TMDB** fetches one requested season before a local transaction, adds missing episodes, and preserves existing corrections and progress. Manual tracking works without a token. API reference: [TMDB season details](https://developer.themoviedb.org/reference/tv-season-details).

IndexedDB is now **schema v3**, with additive `showMetadata` and `seasonTracking` stores. Existing v1/v2 definitions and records are retained; no database reset occurs. No new dependencies were needed. Shared persistence is in `src/services/titleRecordService.ts`, TV orchestration in `showService.ts`, and tracking UI in `src/components/shows/`. See [data architecture](docs/DATA_ARCHITECTURE.md) for storage and calculation details.

Six targeted TV checks cover validation/creation, exact and approximate progress, edit/archive preservation, duplicates/rollback, the v2→v3 migration, and requested-season metadata loading. TypeScript, ESLint, the production build, **39 selected regressions**, and **9 existing TV-service checks** passed. Browser checks used a separate profile for creation, seasons/episodes, bulk and approximate progress, season ratings, Continue Watching, refresh persistence, editing, archiving/restoration, TV draft handoff/recovery, and widths 1440/768/390. Live authenticated TMDB access remains unverified without a real token. Phases 1–5 are implemented; advanced library filters, spreadsheet import, analytics, and rewatch UI remain for later phases.

```powershell
npm.cmd test -- src/services/showService.test.ts src/services/movieService.test.ts src/services/tmdb/tmdb.test.ts src/pages/navigation.test.tsx src/services/localDatabase.test.ts
```

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

The stable database name is **`kinoquill_local`**, current schema **version 4**. Its original stores remain intact:

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
