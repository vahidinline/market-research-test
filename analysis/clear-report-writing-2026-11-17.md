# Report writing repair — 2026-11-17

Production: https://market.roxiapp.online/
Final deployment: `825be450` (`index-BlRwtQlw.js`). Production Azure configuration health check passed.

## Changes

- Factor overviews retain brand/criterion identities, score values and evidence IDs. Large inputs are reduced by selecting original facts, not summarizing earlier summaries. Saved `factorOverviewSources` records support the final introduction.
- Industry overview uses namespaced raw evidence and explicit target identity, replacing lossy group summaries that confused local evidence IDs and could omit the target.
- Editorial prompts are separate from technical scoring rules, including during repair.
- A checkpointed rewrite and semantic review stage edits report prose and generated score explanations. Numeric values, model/criterion IDs, raw sources and scoring references are not editable.
- Numeric validation understands Persian/Arabic digits, decimal and thousands separators. Rewrite expansion is bounded to protect the subsequent review request.
- Failed style validation after repair retains original text and records remaining work; storage failures still propagate rather than claiming a durable save.
- Reference framework distinguishes 8 base social criteria and 1 base website criterion from 3 additions approved in the Business Box reference. All 9 social/3 website reference criteria remain initially present. Reference additions are labeled and removable at approval; operator removal survives reopening. Existing locked report scores are not silently migrated.

## Validation

- 97 Node tests passed. Production build passed. Lint: no errors; 12 pre-existing warnings. `git diff --check` passed.
- Live Azure overview test with Business Box and Pilban generated clear prose and 6 valid fact references. Legacy raw score arrays required explicitly joining their names before the test; this is now guarded.
- Full Business Box prose revision: 120 fields reviewed; 112 model-reviewed edits plus 8 agent-reviewed edits. Original CPM model, evaluations, matrix and positioning maps compared equal.
- New production project: `74a730f5-0d8e-472f-b395-f27093e97f67`, named `Business Box — متن بازنویسی‌شده`.
- Original project `6017b016-1b8a-4b5f-b5c1-14f452d85e1b` verified unchanged after saving the copy.
- Compressed POST and GET round trip verified exact snapshot equality. Checkpoint reload completed without additional AI requests. Copy invitation history removed; no invitation sent.
- Opened the new archive entry and verified its rewritten SWOT in the production browser.

## Model comparison and limits

The user explicitly authorized sending three real applybuddy draft paragraphs to Google Gemini. Azure returned HTTP 200 (21.7 seconds); configured Gemini `gemini-3.5-flash-lite` returned HTTP 403 with an HTML response from this connection. No quality comparison with Gemini was possible and the production provider was not changed.

The revised Business Box copy is a prose revision, not a new evidence audit or rescoring. Historic claims remain historic claims. The production applybuddy record remains a draft awaiting criterion approval; a separate locally stored older report is visible in the browser. Existing archived reports are not automatically rewritten or rescored.

Automated semantic review reduces errors but cannot guarantee perfect meaning preservation. Visual criteria remain unscored where images/video are unavailable. Connectivity and upstream failures remain possible; the persistence and resume checks exercise recovery rather than promising zero future failures.
