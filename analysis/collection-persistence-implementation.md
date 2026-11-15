# Collection and indicator persistence

Implemented locally; not deployed. No paid Apify executions were used for testing.

- Server claims each actor/input pair in D1 before dispatch. Duplicate submissions reuse the run or saved dataset. Ambiguous starts are reserved and return 409; an operator must reconcile the Apify run rather than blindly retry.
- Instagram report collection now uses normalized individual handles, independently for profiles and posts. Website and platform calls also use the durable actor/input repository.
- Complete dataset pages are read in groups of 500 and persisted before returning data for analysis. Raw server snapshots have no seven-day expiry. Historical accessible report caches can be imported without starting Actors; they contain the previously compacted data, not recoverable full originals.
- A database outage blocks new collection. Deployment needs DB and a server APIFY_API_KEY (or legacy VITE_APIFY_API_KEY) plus configured website/platform Actors.
- Generated, validated, review-ready, edited and approved indicator versions are retained in the project draft. Model repair receives the prior model and instructions to retain its indicators. Approval UI allows restoring validated historical versions. Final report snapshots retain the version history and approved model.
- Standalone public/_worker.js embeds the same collection handler as functions/lib/apify-store.js because Vite copies public files unchanged. Keep these implementations synchronized.

Known boundaries: request identity includes Actor and sampling options; different options create a different resource request. This is at-most-once dispatch for the same canonical request, not exactly-once success or a permanent profile-wide lock across every Actor/configuration. Ambiguous starts require reconciliation; no refresh UI is implemented. Expired legacy caches cannot be recovered retrospectively. Large raw snapshots now use R2 when bound, or chunked D1 fallback. See [research-analysis-implementation.md](./research-analysis-implementation.md) for the subsequent analysis and quality changes.
