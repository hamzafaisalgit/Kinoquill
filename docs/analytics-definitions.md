# Local analytics · Phase 8

Analytics read one consistent, reactive IndexedDB snapshot. Pure calculations live in `src/analytics/calculations.ts`, filtering in `filters.ts`, and presentation datasets in `selectors.ts`. Dashboard and Analytics share these calculations. No migration, data repair, personal-data upload, or new database store is involved.

## Collection and filters

- A unique title is one local title ID with an active library entry. Archived entries and metadata without personal entries are excluded. Repeated associations and sessions never increase unique-title totals. Deliberately separate local title identities are not merged by name.
- Movies watched / shows completed mean current personal status `completed`, counted separately by media type. Miniseries remain TV. Watchlist, watching, favorites, caught up, dropped, on hold and unknown retain their existing meanings.
- Media, status, release-year bounds, personal-rating bounds, rating availability, genres and personal categories intersect. Multiple genres match any selected genre; categories similarly match any selected category. Unknown release years/ratings cannot meet numeric bounds. Zero is valid. Empty/inverted ranges show a warning or empty results; no data is changed.
- Personal viewing-date filters use viewing events, never release date, collection date, import date, or Date Rated. Selected title metrics include only titles with a qualifying event; event charts further restrict events to that range. Year/month precision qualifies only when its entire possible interval fits the range. Unknown dates cannot qualify.
- TV progress is a current snapshot for qualifying shows, not a historical reconstruction. Likewise, ratings in year comparisons are current ratings for titles with activity that year. Select **All time** viewing dates for a complete two-year comparison.

## Viewing activity and rewatches

- Movie sessions are viewing events; explicitly marked rewatches remain separate events. Session IDs are deduplicated. A completed movie without a first-watch session gets one fallback event using its personal completion date, even if that date is unknown. Completion never adds a second first watch when one exists.
- TV first-watch sessions count as show completions only for currently completed shows. A completed show without one uses its explicit personal completion date. Episode progress never implies an overall completion. TV rewatch sessions count toward rewatch analytics, not first-completion bars.
- An incomplete show's whole-title first-watch session is a generic viewing session, not an episode or completion. Exact watched episode progress contributes separate episode events; approximate counts have no invented episode identities or dates.
- Unknown dates are excluded from calendar charts. Year precision enters year charts only; month precision enters year/month charts; daily heatmaps require day precision. Empty calendar cells mean **no recorded events**, not proof that nothing was watched.
- Rewatch counts use only explicit `rewatch` sessions. Rating/review edits do not create rewatches. Year comparisons use event counts, unique title IDs, current mean ratings and sample sizes, genre counts and recorded/estimated hours. A zero or unknown baseline is **Not comparable**.

## Ratings, genres, people and origin

- Rating means/medians exclude null and include zero. Stored decimal values retain full precision. Display uses up to one decimal; supporting chart tables use up to two. Histogram intervals are `[0,1]`, `(1,2]`, …, `(9,10]`: every valid value falls into exactly one bucket.
- Genre/country counts contribute once to every associated group. They can sum above the collection total. Genre watched counts use unique currently completed titles. Rating denominators include only rated titles, shown in supporting data.
- Ranked genre/person averages require at least **3** rated titles; a highlighted highest-rated genre insight requires **5**. Leading groups may tie. Insights are deterministic factual statements, not personality judgments or AI output.
- Directors and creators use relationship roles and person IDs; identical names never merge identities. Co-directed titles count once per associated director. Supporting tables show collection counts, completed counts and rated samples/means.
- Release years/decades use content metadata; unknown years are excluded and counted separately. Decades are `floor(year/10)*10`.
- Languages use `Intl.DisplayNames` with a readable code fallback. Production countries use stored metadata; no origin is inferred from language or title text. Missing metadata remains Unknown.

## Television

- Reuses the existing TV progress calculator. Specials follow each show's `includeSpecials` setting; approximate season counts replace exact episode progress. Overall Completed never fills episode progress.
- Episodes with an explicit future air date are excluded from exact watched counts, viewing events and duration estimates. Known totals can still contain future episodes; remaining episodes are not labeled missed/overdue. Approximate progress is a user-recorded aggregate whose individual episodes/dates are not inferred.
- Known season records count catalogued included seasons. Completed seasons require a positive known total and sufficient recorded progress. Unknown episode totals remain unknown; overall percentage requires known totals for every selected show. Known partial totals are labeled alongside unknown-show counts.
- Season rating averages/distributions are separate from overall show ratings; null and zero follow the same rules.

## Watching time

- **Recorded** means an explicitly entered session duration, not playback telemetry. **Estimated** means runtime-based duration; episode runtime metadata is also an estimate of time spent.
- A completed movie gets one runtime-based first-viewing estimate only when it lacks a first-watch session. Explicit sessions use their recorded duration, falling back to movie runtime. Only an explicit rewatch session supports an additional movie estimate.
- Watched exact episodes use episode runtime, falling back to typical show runtime. Approximate watched counts may use typical show runtime and remain undated. Unwatched episodes never contribute.
- A recorded whole-show first-viewing duration replaces overlapping episode estimates for that show. Episode activity remains visible, but its overlapping duration is not added. TV rewatch sessions contribute only their own recorded durations.
- Missing duration is not a zero-length watch. The UI reports excluded events and Unknown when no usable durations exist. Displayed zero recorded/estimated subtotals mean **no known duration in that component**, not that the user watched zero hours. Mixed totals explicitly label recorded plus estimated components. Undated time contributes only to all-time totals. Genre hours overlap for multi-genre titles and must not be summed across genres.

## Charts and export

Recharts is loaded with the Analytics route. Sections limit concurrent charts; shared calculations and selectors are memoized and never query storage per chart. Charts show at most 12 ranked labels or 80 time/category labels; supporting tables and CSV keep all chart rows. Supporting-data links navigate to existing genre, decade, status, language or title views where supported; no unsupported person filter is fabricated.

CSV exports include full underlying values, samples and selected-filter context, using Papa Parse's spreadsheet-formula escaping. PNG exports rasterize the visible Recharts SVG locally with a title, dark background, context and footer. Empty charts cannot export a PNG. Downloads are browser requests, not a promise that a file was saved. Heatmap image export is not implemented; yearly/monthly supporting data remains exportable. No PDF, backup/restore, or diary editing is added in this phase.
