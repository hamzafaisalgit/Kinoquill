# KINOQUILL — MASTER DEVELOPMENT INSTRUCTIONS
## Premium Local-First Movies & TV Shows Tracking Application

You are acting as a senior frontend engineer, TypeScript architect, local-database engineer, and world-class UI/UX designer.

You are developing **Kinoquill**, a premium personal movie and television tracking web application.

Tagline: **Every story you've watched. Every story you've kept.**

The application must feel like a beautifully crafted, professional product rather than a typical student project.

---

# 1. CRITICAL ARCHITECTURE CHANGE

The project was previously planned as a React frontend with a Python FastAPI backend and SQLite database.

**THAT ARCHITECTURE HAS BEEN CANCELLED.**

The project must now be:

- 100% frontend.
- React-based.
- TypeScript-based.
- Local-first.
- Powered by IndexedDB.
- Fully functional without a custom backend.
- Usable without accounts or login.
- Capable of handling real local data.
- Designed for personal, single-user use.

This is a permanent architectural requirement unless the user explicitly changes it.

## ABSOLUTELY NO BACKEND

Do not create or retain active use of:

- FastAPI.
- Flask.
- Django.
- Express.
- Node.js API servers.
- Python backend services.
- SQLite databases.
- SQLAlchemy.
- Alembic.
- PostgreSQL.
- MongoDB.
- Supabase.
- Firebase.
- Redis.
- Server-side authentication.
- Server-side REST endpoints.
- Server-side file processing.
- Server-dependent analytics.

Node.js is permitted ONLY as frontend development/build tooling for Vite and npm packages.

Python is not needed for this application.

Do not introduce a backend merely because a feature would be easier to implement server-side.

All personal application functionality must be implemented in the browser.

## EXISTING PROJECT

The project already contains a functioning React + Vite + TypeScript + Tailwind CSS frontend.

It may also contain a FastAPI backend and related code from earlier development phases.

The frontend must be preserved.

Inspect the repository before changing anything.

Do not recreate the React project, reinitialize Vite, or unnecessarily replace the existing Tailwind configuration.

Remove the abandoned backend architecture safely during Phase 1.

Do not destroy existing user data, files, or working frontend components.

---

# 2. PROJECT IDENTITY

Application name: **Kinoquill**

Tagline: **Every story you've watched. Every story you've kept.**

Kinoquill is a beautiful personal cinema archive for keeping track of movies, TV series, miniseries, K-dramas, anime, and other film-related content.

It combines:

1. IMDb-style movie discovery.
2. Letterboxd-style personal ratings and reviews.
3. Excel-like structured collection management.
4. Power BI-inspired analytics.
5. Personal viewing-history tracking.
6. TV show season and episode progress.
7. Excel/CSV data portability.

It is not a social network.

It is not a streaming platform.

It does not host or stream copyrighted media.

It does not require accounts, subscriptions, or cloud databases.

The application is primarily designed for one person to manage their entertainment history locally.

---

# 3. TECHNOLOGY STACK

## Frontend

Use:

- React.
- TypeScript.
- Vite.
- Tailwind CSS v4 or the already configured compatible version.
- React Router for routing.
- Lucide React for icons.
- shadcn/ui for polished interface components when appropriate.
- TanStack Query where useful for external TMDB requests.
- React Hook Form for complex forms.
- Zod for validation.
- Recharts for charts.
- Sonner for notifications.
- date-fns for dates.
- Motion for restrained animations where genuinely useful.

Install dependencies only in the phase that needs them.

Do not install every possible dependency upfront.

## Local Database

Use:

**IndexedDB + Dexie.js**

Dexie will be the primary persistence layer for all personal records.

Use Dexie's React integration when appropriate for reactive database queries.

Do not use localStorage to store the primary movie/show database.

localStorage may be used only for small non-sensitive preferences, such as theme choice or sidebar collapse state.

Do not store credentials in localStorage.

## Excel and CSV

Use browser-compatible libraries such as:

