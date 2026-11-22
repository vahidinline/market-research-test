# Production error investigation — 2026-11-16

Read-only inspection of https://market.roxiapp.online/ and Cloudflare D1. No deployment, production writes, or AI/Apify reruns performed.

## Confirmed production observations

- Cloudflare Pages project: `market-research-roxi`, with custom domain `market.roxiapp.online`.
- Browser console reports an 85,716-byte prompt against the 56,000-byte ceiling in `/assets/index-BY-y1DlB.js`.
- The stack at line 12, column 14979 maps to the qualitative four-factor introduction in `completeResearchWithApprovedCpm`, after per-business scoring. It sends the entire CPM model and all evaluations in a single prompt. Source counterpart: `src/utils/ai.js`, `factorOverviews` stage. There is no batching at this stage.
- The second stack reaches the cached-result branch of `createStageRunner` and `checkpoint.save()`, while replaying previously completed scoring. Cached results still trigger full-project persistence.
- The page displays an earlier database-save success notice alongside the current save failure.
- Read-only metadata query on the configured remote D1 database found the latest project snapshot is 6,576,890 UTF-8 bytes, saved at 2026-11-16 14:12:52 UTC (17:42:52 Tehran). This proves an earlier snapshot exists, not that the failing/latest in-memory stage was saved.

## Save failure mechanism

`saveProject` serializes the current project together with all locally stored projects into one localStorage entry, then POSTs the entire current project. A local write exception is swallowed. If the remote operation also fails, the function throws the combined browser/server failure message.

`projectRequest` has a 15-second deadline encompassing fetch and response JSON parsing. Its fixed timeout message claims the browser copy is preserved without checking that claim. When localStorage writes fail, this creates the exact contradictory message observed on production. The combined failure proves the attempted local save threw, but the exception type is discarded; quota exhaustion is plausible given the snapshot size, not conclusively established.

The timeout proves the client did not finish its request within the deadline. It does not prove D1 rejected the write or identify network, upload, edge, or database delay as the cause. Server request traces for the incident were not obtained.

## Recommended changes

1. Generate qualitative introductions per factor using the relevant scores and a minimal model projection; omit evidence registries, candidate pools and unrelated factors. Enforce UTF-8 budgets on each actual prompt, including repair prompts, with further batching when needed.
2. Move large local drafts to IndexedDB and preserve storage exception details. Replace full-project rewrites for every cached stage with versioned/dirty checkpoint persistence, while ensuring newly produced outputs are durably saved.
3. Remove unconditional browser-preservation claims from transport errors; report actual local and remote save outcomes. Reset the old success notice when a new save starts or fails.
4. Instrument request bytes, elapsed time and request IDs for server saves before attributing timeout to D1 or simply increasing the deadline.

## Reproduction

A local Node assertion reproduced rejection at exactly 85,716 bytes and the contradictory combined error using simulated localStorage quota failure and network timeout. No live data was modified. Existing stage inputs/outputs were not rerun through a paid provider.

## Resolution and deployment

Implemented and deployed on 2026-11-16 to production deployment `408f20be` (https://408f20be.market-research-roxi.pages.dev).

- Qualitative factor introductions now use UTF-8-bounded batches of scored facts, per factor, with recursive summary reduction. Numeric CPM scoring is unchanged.
- Large repair responses no longer get blindly appended beyond the prompt ceiling. JSON punctuation is included in batch accounting.
- Browser persistence uses one IndexedDB record per project, with legacy localStorage reading/fallback. Failed writes include actual error details.
- Large server uploads use gzip with bounded decompression on the authenticated server; plain JSON clients remain supported. The save deadline is 60 seconds with one transient retry, and server acknowledgement must match the project ID.
- Same-project saves are queued and snapshots cloned before asynchronous work. Cached analysis outputs confirmed durable in the current session skip repeat saves; newly computed outputs still require successful remote persistence.
- Draft save status clears stale success messages before each attempt and reports failures truthfully.

Validation: all 78 tests passed, including 10 new regression tests for 7 MB offline drafts, migration, compressed authenticated writes, corruption rejection, save ordering, retries, cache resume, repair bounds and large Persian overviews. Build passed; lint had no errors (12 pre-existing warnings). Bundle-size warning remains.

A private temporary copy of the affected production draft was used without provider calls: all 11 brands and 4 factors retained, 8 overview requests, maximum prompt 15,732 bytes versus the previous 85,716-byte failing prompt. The 6,576,890-byte snapshot compresses to a 1,312,870-byte request. Summary outputs were mocked for this size check; this is not a claim that the live AI report was completed.

Post-deploy: the custom domain serves `index-BrluiKhN.js`, matching the built asset. The unauthenticated projects API returns 401. A separate authenticated browser tab loaded the app and all 9 archived projects, including the affected draft, with no captured error/warning logs. The user's old error tab was left intact. No AI/Apify rerun or production report content edit was performed during verification.

## Follow-up: Azure configuration regression

The first CLI deployment replaced Pages plain-text environment variables with the four entries in local `wrangler.jsonc`. The previous deployment (`68716b4d-602b-4146-84fa-c1885bb2ca86`) contained 23 additional settings, including the Azure key, as plain-text environment variables. Static-page and archive checks did not detect this AI configuration regression.

Recovered all 23 missing values directly from the previous deployment through the Cloudflare API and stored them as encrypted production secrets; values were never printed or written to a local file. Added `pnpm deploy:production` with required-secret preflight checks and a live `/api/ai` configuration GET after upload. Aligned the Wrangler project name with production, and added actionable missing-setting names to the Azure 503 response.

The subsequent deployment has NOT executed: automatic approval review failed on the first attempt and explicitly rejected the retry. A read-only check still returns HTTP 503 from the active deployment. Restored project secrets require a new deployment to take effect. User guidance/approval is needed before another deployment attempt; do not bypass the review rejection.

### Configuration recovery completed

Following explicit user approval and the updated execution permission flow, `pnpm deploy:production` succeeded. Production deployment: `6ec6ab40` (https://6ec6ab40.market-research-roxi.pages.dev). Required encrypted-secret preflight, build, deployment and live Azure configuration GET all passed.

A minimal live POST to https://market.roxiapp.online/api/ai returned HTTP 200 and exactly `{"ok":true}` from Azure deployment `gpt-6-astra-1`. Usage: 41 input tokens, 9 output tokens. Request ID: `0f208e34-631b-4888-979c-fc18ce7b7f87`. This verifies the restored credentials and actual upstream connectivity, resolving the earlier 503. The user's research report itself was not rerun by this smoke test.
