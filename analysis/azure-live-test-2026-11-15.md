# Azure live test — 2026-11-15

## Result
Partial end-to-end execution; final report was NOT generated. Test project is retained in the local database: `Basecamp — تست Azure`, ID `4c686318-90ff-4a0f-a21e-6ae5af2d71a3`.

## Verified live
- Corrected deployment to `gpt-6-astra-1`; the resource/endpoint remains `automatune-resource`.
- Small initial Azure request: HTTP 200, 49 tokens.
- Browser sign-in, project draft creation, database persistence and reload.
- Basecamp, Trello and Asana profile analyses; synthesis and industry analysis reached completed checkpoints.
- Azure 429 retry delays were honored (approximately 60 seconds plus jitter).
- A Worker restart interrupted an in-flight request during configuration editing. This was caused by the test's configuration change, not evidence of an Azure outage. The saved draft survived.
- Resuming reused completed checkpoints.
- Missing APIFY_WEBSITE_ACTOR initially prevented full website crawling (Actor and input are required); static HTML audits remained available. Configured apify/website-content-crawler.
- Separate one-page Basecamp crawler completed successfully: run idxvzIAhIvHEOpJNs, one page, 4293 text characters. This does not retroactively replace the original draft's static audits.
- Changed Azure Responses to SSE, requiring a terminal response object. Increased Azure deadline to 180 seconds and client deadline to 210 seconds. Final small live streaming test: HTTP 200, 51 tokens, request 772ac019-e169-43ef-8333-58f638b2847d. Long CPM generation with the new transport remains unverified.

## Remaining findings
- Azure repeatedly returned token-rate-limit 429 despite small sequential test requests. The exact cause (other quota consumers, capacity, or effective deployment quota) was not determined. Local shared accounting cannot control other applications using the deployment.
- Before SSE change, longer CPM requests encountered network failures after approximately 33 and 60 seconds; some succeeded on retry. SSE reduces silent connections but is not a guarantee against network failures.
- The test intentionally used website-only public businesses with no Instagram handles. The form accepts these inputs, while the four-factor CPM requires a social criterion backed by evidence. Generated and repaired `social_metric` both had empty evidenceIds, causing validation to stop the report. Evidence validation was preserved; an actionable message now identifies the criterion and missing Instagram evidence. Website-only support in the four-factor model remains unresolved.
- Full Instagram scraping, discovery, CPM approval, final scoring, report rendering and exports were not verified in this live run. No invitations or emails were sent.

## Automated verification
62 tests passed after changes. Build passed. Lint reported warnings but no errors. Tests include Azure terminal streaming, truncated-stream rejection, shared quota accounting, missing deployments and actionable missing-evidence diagnostics.