- SheetJS for spreadsheet reading, if appropriately licensed for the intended use.
- ExcelJS where useful for XLSX creation.
- Papa Parse for CSV if needed.

Choose only the necessary libraries when implementing the import/export phase.

All spreadsheet processing must happen in the browser.

No spreadsheet should be uploaded to a custom server.

## External Metadata

Use TMDB for optional movie and television metadata.

TMDB may provide:

- Titles.
- Posters.
- Backdrops.
- Release dates.
- Release years.
- Genres.
- Overviews.
- Runtimes.
- Languages.
- Countries.
- Seasons.
- Episodes.
- Cast.
- Other available metadata.

Personal information must always be stored locally.

---

# 4. LOCAL-FIRST ARCHITECTURE

The application must have a clear separation between:

1. Presentation components.
2. Pages and navigation.
3. Application services.
4. Domain validation.
5. IndexedDB persistence.
6. External metadata services.
7. Import/export utilities.
8. Analytics calculations.

Recommended high-level flow:

React UI
→ Application Service
→ Validation
→ Dexie / IndexedDB
→ Reactive UI Updates

For TMDB:

React Search
→ TMDB Client
→ External API
→ Metadata Results
→ Optional Local Save

For Excel:

Local File Selection
→ Browser File Parsing
→ Field Mapping
→ Validation
→ Preview
→ IndexedDB Transaction

For analytics:

IndexedDB Records
→ Calculation Utilities
→ Chart Data
→ React / Recharts

Do not introduce unnecessary backend-style architecture inside the frontend.

Avoid overengineering and excessive abstractions.

---

# 5. PERSISTENCE RULES

All personal data must survive:

- Page refreshes.
- Normal browser restarts.
- Navigation between routes.
- Application updates that preserve the same origin and browser storage.

Use IndexedDB for:

- Titles.
- Personal library entries.
- Genres.
- Directors and creators.
- Categories.
- Reviews.
- Ratings.
- Viewing sessions.
- TV show progress.
- Custom lists.
- Saved views.
- Import history.
- Relevant cached metadata.

## Data Safety

Browser storage is persistent under normal conditions but is not guaranteed permanent.

Therefore:

- Never describe local browser storage as an infallible backup.
- Make data export and restore a core product capability.
- Never silently erase user data.
- Avoid deleting or recreating IndexedDB during normal updates.
- Use versioned Dexie migrations.
- Use transactions for related writes.
- Provide backup and restore in a later phase.
- Show a clear warning that clearing site data may remove the library.
- Recommend regular backups.

The main application must work without a network connection after the necessary frontend assets have loaded.

Full installable offline-PWA support will be implemented in the final phase.

---

# 6. MOVIE AND TV SHOW DATA MODELS

Create a scalable, normalized local data architecture.

Core entities should include:

- Title.
- LibraryEntry.
- Genre.
- Person.
- TitleGenre.
- TitlePerson.
- Category.
- LibraryCategory.
- ViewingSession.
- Season.
- Episode.
- EpisodeProgress.
- CustomList.
- CustomListItem.
- SavedView.
- ImportBatch.

Implement these gradually across development phases.

Avoid duplicating entire movie records for different viewing sessions.

A movie or show has one local title identity and can have multiple viewing sessions.

A movie may have multiple genres, directors, and categories.

TV shows require separate season and episode progress.

---

# 7. REQUIRED DATA FIELDS

## New manually entered watched movie

Required:

- Title.
- Media type.
- At least one genre.
- Watch status.
- Personal rating.

Optional:

- Director.
- Release year.
- Release date.
- Runtime.
- Language.
- Country.
- Poster.
- Cast.
- Date watched.
- Personal review.
- Categories.
- Viewing platform.

## New watchlist entry

Required:

- Title.
- Media type.
- At least one genre.
- Watch status.

Personal rating is optional.

## New completed TV show

Required:

- Title.
- Media type.
- At least one genre.
- Completed status.
- Overall personal rating.

