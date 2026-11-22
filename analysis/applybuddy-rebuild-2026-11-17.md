# applybuddy.farsi — production rebuild

Completed 2026-11-17. Production project `784be01c-8082-4845-9fdd-a9784666f328` is now a complete report, not a draft. The saved final snapshot was fetched from `/api/projects` and compared for exact equality.

- Reused the existing collected raw data; regenerated analysis, model, scores, introductions, topics, recommendations and prose through the production Azure API.
- 11 brands; 9 social criteria, 3 website criteria, 3 product/service criteria, 1 registration/licensing criterion. Four main factors retain equal 25% weights.
- 50 audience topics and 5 recommendations.
- 306 prose fields rewritten and accepted; 2 original, readable paragraphs retained because proposed edits failed semantic review.
- Independent audit reconstructed the scored rows from the saved raw AI evaluations and verified every raw/normalized score, factor score and evidence ID against the edited final report. Approved model unchanged by prose editing.
- All scoring and editorial stages persisted to the production project as checkpoints. Final server write and read succeeded.

## Input corrections

1. Artan's stored Instagram handle was `green_mile_apply`, whose profile explicitly belongs to Zahra Tamjidzad. Removed that Instagram input from Artan, retaining its own website. The original raw snapshot is preserved in the private pre-rebuild backup.
2. The target's industry briefing contained the old flynyx aerial-gym project. Removed it from this migration/education report's input. These are corrections to this project's stored inputs; general form-state isolation was not changed in this task.

## Additional pipeline fix discovered in the real run

The crawler's HTML SEO audit existed, but `businessEvidence` omitted it. This made website scoring treat available technical measurements as missing. Added an appended website evidence record with the actual stored audit and explicit `interactionTested: false`. Existing evidence IDs remain unchanged. Keyword matches are not treated as successful booking or form interaction.

98 tests passed; production build passed. Deployment `8eb0cba1`, asset `index-sDPWb81R.js`; production Azure configuration health check passed.

## Limits

Image/video quality remains unscored because this collection supplies text rather than visual evidence. Actual booking-form operation was not tested. HTML measurements are not Google search rankings or measured service outcomes. Missing data remains unknown, not proof of poor quality or absence.

## Production UI follow-up

The scope/evidence-quality panel was placed above the shared tab content, so it appeared on every tab. Restricted it to `industry` (and once at the beginning of the full-report print view). Deployment `98abf202`, asset `index-C4W0duFu.js`, passed build and production Azure configuration health check. Live browser checks on the completed applybuddy report found one panel in Industry and zero panels in CPM and SWOT.
