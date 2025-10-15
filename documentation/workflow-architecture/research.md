# Research Subgraph

The research subgraph implements a two-pass evidence gathering pipeline. It always executes the same five-node sequence—query planning, meta search, candidate assessment, enrichment, and deduplication—so the workflow progresses deterministically from queries to curated evidence.【F:src/server/workflows/researcher/graph/subgraphs/research/index.ts†L10-L41】

## Phase A – Query Planning

`queryPlan` expands the user's goal (and any plan constraints) into a diverse list of 5–10 search queries using an LLM. It stores the resulting query list both in `state.queries` and the research slice so later nodes can reuse the same prompts.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/query-plan.ts†L15-L49】 The helper function strips Markdown formatting, attempts strict JSON parsing, and falls back to heuristic extraction to guarantee progress even when the LLM deviates from the expected format.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/query-plan.ts†L52-L143】

## Phase A – Meta Search

`metaSearch` executes every planned query through the `searchAll` service, batching requests to respect Exa's five-requests-per-second rate limit. It merges Tavily and Exa results, deduplicates them by normalized URL, and records the discovery set in research state for downstream processing.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/meta-search.ts†L14-L110】 The search gateway fans out to both providers in parallel, retries without domain filters if necessary, and supports both discovery and enrichment modes via a shared interface.【F:src/server/shared/services/search-gateway.ts†L76-L198】

## Phase B – Candidate Assessment

`assessCandidates` applies rule-based scoring to the discovery documents. It normalizes provider scores, boosts authoritative or recent sources, caps the number of items per host, and produces both a ranked selection and a rationale string explaining the mix.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/assess-candidates.ts†L41-L99】 Supporting helpers implement the scoring, host capping, and rationale text, using configurable environment thresholds for domain diversity and recency.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/assess-candidates.ts†L101-L200】

## Phase C – Enrichment

`harvestSelected` looks up the URLs corresponding to the selected document IDs and calls the search gateway in enrichment mode to fetch full content. It deduplicates results by normalized URL and records the enriched corpus, including content length statistics for observability.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/harvest-selected.ts†L12-L74】 The gateway routes to provider-specific enrichment endpoints so both Tavily and Exa supply full-text payloads when available.【F:src/server/shared/services/search-gateway.ts†L178-L370】

## Phase D – Deduplication & Reranking

`dedupRerank` performs the final consolidation. It removes exact duplicates via content hashes, collapses canonical URLs, scores documents using recency and authority heuristics, limits the evidence set according to plan constraints, and converts the final documents into the legacy `evidence` format consumed by the writer.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/dedup-rerank.ts†L8-L138】 Helper routines handle canonical URL selection and evidence conversion, preserving chunked content hashes and citation metadata.【F:src/server/workflows/researcher/graph/subgraphs/research/nodes/dedup-rerank.ts†L141-L200】
