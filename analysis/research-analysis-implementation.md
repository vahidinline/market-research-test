# Research pipeline implementation

Implemented locally; not deployed. Tests use mocked upstreams and create no paid Apify or AI requests.

## Collection and cost
- Default research scope is website and Instagram. Maps is discovery only. YouTube, LinkedIn and Reddit require explicit selection.
- Optional Actors require an explicit input adapter matching the configured Actor. Unknown schemas fail without paid collection rather than guessing parameter names.
- Canonical Actor/input requests are claimed in D1 before starting Apify. Duplicates reuse the stored run/dataset; uncertain starts remain reserved for reconciliation. Different Actors or collection options remain different requests; exactly-once successful delivery cannot be guaranteed across external service failures.
- Full raw snapshots are persisted separately from compact AI evidence. R2 RAW_DATA binding is supported but not provisioned; without it, large snapshots use D1 parts. Migrations 0004 and 0005 document the new schema.

## Analysis and evidence
- Website: up to 6 pages; Instagram: profile and up to 12 recent posts; selected optional channels: up to 5 records each. Excerpts are bounded; source IDs, URLs and metrics are retained. Images/video are not analyzed.
- Profile analysis runs separately. Overview uses bounded summaries. Indicator design uses a limited raw evidence sample (at most 24 source records, at most 12 brands); final report discloses sample coverage. Scoring runs per business and factor.
- Industry classification is batched and validates that every business ID is accounted for before merging. Placement exposes sampled context and coverage.
- Structured outputs are validated. Local repair receives the original output; indicator repair cannot remove existing criterion IDs. Generated, reviewed and approved indicator versions persist separately and can be restored in approval UI.
- Stage keys include input/prompt and model fingerprints. Completed stages persist before proceeding; failed storage blocks downstream work. Resuming a downstream failure reuses valid completed stages. Changed inputs invalidate the corresponding stage keys.
- Prompts enforce a conservative 56KB UTF-8 input ceiling, with configurable context/output budget. Byte budgeting is conservative and is not exact tokenization. Logs retain stage duration, payload size and provider usage when available; monetary cost requires actual provider pricing.
- No unsupported market-share percentages, visual-quality scores or actual-service-outcome claims. Missing evidence is null. Strict scores require same-business evidence IDs and appropriate channels; definitions and scoring levels are required for indicators.
- Report includes scope, sample limitation, evidence registry, weighted coverage and ranking sensitivity to factor-weight changes. Insufficiently covered rows are excluded from sensitivity rankings and positioning maps.
- Audience topics distinguish observed source signals from hypotheses and namespace checkpoints by evidence/context fingerprint.

## Validation and release boundary
- Automated coverage includes duplicate/concurrent/ambiguous collection, pagination, raw object/D1-part persistence, budgets, evidence validation, storage failure, batch completeness, score integrity and complete analysis resume after a simulated late failure.
- Local UI scope controls were rendered and inspected. Production build and lint run locally.
- Production deployment, D1 migrations on the remote database and validation against real Actor datasets have not been performed. Verify configured website Actor and optional adapter inputs against real outputs before release; this implementation does not certify unprovided production datasets or credentials.