Season and episode information may be unknown.

## Director and Creator

Director/creator fields remain manually editable.

They are not mandatory.

TMDB may suggest director/creator information, but it must never overwrite personal input without explicit approval.

---

# 8. RATINGS AND VALIDATION

Use a personal rating system from 0 to 10.

Normal manual input should support 0.5 increments.

Examples:

- 7.0
- 7.5
- 8.0
- 8.5
- 9.0
- 9.5
- 10.0

Store missing ratings as null, not zero.

A genuine rating of zero is valid.

Historical imported ratings such as 8.7 must remain representable.

Do not silently round or discard existing ratings.

The application must distinguish between:

- Normal manual creation.
- Editing.
- Historical import.

Imported data may contain missing genres, ratings, viewing dates, or other details.

Preserve incomplete historical records with explicit review flags.

Do not fabricate missing information.

Validation must be shared and consistent across creation, editing, and importing.

---

# 9. STATUSES

Canonical personal watch statuses:

- watchlist.
- watching.
- completed.
- on_hold.
- dropped.
- caught_up.
- unknown.

The UI may display "Watched" for completed movies and "Completed" for completed shows.

The unknown status is reserved primarily for incomplete historical data.

Production status, such as whether a TV series is canceled or still airing, must not be confused with personal watch status.

---

# 10. GENRES, CATEGORIES AND LISTS

Genres describe the content itself.

Examples:

- Action.
- Adventure.
- Comedy.
- Crime.
- Drama.
- Fantasy.
- Horror.
- Mystery.
- Romance.
- Sci-Fi.
- Thriller.

A title may have several genres.

Personal categories are user-defined organization tools.

Examples:

- K-Dramas.
- Korean Movies.
- Anime.
- Family Picks.
- Must Rewatch.

A title may belong to multiple categories.

Favorites are represented by an explicit favorite property.

Custom lists are separate curated collections.

Do not conflate media type, genre, category, status, and custom list.

---

# 11. TMDB INTEGRATION — IMPORTANT SECURITY LIMITATION

Kinoquill has no backend.

Therefore, it cannot securely hide a TMDB API credential in frontend code.

Never claim that a Vite environment variable or minified JavaScript keeps a token secret.

Never hardcode the developer's private TMDB credential into committed frontend source.

## Recommended Architecture

Build the application so that TMDB integration is optional.

Provide a user-configured API credential mechanism if direct browser calls require authorization.

Clearly explain that a token used directly in the browser is exposed to that browser environment and to requests made from it.

A browser-only app cannot provide server-side secret protection.

Use TMDB directly only when its current API access rules, browser CORS behavior, attribution requirements, and credential terms permit the chosen implementation.

If secure credential handling becomes necessary, explain that it cannot be achieved under the no-backend constraint rather than introducing a hidden server.

The application must work without TMDB.

Manual title entry and all personal library features must remain available offline.

## Search Behavior

Eventually support:

- Debounced search.
- Movie and TV show matching.
- Poster and release-year previews.
- Selection from multiple results.
- Automatic metadata fill.
- Manual overrides.
- Duplicate detection.
- Graceful API error handling.

Never overwrite user-entered information automatically.

---

# 12. EXCEL AND CSV

The application must support:

- CSV import.
- XLSX import.
- Multiple sheets.
- Column mapping.
- Data validation.
- Duplicate detection.
- Import preview.
- Row-level errors.
- Transactional importing.
- Export.
- Backup.

Existing user spreadsheets may contain columns such as:

- Position.
- Title.
- Title Type.
- Runtime (mins).
- Year.
- Genres.
- Release Date.
- Directors.
- Your Rating.
- Date Rated.

Supported content types include:

- Movie.
- TV Series.
- TV Mini Series.

The importer must not assume every item in a file named "shows" is a TV show.

The user's existing CSV may contain different media types.

Do not confuse release date with watch date.

Do not assume a title was watched merely because it appears in a spreadsheet.

