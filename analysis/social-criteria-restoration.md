# Fixed social criteria and plain-language reporting

## Behavior

Eight fixed social criteria are restored: photo/video quality, visual creativity, video storytelling, highlight organization, page visual consistency, useful content topics, clear captions, and a clear profile introduction. A deterministic registry adds them during methodology preparation and approval, retaining existing industry-specific criteria. The approval interface prevents deletion of the fixed criteria and their groups.

Fixed criteria describe evaluation standards, so their existence does not require a scraped evidence citation. Assigning a score to a text criterion still requires evidence from the business being scored. Visual criteria remain present with null scores and `needs_visual_review` status while the pipeline supplies text only. This release does not add image/video ingestion or claim a visual assessment took place.

For new/reviewed models, the visual and text groups each initially receive 20% of the social factor's internal weight; previous groups share the remaining 60%. Weights remain reviewable before approval. Missing visual evidence reduces coverage rather than becoming a zero rating. Stored locked models are not automatically migrated or rescored. Their report UI shows the fixed checklist separately and states that the approved weights remain unchanged.

Reports and approval labels use common wording. A shared prompt instruction requests short, complete, concrete sentences and prohibits jargon chains. Known cumbersome phrases in display labels and descriptions are simplified without rewriting IDs, numeric data, URLs or evidence excerpts. This is not a complete AI rewrite of every historical report paragraph.

## Validation

83 tests pass, including new cases for all eight restored criteria, idempotence, partial-group repair, weight validation, rejection of invented visual ratings, continued evidence validation for generated criteria, and preservation of identifiers/numbers/source excerpts during language simplification. The pipeline regression verifies 95% coverage when the social factor has 20% unassessed visual weight and the factor represents 25% of the total. Build passed. Lint reported only existing warnings.

## Production verification

The restored eight-item checklist and simplified table heading were verified in the existing applybuddy.farsi report on production, without resaving or rescoring the report. Its locked-model notice correctly states that existing scores remain unchanged.

A subsequent wording pass maps the actual cumbersome labels observed in that report to plain equivalents, including «روابط نهادی ادعاشده» → «همکاری‌های اعلام‌شده» and «عرضه مسیر تحصیلی بورسیه‌دار» → «ارائه پذیرش همراه با بورسیه». Final validation: 84 tests passed. Final production deployment: `0931bb58`, https://0931bb58.market-research-roxi.pages.dev. Encrypted-secret preflight, build, deployment and live Azure configuration health check passed.

## Correction to match the supplied Business Box reference (2026-11-17)

Replaced the improvised fixed_social_* framework with the exact reference social/website factor groups, criterion IDs, labels, weights and score ranges. This configuration includes eight historical base social criteria plus the sample's approved creative-video criterion (nine total), and all three website criteria in the sample (including its two approved additions). The sample-specific additions are intentionally included because this report was selected by the user as the reference.

New models and review screens restore this framework deterministically. Incorrect/generated social and website factor definitions are retained in previousDigitalFactors for traceability, not mixed into the active standard framework. Explicitly approved additional project candidates are retained separately. Old approved drafts return to methodology review on resume; after approval the existing model-change path invalidates prior completion scores. Completed locked reports are not silently reweighted.

Validation: all 86 tests passed, including exact reference shape/weights, idempotence, partial repair, approved extra criteria, visual-rating evidence safeguards, and required review of old approved drafts. Initial deployment attempt did not execute because the automatic approval service hit a temporary token rate limit.

After waiting for the approval-service rate limit, the same guarded deployment succeeded: `99c22d47`, https://99c22d47.market-research-roxi.pages.dev. Encrypted-secret preflight, production build, deployment and live Azure configuration health check passed. Published frontend asset: `index-JZ9Mvn8F.js`.
