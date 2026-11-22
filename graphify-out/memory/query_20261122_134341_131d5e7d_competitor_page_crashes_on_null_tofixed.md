---
type: "query"
date: "2026-11-22T13:43:41.733544+00:00"
question: "Competitor page crashes on null toFixed"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SeoReport()", "Competitor()"]
---

# Q: Competitor page crashes on null toFixed

## Answer

Expanded from graph vocabulary: Seo Report Competitor. Graph located SeoReport in ResearchDashboard.jsx. Source inspection found unguarded onPage and technical toFixed calls. Added missing-score formatting for all three SEO scores; null remains unknown and measured zero remains zero.

## Outcome

- Signal: useful

## Source Nodes

- SeoReport()
- Competitor()