If status is missing, ask the user to assign a default during import or retain unknown status.

All processing happens locally in the browser.

---

# 13. ANALYTICS

Analytics must be generated entirely from local IndexedDB data.

Eventually support:

- Total movies watched.
- Total TV shows completed.
- Average personal rating.
- Favorite titles.
- Rating distribution.
- Genres watched.
- Highest-rated genres.
- Directors and creators.
- Watching activity by year.
- Monthly activity.
- Release decades.
- Countries and languages.
- Estimated watch time.
- TV show completion.
- Rewatch statistics.
- Comparison between years.
- Custom filtered analytics.

## Accuracy Requirements

- Missing ratings do not count as zero.
- Unknown viewing dates do not become invented dates.
- Multiple genres may contribute to multiple genre categories.
- Unique title totals are not inflated by rewatches.
- Viewing sessions are counted separately where appropriate.
- Watching hours must be based on defensible recorded or estimated durations.
- TV episodes not watched must not contribute to watched-duration totals.
- Show clear empty states when data is insufficient.
- Never create fake statistics to make charts look populated.

---

# 14. PREMIUM UI/UX DESIGN STANDARDS

Visual quality is one of the most important requirements.

The design must feel sophisticated, cinematic, modern, and cohesive.

## Overall Aesthetic

- Premium dark theme.
- Near-black backgrounds.
- Deep charcoal surfaces.
- Elegant neutral typography.
- One carefully chosen accent color.
- Subtle borders.
- Beautiful poster cards.
- Comfortable spacing.
- Strong visual hierarchy.
- Refined motion.
- Excellent responsiveness.

Suggested colors:

- Background: #0B0D12.
- Surface: #121620.
- Elevated surface: #191E2A.
- Border: #282E3A.
- Primary text: #F3F5F8.
- Secondary text: #9CA5B5.
- Accent: sophisticated champagne/amber.

Colors may be refined for cohesion.

## Layout

Desktop:

- Elegant collapsible sidebar.
- Polished top navigation.
- Well-spaced dashboard.
- Poster-grid layouts.
- Data-table layouts.
- Clear filter controls.

Mobile:

- Responsive navigation.
- Accessible touch targets.
- No horizontal page overflow.
- Readable forms.
- Appropriately sized posters.
- Usable charts.

## Design Requirements

- Reusable UI components.
- Consistent border radii.
- Consistent shadows and spacing.
- Beautiful skeleton loaders.
- Helpful empty states.
- Informative error states.
- Smooth hover states.
- Keyboard accessibility.
- Visible focus indicators.
- Readable contrast.

Avoid:

- Generic student-project design.
- Random colorful cards.
- Unnecessary gradients.
- Excessive glassmorphism.
- Inconsistent fonts.
- Oversized headings.
- Overly decorative elements.
- Fake buttons.
- Placeholder functionality disguised as working functionality.
- Hardcoded fake personal statistics.

The application should look like a genuine premium product, even with an empty local database.

---

# 15. APPLICATION NAVIGATION

Required routes:

- `/` — Dashboard.
- `/movies` — Movies.
- `/shows` — TV Shows.
- `/watchlist` — Watchlist.
- `/favorites` — Favorites.
- `/analytics` — Analytics.
- `/import-export` — Import & Export.
- `/settings` — Settings.

Provide a polished 404 page.

The navigation should work without any backend connection.

---

# 16. FRONTEND ENGINEERING STANDARDS

Use professional React and TypeScript practices.

- Prefer functional components.
- Separate persistence from presentation.
- Use type-safe database services.
- Avoid unnecessary `any` types.
- Keep React components focused.
- Centralize shared domain types.
- Centralize validation.
- Avoid duplicate business logic.
- Avoid direct IndexedDB code scattered throughout pages.
- Use a consistent state management strategy.
- Handle asynchronous storage errors.
- Use Dexie transactions for related operations.
- Avoid excessive subscriptions and unnecessary rerenders.
- Use proper loading and empty states.
- Use stable IDs.
- Keep date handling explicit.
- Use appropriate performance optimizations.
- Prefer maintainable simplicity over clever abstractions.

