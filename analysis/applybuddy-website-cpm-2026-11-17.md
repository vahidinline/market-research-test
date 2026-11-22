# applybuddy.farsi website CPM correction

Production project: 784be01c-8082-4845-9fdd-a9784666f328.
Final deployment: 0bf3b57e, 2026-11-17.

- Replaced robots/sitemap HTML substring inference with timed direct probes, including same-origin robots-declared sitemap paths. Blocked, invalid HTML fallback and undiscovered sitemap paths remain unknown, not false.
- Added opt-in website audit scoring v2. The existing base criterion is computed from the seven on-page checks (raw = 3 * passed / 7). Existing binary infrastructure criterion requires HTTPS, successful response and verified sitemap. Interaction remains untested/null.
- Website aggregation preserves original criterion weight ratios across available criteria, instead of giving an incomplete subgroup its full weight. Coverage is displayed beside website scores. Other factor aggregation is unchanged.
- Future prepared models use v2. Archived models are not silently migrated. Only this production report was explicitly migrated to model version 2.
- Appended six fresh evidence records; retained all prior evidence. Updated website analytics, website scores, CPM totals, positioning, sensitivity and website overview sources. Strict pre-save assertions confirmed SWOT, all other report sections, social/product/industry criteria and their scores unchanged. Remote reread matched saved snapshot exactly.
- Scores: applybuddy 0.8095; Scorize/Abroadin 0.9047; Pars Radin/Artan 1; Boomeno 0.5714. Website coverage 75% for first five, 50% Boomeno. No registered website remains null. These are scores of measured checks, not complete website quality or Google rankings.
- 103 tests passed; build and deployment health check passed. Chrome production report CPM showed new scores and coverage. Opened the current archive entry dated 1405/8/26; a separate stale browser-local applybuddy entry dated 1405/8/25 still exists and was not deleted.

Private backups and patch artifacts are in /tmp/applybuddy-before-website-save.json, /tmp/applybuddy-after-website-fix.json, /tmp/applybuddy-website-audits-v2.json and /tmp/applybuddy-patch-website.mjs (not committed).

## Subsequent prose and explicitly requested estimates

- Prose-only follow-up rewrote engagement explanations for all 11 brands, replaced پسند with لایک in CPM explanations, clarified visual-review notices and shortened deterministic website explanations. 218 string fields changed, with structural equality after restoring only those fields; scores, criteria, source IDs, original excerpts and SWOT unchanged. Prose deployment: 24787111.
- User subsequently explicitly requested generated values for missing criteria. Implemented a separate, opt-in estimated CPM scenario: median observed peer score for the identical criterion, otherwise an explicit neutral 0.5 assumption. No fabricated evidence IDs; estimates have status estimated and peer provenance. Observed matrix remains unchanged. Estimated rows and totals are marked ≈ in UI. Content-audit visual fields show a neutral assumption, not a claimed image assessment. Comparative score labels explicitly describe estimates rather than asserted competitive advantages.
- Seven focused tests cover missing-score estimation, no chaining of estimates as evidence, source matrix immutability, website audit and weighting.

## Brand-specific estimate explanations

User rejected repetitive assumption notices. Added 83 brand/criterion-specific suggestions in cpmEstimation.narratives and regenerated only the estimated scenario's text; assertions verified every actual and estimated number remained unchanged. Descriptions are visibly labelled suggestions and remain separate from observed evidence. The ≈ marker and one shared concise methodology note remain, so unobserved numbers are not represented as verified measurements. Visual-profile placeholders also use the brand-specific suggestions. Stored inputs contain captions, counts and post links, not media files; no image review was claimed.
