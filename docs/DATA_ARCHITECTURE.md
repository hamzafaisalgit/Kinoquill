# Kinoquill local data architecture — Phases 2–5

All personal data lives in the browser's IndexedDB. `kinoquill_local` retains its original name. The database retains versions 1 (settings/local metadata), 2 (domain stores), and 3 (additive TV metadata/tracking stores). No store is cleared, recreated, or reset during initialization. Only the genre reference catalog is seeded. A transactional `genre-catalog-v1` metadata marker makes seeding idempotent and prevents explicitly deleted catalog genres from being resurrected on reload. No movie, show, viewing session, or personal record is automatically generated.

## Phase 5 additions

Schema v3 adds `showMetadata`, keyed by `titleId`, for last air date, optional total regular episode/season counts, and the explicit `includeSpecials` preference. First air date reuses the title's `releaseDate`; runtime is typical episode runtime. TV subtypes remain `tv_series`/`tv_miniseries`. Optional fields need no backfill: missing show metadata reads as unknown totals/dates and Specials excluded. A v2→v3 fixture verifies existing movies, settings, associations, and episode progress survive unchanged.

`seasonTracking` uses `[libraryEntryId+seasonId]`, indexed by both foreign keys, and stores optional independent `personalRating`, `mode` (`exact`/`approximate`), `approximateWatched`, and `updatedAt`. Missing tracking rows mean exact mode and no season rating. Approximate mode contributes its count **instead of** exact episode progress. Individual records remain intact and cannot be edited until the user explicitly switches to exact mode. Switching modes never creates guessed episode IDs. All related mutations are transactional; archiving preserves both new stores.

`TitleRecordService` shares Phase 4 title/library/association orchestration between the compatible `MovieService` facade and `ShowService`. TV dates are personal library fields and do not fabricate episode viewing sessions. Show edits check title/library revisions and preserve season and episode data. Creator selections use the `creator` person role; preexisting other person roles are retained. New TMDB seasons are saved only during explicit show creation. Requested-season episode loading fetches before the transaction, adds only missing episode numbers, and leaves existing names, corrections, ratings, and watched states intact.

`utils/tvProgress.ts` is the shared calculation engine; the original `utils/progress.ts` API delegates to it. It deduplicates episode IDs, excludes season zero unless selected, uses one tracking mode per season, returns null for unknown/zero denominators, and accounts for known show totals when season breakdowns are missing. Percentages describe **all known episodes**, including future episodes; future air-date counts are labeled. Next-episode claims require a complete exact catalog and a known released date for the first unwatched episode. Unknown or approximate history uses “Continue tracking.” Completion percentages never write a personal watch status.

## Stores and identities

| Store             | Key / indexes                                                                              | Role                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| appSettings       | `id`                                                                                       | Original Phase 1 sidebar preference                                          |
| localMetadata     | `key`                                                                                      | Original metadata and storage verification                                   |
| titles            | `id`, normalized title, media type/subtype, release year; unique media type + TMDB/IMDb ID | Production metadata, independent of personal records                         |
| genres            | `id`, unique normalized name                                                               | Idempotently seeded catalog and user additions                               |
| people            | `id`, normalized name                                                                      | Explicit person identities; identical names are allowed                      |
| titleGenres       | title ID + genre ID; indexes on each                                                       | Many-to-many genre associations                                              |
| titlePeople       | title ID + person ID + role; indexes on title and person                                   | Directors and creators, independent of metadata refreshes                    |
| libraryEntries    | `id`, unique title ID, status, rating, date added                                          | Personal state, ratings, reviews, favorites, dates, archive marker, revision |
| categories        | `id`, unique normalized name                                                               | Personal organization; distinct from genres and favorites                    |
| libraryCategories | entry ID + category ID; indexes on each                                                    | Many-to-many category membership                                             |
| viewingSessions   | `id`, library entry ID                                                                     | First watches and rewatches without duplicating titles                       |
| seasons           | `id`, title ID, unique title ID + season number                                            | TV seasons, including season zero                                            |
| episodes          | `id`, season ID, unique season ID + episode number                                         | Episode metadata                                                             |
| episodeProgress   | `id`, entry ID, episode ID, unique entry ID + episode ID                                   | Personal episode state                                                       |

