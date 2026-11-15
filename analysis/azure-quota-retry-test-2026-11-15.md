# Automatic quota handling and full Instagram test

## Change
The former three-attempt loop treated HTTP 429 as an ordinary transient failure and stopped the report. Quota waits now have no attempt cap and do not consume the separate network/server failure budget. Retry-After/body delays are respected with jitter, and long timers are chunked to avoid overflow. Requests remain sequential. The loading screen uses a neutral capacity-wait message.

A live run exposed a second path: Azure can send a rate-limit error inside an HTTP 200 Responses SSE stream. The proxy previously returned non-retryable 502. It now normalizes stream throttling to retryable 429 and records the shared cooldown. Tests cover both standalone error events and response.failed events.

This is transparent retry while the page remains open, including background tabs. It is not a durable server-side job after the browser is closed. Checkpoints remain stored for resumption. Non-quota and permanent failures retain separate handling.

## Live result: completed
Project: Nike — تست کامل Instagram و Azure
ID: 2f6926b1-49fd-4b2c-8325-238496779b26
Target Instagram: nike; competitor Instagram: adidas, puma.

All three profiles were collected. Saved post counts: Nike 25, Adidas 6, Puma 8. Raw data was reused after the stream-error fix; no replacement Instagram crawl was needed.

Observed real quota_wait: 60,299ms, followed automatically by the same request. Nike analysis then succeeded (HTTP 200, 72,024ms). Another quota wait during scoring stayed on the loading screen and resumed automatically.

Completed: brand analyses, synthesis, industry overview, CPM design, candidate review, model approval, all three brands' scoring, 50 audience topics, recommendations, final database save, JSON download, page reload and reopening the saved report. Database record no longer has a draft. Export JSON parsed successfully.

CPM candidate decision: retained the initial five indicators; excluded an extra size-guide criterion because the guide content was not collected. Approval was for this test report, not a validated business recommendation.

## Limits and findings
- Instagram collection succeeded for all three businesses, but full website crawling was unavailable for Nike and Puma; static audits remained. Adidas crawl content included anti-bot access messaging, which limits the analytical quality of that source and merits a separate source-quality improvement.
- Final report shows evidence coverage 75% for Nike and 50% for Adidas/Puma and explicitly withholds reliable ranking. Successful execution does not mean complete evidence or commercially validated conclusions.
- No employer/client invitation emails were sent. PowerPoint/PDF generation was not part of this validation.

## Verification
68 automated tests passed, including more than three consecutive 429 responses, separate failure budgets, Retry-After dates and body values, and Azure SSE throttling. Build passed; lint had warnings but no errors.

Screenshot of live quota waiting: azure-quota-wait.jpg.
