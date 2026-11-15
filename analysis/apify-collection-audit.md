# Apify collection audit — 2026-10-12

## Scope and evidence

Read-only audit of current source, graphify call relationships, and official Actor input schemas. No paid Actor runs were started. Live D1 records, deployed secrets, and actual dataset samples were not inspected; source-level persistence support does not establish successful production writes.

## Collection contracts

| Purpose | Actor | Current input | Assessment |
|---|---|---|---|
| Market discovery | compass/google-maps-extractor | searchStringsArray, maxCrawledPlacesPerSearch:40, language | Documented fields. Local listings are useful discovery evidence, not proof of a complete online/global market. Additional model searches use 20 places/query. |
| Instagram account discovery | apify/instagram-search-scraper | comma-separated search, searchType:user, searchLimit:5 | Documented format; five results per search term. Search hits must not be treated as complete profile records or verified brand identity. |
| Instagram profile | apify/instagram-profile-scraper | usernames array | Correct documented input. Collected during discovery for the target, and again in report collection without a common per-profile repository. |
| Instagram content | apify/instagram-scraper | directUrls of profiles, resultsType:posts, resultsLimit:30 | Feed sampling is consistent with Actor purpose; no explicit dedicated reels run, transcription, or visual analysis. Validate the actual dataset before claiming all reels are covered. |
| Website evidence | server-configured APIFY_WEBSITE_ACTOR | startUrls, crawlerType:playwright:chrome, depth:2, pages:12, markdown | Fits website-content-crawler if that is the deployed Actor. Chrome remains an enum but is deprecated. Required proxyConfiguration is absent from the explicit payload; verify Actor defaults/configuration. |
| YouTube / LinkedIn / Reddit | configurable VITE_APIFY_*_ACTOR | common startUrls; separate platform-specific keyword guesses | Cannot certify without actual Actor identities and schemas. Common startUrls is not a universal Actor contract. |

## Violations of collect-once intent

1. App.jsx:134-172 keys Instagram cache by the entire sorted handle set. Adding a competitor changes the key and recollects existing profiles/posts. The actual Actor input uses allHandles, not deduplicated normalizedHandles.
2. researchCache.js:5,35 and both cache API implementations exclude entries older than seven days. Stored draft profilesData can bypass collection for the same resumed draft, but cross-project reuse is not permanent.
3. App.jsx:149-172 persists profiles only after posts succeed. Post failure plus reload can lose already-paid profile output. In the same session the in-memory profile cache may instead bypass the entire collection block, leaving posts missing.
4. App.jsx:153 and 159-172 transform profiles and truncate captions to 1200 characters before persistence. Original profile fields, media evidence and complete paid output are not retained in this path.
5. saveResearchCache accepts either browser or D1 success. A successful return does not guarantee database durability. Cache read errors are swallowed and become a miss, potentially authorizing a new paid run.
6. startAndCollectApifyRun stores no durable runId or collection job before polling. A reload, lost start response, or status failure can lead to another Actor execution. There is no server-side unique job lock for concurrent tabs.
7. Discovery and report collection have separate cache contracts. inspectWebsite has no URL-level cache and is called again from report collection after discovery. Other-platform results are persisted only after the combined collection phase, and the same combined platformData is attached to every business.
8. Dataset retrieval is capped at 500 without pagination. At 30 posts per profile, 17 fully populated profiles already exceed that cap. SUCCEEDED does not establish per-profile completeness; error-shaped dataset entries are not explicitly rejected before normalization.

## Required design before AI optimization

- A durable source repository keyed by platform + canonical entity ID + resource kind (profile/posts/website), with immutable raw snapshots, capturedAt, Actor/build/input metadata and completeness status. Drafts reference snapshots rather than acting as the only source store.
- Persist each collection job and its runId, then each successful resource immediately. Database write failure blocks further paid collection. An unavailable repository must be reported as unavailable, not interpreted as an absent profile.
- A unique server-side claim prevents duplicate dispatch from tabs/projects. Jobs with uncertain start outcomes require reconciliation with Apify; blind POST retries cannot guarantee exactly-once external execution.
- Permanent reuse by default. Staleness is informational; only an explicit refresh creates a new paid snapshot. Profile and post sampling are separately tracked resources, even if a chosen Actor can provide both in one execution.
- Validate actual dataset shapes, reject error rows, paginate all results, map ownership explicitly, and preserve unknown values as null. Mark empty/private/not-found outcomes separately from successful usable evidence.
- Per-Actor adapters validate inputs and outputs for configured platforms. Do not attach pooled channel evidence to each competitor without ownership mapping.
- AI receives a derived, versioned evidence view. Summary changes and model retries must only read stored snapshots and never invoke collection.

## Acceptance checks for implementation

- Reanalyzing or reopening a draft makes zero new Actor-start calls.
- Adding one profile collects only its missing resources; existing profiles remain reused.
- Reload after starting a run resumes that run; status/results network retries do not create runs.
- A post-stage failure preserves profile output in D1 and resumes only missing posts.
- Two tabs requesting the same profile share the same collection job.
- Data older than seven days remains reusable; explicit refresh is required for a new paid snapshot.
- D1 outage causes a clear storage error and no new paid collection.
- More than 500 dataset rows are fully retrieved, with per-profile completeness verified.

## Official references

- https://apify.com/compass/google-maps-extractor/input-schema
- https://apify.com/apify/instagram-search-scraper/input-schema
- https://apify.com/apify/instagram-profile-scraper/input-schema
- https://apify.com/apify/instagram-scraper/input-schema
- https://apify.com/apify/website-content-crawler/input-schema