UUIDs identify records; relationships never use names as identities. External IDs are unique within media type, so a TMDB movie and show can share the same numeric ID. Null external IDs do not enter compound indexes. IndexedDB cannot index booleans or null values reliably as lookup keys: favorites and archive markers are filtered through cursors, rather than given misleading indexes. Date precision objects are not indexed as if they were exact dates.

Association stores make reverse filtering and cleanup explicit and avoid rewriting complete title documents. Removing a category or genre removes only its association records. Titles, people, ratings, reviews, progress, and viewing sessions survive. Removing the final genre marks the affected entry for review. Genres are normalized by Unicode NFC, whitespace, and case; punctuation and accents are retained. Music and Musical remain distinct genres. People with identical names remain distinct people.

## Contracts and validation

`src/types/domain.ts` centralizes Title, LibraryEntry, Genre, Person, Category, their associations, ViewingSession, Season, Episode, EpisodeProgress, watch statuses, media types/subtypes, duplicate matches, pagination, query filters, and summary types.

`src/utils/validation.ts` exports Zod schemas for creates and patches. Object schemas reject unknown fields. Patches preserve omitted/undefined fields; only explicit null clears a nullable value. Positive runtimes, nonnegative viewing durations, whole-number episode/season numbers, real calendar dates (including leap years), consistent media type/subtype, and consistent release year/date are enforced. Episode numbers begin at one; season zero is valid. Optional metadata defaults to null or an empty country array.

Manual library creation requires an existing genre and a known watch status. Completed titles require a rating. Ratings are finite numbers from 0 through 10 at half-point increments; zero is a real rating, never an unrated sentinel. Director, release year, watch date, and runtime may be absent.

Historical intake uses the separate `importHistoricalLibraryTitle` contract, not a general validation bypass. Ratings such as 8.7 remain exact. Missing status becomes unknown, not completed. Unrated historical completions and missing genres are stored with explicit review reasons. Unrelated edits retain historical rating precision; a newly entered manual rating must use half points. Review reasons are recomputed after relevant edits and genre changes. Neither imports nor metadata imply personal viewing dates.

### Dates

Exact calendar dates use `YYYY-MM-DD` without conversion to JavaScript Date objects. Personal dates use a discriminated value:

```ts
{ precision: 'day', value: '2023-08-17' }
{ precision: 'month', value: '2023-08' }
{ precision: 'year', value: '2023' }
{ precision: 'unknown', value: null }
```

Creation/modification/archive timestamps use UTC ISO strings. An uncertain year never becomes January 1. Start/end checks reject only unambiguously reversed ranges. Runtime is metadata and never automatically becomes watched duration. Repeated watched updates preserve a previously recorded viewing date unless the caller explicitly changes it; unwatched updates clear it.

## Services

Use `catalog` from `src/services/catalog.ts` after local initialization succeeds. `createCatalog(database)` injects an isolated instance for tests. Pages and forms must use these services rather than raw Dexie writes.

| Service    | Main operations                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| titles     | createTitle, getTitleById, updateTitle, listTitles, findDuplicates                                                                                                                                                      |
| library    | createLibraryTitle, createLibraryEntry, importHistoricalLibraryTitle, getLibraryEntry, updateLibraryEntry, setFavorite, softDeleteLibraryEntry, restoreLibraryEntry, listDeletedEntries, listLibraryEntries, getSummary |
| genres     | createGenre, getGenre, listGenres, updateGenre, assignGenres, deleteGenre                                                                                                                                               |
| people     | createPerson, getPerson, listPeople, updatePerson, attachPersonToTitle, detachPersonFromTitle                                                                                                                           |
| categories | createCategory, getCategory, listCategories, updateCategory, deleteCategory, addCategory, removeCategory                                                                                                                |
| viewing    | createViewingSession, updateViewingSession, listViewingSessions                                                                                                                                                         |
| tv         | createSeason, getSeason, updateSeason, listSeasons, createEpisode, getEpisode, updateEpisode, listEpisodes, setEpisodeProgress, getShowProgress                                                                         |

`createLibraryTitle` accepts either new metadata (`title`) or an existing production (`titleId`), plus `library`, `genreIds`, optional `categoryIds`, and optional person/role links. Referenced genres, people, and categories must already exist. Callers create/reference explicit identities through their services first; the composite operation never guesses that two people are the same by name.

