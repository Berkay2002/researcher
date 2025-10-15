# Supporting Services & Utilities

The workflow relies on a small set of backend services to standardize external integrations and data shaping for the LangGraph nodes.

## Search Gateway

`search-gateway.ts` exposes a unified `searchAll` function that fans out discovery queries across Tavily and Exa, retries when domain filters eliminate all hits, and deduplicates results before returning them to the research subgraph.【F:src/server/shared/services/search-gateway.ts†L76-L175】 It also supports an enrichment mode that fetches full content for selected URLs by calling provider-specific extraction endpoints in parallel.【F:src/server/shared/services/search-gateway.ts†L178-L370】 Result objects are normalized into the shared `UnifiedSearchDoc` schema so downstream heuristics operate on consistent fields.【F:src/server/shared/services/search-gateway.ts†L203-L370】

## State Annotations & Reducers

The shared `ParentStateAnnotation` governs how nodes merge their outputs—appending arrays for cumulative data such as queries, evidence, and issues, while replacing atomic values like the active plan or draft. This consistent reducer strategy prevents race conditions across subgraphs and ensures checkpoints capture a full snapshot of the workflow.【F:src/server/workflows/researcher/graph/state.ts†L236-L296】

## Checkpointing Infrastructure

The parent graph wires a singleton `PostgresSaver` as its checkpointer, requiring a `DATABASE_URL` environment variable at runtime. This enables long-running threads, time travel, and recovery after HITL interrupts without recomputing earlier stages.【F:src/server/workflows/researcher/graph/index.ts†L24-L73】 Because the checkpointer is attached at compile time, every subgraph inherits the same persistence layer automatically.