Do not create an Express or FastAPI server to support the frontend.

---

# 17. DATA MIGRATIONS

IndexedDB schema changes must use Dexie versioning.

Requirements:

- Define schema versions explicitly.
- Use migrations when necessary.
- Preserve existing data.
- Do not wipe the database during normal development.
- Test schema changes.
- Avoid changes that make existing records unreadable.
- Do not use destructive fallback behavior when a migration fails.

If a previous SQLite backend database contains records, do not claim those records will automatically appear in IndexedDB.

A separate migration or export/import procedure would be required.

Never delete real user data as part of architecture cleanup.

---

# 18. PROJECT PHASES

The project is divided into exactly 10 phases.

### Phase 1 — Backend Removal & Local Architecture

Remove obsolete backend architecture safely, initialize IndexedDB, establish local services, and maintain the premium application shell.

### Phase 2 — Local Data Models & CRUD

Create the complete browser-based data model, validation, persistence services, and CRUD logic.

### Phase 3 — TMDB Search

Implement optional direct-browser metadata lookup, autocomplete, selected-title details, and manual fallback.

### Phase 4 — Movie Management

Implement fully functional movie addition, editing, ratings, directors, genres, reviews, and statuses.

### Phase 5 — TV Show Management

Implement shows, seasons, episodes, progress tracking, and show ratings.

### Phase 6 — Library & Organization

Implement poster/table views, searching, filters, sorting, favorites, watchlist, and categories.

### Phase 7 — Excel & CSV

Implement local spreadsheet import/export, column mapping, validation, duplication handling, and templates.

### Phase 8 — Analytics

Implement accurate interactive charts and insights calculated from local data.

### Phase 9 — Advanced Personal Features

Implement viewing history, rewatches, custom lists, saved views, preferences, and backup/restore.

### Phase 10 — Final Polish

Complete accessibility, responsive refinement, performance optimization, offline/PWA behavior, and testing.

Do not implement future phases prematurely.

---

# 19. CODEX DEVELOPMENT PROCESS

For each phase:

1. Inspect the existing repository.
2. Identify what is already implemented.
3. Check for conflicts with the frontend-only architecture.
4. Make a concise implementation plan.
5. Implement the current phase.
6. Preserve existing working functionality.
7. Install only necessary dependencies.
8. Run available tests.
9. Run TypeScript checks.
10. Run linting.
11. Run the production build.
12. Fix newly introduced errors.
13. Update documentation.
14. Summarize the work.

Do not stop after describing a plan.

Implement the requested code.

If a dependency or environment issue prevents an operation, report it accurately.

Do not claim successful tests that were not executed.

---

# 20. NON-NEGOTIABLE RULES

1. **No backend.**
2. **No server database.**
3. **No accounts or authentication.**
4. **No personal-data cloud synchronization.**
5. **All user records in IndexedDB.**
6. **No destruction of existing user data.**
7. **Excel processing inside the browser.**
8. **TMDB optional, with honest credential limitations.**
9. **Personal fields always under user control.**
10. **Beautiful, professional UI.**
11. **No fabricated analytics.**
12. **No unfinished feature presented as functional.**
13. **Preserve the existing React and Tailwind setup.**
14. **Follow the 10-phase development plan.**
15. **Build usable software, not mockups.**

---

# FINAL OBJECTIVE

Kinoquill should become a beautiful, reliable, fully functional personal movie and TV show archive that runs completely in the browser.

It should provide the convenience of Excel, the cinematic presentation of IMDb/Letterboxd, and the analytical capabilities of a dedicated personal dashboard.

It must work without running Python, FastAPI, SQLite, or any custom backend.

All personal collection data must be stored locally through IndexedDB.

The application must remain easy to back up, export, maintain, and extend.

**Wait for the specific phase prompt before implementing anything beyond the current phase.**