```ts
const genres = await catalog.genres.listGenres();
const result = await catalog.library.createLibraryTitle({
  title: {
    title: "A production title",
    mediaType: "movie",
    mediaSubtype: "movie",
  },
  genreIds: [genres[0].id],
  library: { status: "watchlist" },
});
await catalog.library.updateLibraryEntry(
  result.entry.id,
  {
    status: "completed",
    personalRating: 8.5,
  },
  result.entry.revision,
);
```

This is API usage documentation; the app never executes these example writes automatically.

### Transaction and concurrency guarantees

All domain mutations use short read-write transactions spanning the twelve domain stores. This conservative shared scope serializes relationship-changing writes across tabs and prevents reference-check/delete races. Nested service calls participate in the same transaction. There are no network calls or unrelated asynchronous operations inside transactions. Settings and local metadata retain their separate Phase 1 transaction scope.

Composite creation validates input, checks duplicate identities, creates/references a title, resolves associations, creates the personal entry, attaches categories, and commits atomically. Any invalid reference or failed final write rolls the entire operation back, including earlier title and genre links. Existing records are not merged or overwritten on conflicts. Typed validation, missing-record, referential-integrity, duplicate, conflict, and storage errors distinguish failures. Quota failures never claim save success.

Titles and entries have monotonic revision counters. Optional expected-revision arguments reject stale UI saves. Ordinary patch operations read the current record inside the transaction, so independent field edits do not overwrite each other with stale complete documents.

### Duplicates and archives

Duplicate results contain `strong` or `possible` matches with the existing title and a reason. Identical trusted external IDs in a media namespace are strong conflicts, also protected by unique indexes; they cannot be overridden into a second title. Normalized title + compatible/unknown year + media type are possible matches. `confirmPossibleDuplicate: true` is an explicit caller confirmation for distinct productions with matching names. Unrelated metadata edits do not repeatedly ask to confirm an already accepted identity. Nothing silently merges personal ratings or reviews.

One stable personal entry is allowed per title, including archived entries. This deliberately strengthens the “one active entry” rule: adding an archived title requires restoring its existing entry, so personal history cannot become split between duplicate entries. Soft deletion sets `deletedAt` and preserves dates, rating, review, categories, sessions, and episode progress. Normal library/activity/progress queries exclude archives; viewing history can explicitly include them. Restoration checks references and active conflicts, clears the archive marker, and preserves the original date added. Hard deletion and permanent purging remain deferred.

### Queries and derived progress

Library queries support search, media type/subtype, status, favorites, genre, category, release year, minimum/maximum rating, all eight requested sort modes, and typed pagination. Unknown ratings/years sort last and do not satisfy numeric rating filters. Stable ID tie-breakers prevent page ordering from jumping on equal values. Page sizes are limited to 200. Queries use status indexes, bulk metadata reads, and reverse association indexes. A bounded result page reaches React; in-memory filtering/sorting of the candidate set is intentional for a personal collection of several thousand records. Summary counts use title keys and cursor counts rather than loading complete title metadata.

Pure progress utilities count unique watched episodes, never fabricate unknown season totals, and return null percentages when the denominator is unknown or zero. Overall percentages describe the currently recorded seasons, not an assertion that an ongoing show has ended or that all its seasons are known. Episode progress cannot link a movie or an episode from a different show. No contradictory stored progress counters exist.

## Reactive UI

`src/hooks/useCatalog.ts` exports useLibrary, useTitle, useTitles, useGenres, useCategories, useFavorites, useWatchlist, and useLibrarySummary. Each returns `{ data, isLoading, error }`, waits for storage initialization, delegates queries to services, and uses Dexie's `useLiveQuery` subscriptions. No polling or backend calls are involved. The dashboard shows actual active movie/show totals, watchlist size, and favorites, with loading/error states. Full management forms and filtering interfaces remain deferred.

## Verification and persistence limits

Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`. Database tests use unique `kinoquill_test_*` names and remove only their own isolated databases. They cover real v1→v2 migration, seeding, creates/patches, relationships, historical ratings, archives, TV progress, rollback after late failures, concurrent duplicate creation, reactive updates, and pagination of 5,000 generated test titles. Test data is never added to the production database.

Browser storage remains origin/profile-specific and can be cleared or evicted. It is not a backup. No export/restore, TMDB calls, spreadsheet parsing, cloud sync, or offline PWA installation is implemented in Phase 2. Future phases must keep the stable database identity, add versioned non-destructive migrations, and reuse the services and validation contracts above.
