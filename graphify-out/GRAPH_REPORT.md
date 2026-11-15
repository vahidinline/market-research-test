# Graph Report - market-research-test  (2026-10-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 382 nodes · 900 edges · 19 communities (18 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0f894857`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17

## God Nodes (most connected - your core abstractions)
1. `App()` - 26 edges
2. `ConfigForm()` - 15 edges
3. `normalizeInstagramHandle()` - 14 edges
4. `discoverIndustry()` - 13 edges
5. `loadRawIndustryData()` - 13 edges
6. `safe()` - 13 edges
7. `arr()` - 13 edges
8. `useLanguage()` - 13 edges
9. `clean()` - 12 edges
10. `compactEvidence()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `collectTargetModelExamples()` --calls--> `runApifyActor()`  [EXTRACTED]
  src/utils/industry.js → src/utils/apify.js
- `IndustryExplorer()` --calls--> `discoverIndustry()`  [EXTRACTED]
  src/components/IndustryExplorer.jsx → src/utils/industry.js
- `findTargetInstagramProfile()` --calls--> `normalizeInstagramHandle()`  [EXTRACTED]
  src/utils/industry.js → src/utils/apify.js
- `isTargetBusiness()` --calls--> `normalizeInstagramHandle()`  [EXTRACTED]
  src/utils/industry.js → src/utils/apify.js
- `loadRawIndustryData()` --calls--> `normalizeInstagramHandle()`  [EXTRACTED]
  src/utils/industry.js → src/utils/apify.js

## Import Cycles
- None detected.

## Communities (19 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (41): analyzeWithAI(), accountMatchScore(), applyPipelineResult(), audienceLanguageLabel(), buildIndustryMap(), businessKey(), chunksOf(), classifyIndustryResults() (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (37): AiLogs(), analyzeWith9Router(), analyzeWithGemini(), analyzeWithOpenRouter(), buildAnalysisPrompt(), checkpointRunner(), compactForChunks(), compactIndustryIntelligence() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (27): src_components_cpm_approval, src_components_cpm_candidates, candidateCriterionId(), clone(), CpmApproval(), percent(), rebalance(), WeightSummary() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): dependencies, lucide-react, pptxgenjs, react, react-dom, recharts, devDependencies, oxlint (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (24): src_components_cpm, src_components_presentation, arr(), AudienceTopics(), Comparison(), Competitor(), date(), Directory() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (26): App(), STATE, estimateEngagementRate(), fetchInstagramPosts(), fetchInstagramProfiles(), normalizeInstagramHandle(), normalizeProfile(), postOwnerHandle() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (23): ConfigForm(), DEFAULT_TARGET, defaultCompetitor(), testAiConnection(), loadAiSettings(), saveAiSettings(), withDeadline(), createProjectTransfer() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.23
Nodes (22): ai(), apify(), auth(), cache(), cookie(), currentUser(), digest(), enc (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (14): lucide-react, react, react-dom, AuthGate(), defaultSocialWeights, IndustryExplorer(), SOCIAL_FRAMEWORK, LoadingScreen() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (6): ref_node_assert, ref_node_test, readAiTransport(), env, defaults, row

### Community 10 - "Community 10"
Cohesion: 0.46
Nodes (14): addBulletList(), addFooter(), addTitle(), C, exportPresentation(), fileSlug(), notesFor(), renderBullets() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (8): fresh(), loadIndustryResearchCache(), loadResearchCache(), loadResearchCacheFromKeys(), openDb(), readIndexedDb(), saveResearchCache(), writeIndexedDb()

### Community 12 - "Community 12"
Cohesion: 0.50
Nodes (7): buildMessage(), escapeHtml(), getAccessToken(), isEmail(), json(), onRequestPost(), toBase64()

### Community 13 - "Community 13"
Cohesion: 0.60
Nodes (5): absoluteUrl(), auditSeo(), count(), json(), onRequestPost()

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 15 - "Community 15"
Cohesion: 0.70
Nodes (4): json(), onRequestDelete(), onRequestGet(), onRequestPost()

### Community 16 - "Community 16"
Cohesion: 0.80
Nodes (4): ensureTable(), json(), onRequestGet(), onRequestPost()

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): json(), onRequestGet(), onRequestPost()

## Knowledge Gaps
- **53 isolated node(s):** `SOCIAL_DEPENDENTS`, `memory`, `C`, `plugins`, `react/only-export-components` (+48 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 90 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 8` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Community 8` to `Community 2`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `normalizeInstagramHandle()` (e.g. with `fetchInstagramPosts()` and `fetchInstagramProfiles()`) actually correct?**
  _`normalizeInstagramHandle()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `SOCIAL_DEPENDENTS`, `memory`, `C` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1226215644820296 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11295681063122924 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08819345661450925 - nodes in this community are weakly interconnected._