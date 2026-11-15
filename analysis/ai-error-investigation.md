# AI request failure investigation — 2026-10-05

The supplied browser log has 10 request starts, 9 response headers, 6 recorded successes, and 2 HTML HTTP 502 responses. The last request has no terminal event in the export. One HTTP 200 also lacks a success event, so headers alone do not establish completion.

The Azure failure arrived after 19.6 seconds with a 12,404-character prompt. A later request of the same length succeeded. This is consistent with a transient upstream/gateway problem; prompt size cannot explain every 502.

The Claude failure arrived after 99.2 seconds with a 490,403-character prompt. The retry sent the identical oversized input. Browser logs do not establish whether the 502 originated at Cloudflare, 9Router, or its provider; server logs are needed for that attribution.

## Confirmed code defects and changes

- Raw Instagram profile trees, summaries, and platform scraper payloads were embedded in report prompts. Bound evidence samples, omit media trees, preserve factual profile fields, and use a smaller overview context. Bound official website evidence in industry placement too. Full scraped data stays available in the research cache.
- The Worker cleared its abort timer once fetch returned headers, leaving body consumption unbounded. Keep the timer through the entire body and share a 75-second deadline across fallback candidates. The browser also has a 90-second deadline covering its body read.
- Buffered upstream generation could remain silent for too long. Request SSE from 9Router and assemble the existing JSON response for the browser. Handle errors inside SSE as failures. This still has a total deadline; streaming does not guarantee the provider finishes in time.
- Oversized requests now return an actionable HTTP 413 before any provider call. Include UTF-8 byte count in browser logs. Include HTTP 524 in transient retry/failover handling and avoid retrying a missing server API key.

## Verification

Run `node --test tests/ai-reliability.test.js`: six regression cases cover evidence bounds, HTML 502 failover, SSE assembly, stalled response bodies, a shared fallback deadline, oversized input rejection, and provider errors inside HTTP 200 SSE.

`pnpm build` and `pnpm lint` pass. Existing lint and bundle-size warnings remain. Verification uses mocked provider responses; live provider behavior and the production deployment are not verified by these tests.

Deploy the rebuilt project through the existing Cloudflare deployment flow to apply the fix to the hosted application. No production deployment was performed as part of this investigation.

## Follow-up: audience-topic prompt budget failure

The original topic generator still embedded the entire target object and full competitor analyses, then requested 25 detailed topics at once. The server budget exposed this remaining oversized-input path. The generator now uses a bounded context, examines platform evidence in groups of 10, and generates 50 topics in groups of 5. It checkpoints every successful evidence/topic group; failed topic groups split recursively down to one topic. Resume follows saved split decisions and never reruns successful groups. Invalid counts and duplicate topics are rejected before saving.

Both report completion and topic refresh supply persistent checkpoints. Refresh also saves search queries and collected platform data to avoid repeating Apify collection on resume. The loading error screen offers a direct continuation from the saved draft.

Three additional mocked regression tests cover large input bounds and complete evidence traversal, split/resume behavior, and recovery from incomplete topic output. All nine tests pass. This does not verify a live model or deploy the new build.

## Save and resume across analyses

- Industry review saves category detection and the focused briefing independently. Reusing an unchanged approved briefing no longer clears the industry pipeline. Changing the briefing invalidates only structure and placement, preserving collected source evidence.
- Industry evidence batches accumulate across the loop; the old loop incorrectly copied the original snapshot on every iteration, losing earlier batches. Partial responses now persist recognized businesses and leave missing businesses pending instead of marking them completed with empty evidence.
- Project snapshots are written to browser storage before the server request. A server disconnect can use that durable browser snapshot. If both storage destinations fail, saving raises an explicit error. Draft processing can continue when the browser save succeeds.
- Project loading and archive merging select the newer snapshot using its saved timestamp, preventing an older server draft from hiding newer local progress.
- Presentation plans are saved before PowerPoint export. The key hashes the actual presentation prompt; retrying a failed export reuses the completed plan, while changed inputs generate a different plan.

The three project-persistence regression cases cover saving before network loss, recovery from newer local progress, archive version selection, and total storage failure. Twelve tests pass in total, along with build and lint (existing warnings remain). Saved checkpoints contain completed results, not an unfinished model response; a request interrupted before producing a valid result is rerun as that one unit.

## Website score integrity

The website-absence override in `calculateCpmRow` applied only when the model's raw score was null. A fabricated positive score therefore bypassed it. In addition, report enrichment fell back to the AI's website URL when the canonical business had no website, and preserved an inferred UX score without collected website evidence.

Absence now overrides all website criteria to zero, including model-provided positive scores and scoring scales whose minimum is above zero. A registered URL without collected page evidence has null scores. The canonical input supplies the website URL. Report repair removes invented UX claims, updates stored evaluations and website summaries, and records website evidence provenance for subsequent loads. CPM evaluations are sanitized before generating the factor summaries too. Archive and owner-panel display apply integrity checks, including older reports without Instagram cache data.

Five additional regression cases cover positive hallucinated scores, unaudited URLs, repair of a fabricated URL and evaluation, preservation of audited results across reload, and legacy report correction. All seventeen tests pass; build and lint also pass with existing warnings. A particular client's saved report was not provided, so its exact raw model response was not inspected.

## Industry screenshot: Failed to fetch

The screenshot shows a browser transport failure after three retries, without an HTTP response or server request ID. It does not identify whether the browser connection, gateway, or server failed.

Two concrete issues were corrected: the industry update button performed a forced refresh even after a failed pipeline, and the Worker-to-browser response stayed silent while the upstream response was assembled. Failed industry runs now offer direct continuation with the approved briefing and cached stages. The browser opts into an NDJSON response that acknowledges receipt immediately, sends a heartbeat every ten seconds, and includes the final JSON result and its effective HTTP status. Existing JSON clients and servers remain compatible. Request deadlines still apply; the heartbeat does not claim model progress or eliminate provider/network failures.

Four transport regression tests cover immediate acknowledgement before upstream completion, fragmented Persian UTF-8 frames, final error statuses, truncated streams, and JSON compatibility. All twenty-one tests pass. The production build is in `dist`, without a ZIP; deployment and real-network verification remain pending.

## Loading screen stuck on retry message

The next screenshot shows the second retry message remaining on screen. It cannot establish which network request was pending. Code inspection found three concrete indefinite waits: server project saving had no timeout, the error handler awaited that save before displaying the error, and stream cleanup awaited cancellation before returning a completed result.

Project requests now have a 15-second deadline through body parsing and use the browser snapshot when remote saving stalls. Error display precedes error persistence. The entire AI attempt has a 90-second Promise.race deadline as well as transport cancellation, so cancellation alone is no longer relied on to settle a pending operation. Stream cleanup is non-blocking. A retry-start event replaces the old delay message when the next attempt starts.

Four regression cases exercise ignored AbortSignal, a stalled stream, stalled cancellation after a valid result, and a server save that never resolves. Twenty-eight tests pass in total. These are mocked reproductions of the identified code defects, not verification of the user's live stuck session.
