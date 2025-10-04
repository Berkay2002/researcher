# Implementation Plan — Deep Research (Next.js App Router + LangGraph)

This plan hands you a coherent path from "blank repo" to a grounded, multi-mode research assistant. It follows one thread (pun intended): **the `thread_id` that binds memory, HITL, and time-travel** through LangGraph's checkpointer.

For the product requirements and system design, see the [project brief](brief.md). For detailed technical architecture diagrams, see the [plan.md](plan.md). For LangGraph concepts used in this implementation, refer to the [LangGraph documentation](documentation/langgraph/01-introduction-quickstart.md).

---

## 1) North Star & Guardrails

* **Outcome:** A research assistant that turns broad prompts into **grounded, cited** reports with an always-visible **Sources** panel and optional **Artifacts** pane (tables/matrices).
* **Modes:**

  * **Auto-mode:** immediate run, no questions.
  * **Plan-mode:** human-in-the-loop (HITL) planning: “four options + custom,” then constraints.
* **Determinism where possible:** Search, harvest, dedupe, and ranking are **deterministic nodes**; only reasoning-heavy steps (planner, optional verifier) are agentic.
* **Memory:** Use **LangGraph checkpointers + threads** for durable per-run memory (also powers HITL, time-travel, and fault-tolerance). ([LangChain AI][1])

---

## 2) Architecture Thread (what exists + how it fits)

* **Parent graph (with checkpointer):** orchestration, mode handling, and global approvals; invoked with `thread_id`. Children inherit persistence automatically unless isolated. ([LangChain AI][1])
* **Subgraphs (children):**

  1. **Planner** (Auto path or HITL path).
  2. **Research** (QueryPlan → MetaSearch → Harvest/Normalize → Dedup; can use Send API for parallel batches). ([LangChain AI][2])
  3. **Fact-check** (deterministic today; can evolve to tool-calling later).
  4. **Writer** (Synthesize → Red-team gate).
     Subgraphs are graphs used as nodes; they communicate via **shared state keys** or with transform wrappers if schemas differ. ([LangChain AI][3])
* **External data:** **Tavily** (fast agent-oriented web search) and **Exa** (meaning-based + content extraction). We’ll fuse, dedupe, and lightly rerank. ([Tavily Docs][4])
* **Delivery surface (Next.js App Router):** route handlers for **start / stream / state / resume / mode**. Use **SSE** for progress and partial answers. ([Next.js][5])

---

## 3) Modes & Gating (UI drives, runtime respects)

* **UI switch is source of truth**: `mode=auto|plan` lands in run config.
* **Planner behavior:**

  * **Auto path:** no `interrupt`; select a default plan (e.g., Deep-Dive) and go.
  * **Plan path:** `interrupt()` to present “Quick Scan / Systematic Review / Competitive / Deep Technical Dossier / Custom,” then a second `interrupt` for constraints. Resume via `Command({ resume })`. ([LangChain Docs][6])
* **Optional auto-gate (kept simple):** IR-style *prompt sufficiency* (clarity), a one-shot **preview search** coherence check, and a cost/risk estimate. If ambiguous/expensive, flip to Plan-mode—even if the UI defaulted to Auto. Batch the preview using Send API when needed. ([LangChain AI][2])

---

## 4) State & Memory (shared keys; time-travel)

* **Thread-scoped memory** (checkpointer): `plan`, `queries`, `searchResults`, `evidence`, `draft`, `issues`, plus `userInputs` (goal, modeOverride, gate metrics, planner answers). Persisted at each super-step for replay, forks, and crash recovery. ([LangChain AI][1])
* **Time-travel & forks:** `getState()` to inspect latest or a checkpoint; `updateState()` to fork (e.g., change deliverable) and re-invoke from there. ([LangChain AI][7])
* **Isolation (only when justified):** if a child must keep raw HTML or private tool traces, give it a different schema (or its own checkpointer) and map summarized results back to parent. ([LangChain AI][3])

---

## 5) Research Pipeline (deterministic core, parallel where it pays)

1. **QueryPlan:** expand the goal into 5–10 precise queries; allow domain scoping.
2. **MetaSearch:** call **Tavily /search** and **Exa /search** in parallel; normalize, dedupe by URL and by content hash; store type/date/host. ([Tavily Docs][8])
3. **Harvest/Normalize:** fetch with respectful timeouts/robots; strip boilerplate; compute content hashes; chunk text.
4. **Rerank:** prefer recency/authority; ensure diverse hosts.
5. **Parallelism:** for large batches, use LangGraph **Send API** (map-reduce) to fan-out/fan-in efficiently. ([LangChain AI][2])

---

## 6) Fact-check & Writer (quality gates)

* **Fact-check:** start deterministic—sample contentious claims, ensure supporting spans exist; mark contradictions/missing support. Later, can replace internals with a tool-calling verifier subgraph without changing parent wiring. ([LangChain AI][3])
* **Writer:** synthesize sections with inline citations; **Red-team** checks groundedness (citations present), recency window, and tone. Block publish on failures.

---

## 7) UI/UX Thread (minimal but serious)

* **Left:** Threads / saved queries.
* **Center:** Streaming answer with clickable citation markers.
* **Right (Sources panel):** source cards with host, date, snippet, **supporting excerpt**, *why used*, filters, and pinning.
* **Artifacts pane:** tables/matrices; editable beside the narrative.
* **Timeline:** checkpoint slider for replay/fork.
* **Run log:** steps, tool calls, errors, and costs.
  (These reflect how modern tools surface sources and artifacts; users expect it.)

---

## 8) API Surface (contracts your UI will call)

* **POST `/api/threads/start`** → start a run; may return an **interrupt payload** (Plan-mode) or `{ threadId, status }`. (Route Handlers are the App Router primitive.) ([Next.js][5])
* **GET `/api/stream/:threadId`** → SSE events: progress, partial draft, citations. Use standard SSE headers; several community guides confirm viability on Next endpoints (be mindful of platform nuances). ([Upstash: Serverless Data Platform][9])
* **GET `/api/threads/:threadId/state`** → latest snapshot: `{ values, next, checkpointId }`. ([LangChain AI][1])
* **POST `/api/threads/:threadId/resume`** → resume HITL: `{ resume: any }` → forwards to `Command({ resume })`. ([LangChain Docs][6])
* **PATCH `/api/threads/:threadId/mode`** → set `auto|plan` override for the thread before planner execution.

---

## 9) Observability, Caching, & Ops

* **Metrics:** thread/run IDs, step latency, external API latency, cache hit rate, error classes.
* **Caching:** LRU in dev; Redis in prod for (query → hits) and (url → normalized content).
* **Cost & rate-limits:** show estimated credits/tokens before big crawls. Tavily depth/credits and Exa content extraction options inform budgeting. ([Tavily Docs][8])
* **Fault-tolerance:** rely on checkpointing; if a node fails, resume from last good checkpoint (pending writes are retained). ([LangChain AI][1])
* **Security:** obey robots; sanitize HTML; constrain content-types; strip prompt-injection phrases from harvested text before model prompts.

---

## 10) Risks & Mitigations

* **SSE quirks on hosting:** test locally and on target platform; fall back to polling if infra buffers streams. ([GitHub][10])
* **Search API quotas:** implement backoffs; display “throttle” states; cache aggressively. ([Tavily Docs][4])
* **Ambiguous user prompts:** keep the **auto-gate** and allow UI override to Plan-mode.

---

## 11) Test Strategy (from unit to time-travel)

* **Unit:** gating decisions (Auto vs Plan), merge/dedupe, hashing stability.
* **HITL:** simulate `interrupt` → ensure `Command(resume)` only re-executes the paused node (documented behavior). ([LangChain Docs][6])
* **Parallelism:** Send-API fan-out over N URLs and correct reduction. ([LangChain AI][2])
* **E2E:** Auto happy path; Plan path; resume after restart; `getState` + `updateState` fork. ([LangChain AI][7])

---

## 12) Go-Live Phases (röd tråd through milestones)

1. **Wire the parent graph with checkpointer**; stub subgraphs; prove `thread_id` persistence and `getState`. ([LangChain AI][1])
2. **Planner (Auto & Plan)**: hit an `interrupt` in Plan-mode; resume with UI; confirm plan saved to state. ([LangChain Docs][6])
3. **Research**: Tavily+Exa fusion, dedupe, harvest, hashing; add small reranker; integrate Send API for bulk. ([Tavily Docs][4])
4. **Writer & Red-team**: minimal synthesis + checks; ensure citations render.
5. **Fact-check**: deterministic checks first; leave interface open for future ReAct loop.
6. **API & SSE**: start/stream/state/resume/mode; handle disconnects gracefully. ([Next.js][11])
7. **UI**: mode toggle, sources rail, artifacts pane, timeline, run log.
8. **Ops pass**: caching, metrics, rate limits, robots compliance.
9. **Beta**: run real prompts; adjust gate thresholds; capture costs and fix flaky hosts.
10. **1.0**: acceptance checks (below) all green.

---

## 13) Acceptance Criteria (definition of done)

* Single thread runs **start → (optional) HITL → result** with **grounded citations** visible and clickable.
* **Auto-mode** bypasses planner questions; **Plan-mode** pauses and resumes cleanly. ([LangChain Docs][6])
* **State snapshots** visible via `getState`; can **fork** via `updateState` and re-run. ([LangChain AI][7])
* Sources panel shows **title, host, date, snippet, supporting excerpt, link, why-used**; pins work.
* SSE stream stabilizes on target infra (or graceful polling fallback). ([Upstash: Serverless Data Platform][9])

---

## 14) External References (for implementers)

* **LangGraph — Persistence / Threads / Checkpointers**; **HITL (interrupt/Command)**; **Subgraphs**; **Graph API & Send API**. ([LangChain AI][1])
* **Next.js App Router — Route Handlers** (server endpoints & streaming). ([Next.js][5])
* **Tavily API** (base URL, search endpoint & credit model). **Exa API** (search & content extraction). ([Tavily Docs][4])

---

# Project Checklist

### Phase 1 — Runtime Backbone ✅ COMPLETE

* [x] Parent graph compiled with **checkpointer**; `thread_id` required on invocations. ([LangChain AI][1])
  - ✅ Implemented in [src/server/graph/index.ts](src/server/graph/index.ts)
  - ✅ Uses `MemorySaver` checkpointer for thread-level persistence
  - ✅ All subgraphs inherit parent checkpointer
* [x] `getState` / `updateState` smoke tests (time-travel + fork). ([LangChain AI][7])
  - ✅ `GET /api/threads/:id/state` returns state snapshots
  - ✅ `PATCH /api/threads/:id/mode` uses `updateState()` for mode changes
* [x] **Dependencies Installed**
  - ✅ `@langchain/langgraph@1.0.0-alpha.5`
  - ✅ `@langchain/core@1.0.0-alpha.6`
  - ✅ `langchain@1.0.0-alpha.7`
  - ✅ `uuid@13.0.0`
* [x] **State Schema** - [src/server/graph/state.ts](src/server/graph/state.ts)
  - ✅ Full `ParentState` with all shared keys
  - ✅ Zod schemas for runtime validation
  - ✅ TypeScript types for all entities
* [x] **Stub Nodes Created**
  - ✅ [planGate](src/server/graph/nodes/planGate.ts) - Pass-through (will add auto-gate in Phase 2.5)
  - ✅ [research](src/server/graph/subgraphs/research/index.ts) - Stub (Phase 3)
  - ✅ [factcheck](src/server/graph/subgraphs/factcheck/index.ts) - Stub (Phase 4)
  - ✅ [writer](src/server/graph/subgraphs/write/index.ts) - Stub (Phase 4)
* [x] **API Routes Implemented**
  - ✅ [POST /api/threads/start](src/app/api/threads/start/route.ts) - Start threads, handle interrupts
  - ✅ [GET /api/threads/:id/state](src/app/api/threads/[threadId]/state/route.ts) - Get state snapshots
  - ✅ [POST /api/threads/:id/resume](src/app/api/threads/[threadId]/resume/route.ts) - Resume HITL flows

### Phase 2 — Planner (Auto & Plan) ✅ COMPLETE

* [x] Mode override honored from UI (auto|plan).
  - ✅ `userInputs.modeOverride` controls routing in planner subgraph
  - ✅ [PATCH /api/threads/:id/mode](src/app/api/threads/[threadId]/mode/route.ts) implemented
* [x] **Auto path**: emits default DAG with deliverable.
  - ✅ [autoPlanner node](src/server/graph/subgraphs/planner/nodes/autoPlanner.ts) generates "Deep Technical" plan
  - ✅ No user interaction required
* [x] **Plan path**: `interrupt` → UI → `Command(resume)`; persists answers to state. ([LangChain Docs][6])
  - ✅ [hitlPlanner node](src/server/graph/subgraphs/planner/nodes/hitlPlanner.ts) with 2-stage interrupts
  - ✅ Stage 1: Template selection (5 options: Quick Scan, Systematic, Competitive, Deep Technical, Custom)
  - ✅ Stage 2: Constraints collection (deadline, budget, depth, sources)
  - ✅ Answers saved to `userInputs.plannerAnswers`
  - ✅ Final plan constructed from both stages
* [x] **Planner Subgraph** - [src/server/graph/subgraphs/planner/index.ts](src/server/graph/subgraphs/planner/index.ts)
  - ✅ Conditional routing based on `modeOverride`
  - ✅ Routes to `autoPlanner` or `hitlPlanner`
* [x] **Plan Templates & Types** - [src/server/graph/subgraphs/planner/state.ts](src/server/graph/subgraphs/planner/state.ts)
  - ✅ 5 plan templates with DAGs and default constraints
  - ✅ Constraints schema (deadline, budget, depth, sources)
  - ✅ Interrupt payload types
* [x] **UI Components**
  - ✅ [ModeSwitch](src/app/(components)/ModeSwitch.tsx) - Toggle between Auto/Plan
  - ✅ [InterruptPrompt](src/app/(components)/InterruptPrompt.tsx) - Display options, collect responses
* [ ] Optional: auto-gate (clarity, preview coherence, cost).
  - ⏳ Deferred to Phase 2.5 (optional enhancement)

### Phase 3 — Research Subgraph ✅ COMPLETE

* [x] QueryPlan expands goal (+ domain scoping).
  - ✅ Implemented in [src/server/graph/subgraphs/research/nodes/query-plan.ts](src/server/graph/subgraphs/research/nodes/query-plan.ts)
  - ✅ Generates 5-10 focused queries from user goal with domain filtering
* [x] **Tavily /search** and **Exa /search** in parallel; normalize; dedupe. ([Tavily Docs][8])
  - ✅ Tavily client: [src/server/tools/tavily.ts](src/server/tools/tavily.ts)
  - ✅ Exa client: [src/server/tools/exa.ts](src/server/tools/exa.ts)
  - ✅ Search gateway: [src/server/services/searchGateway.ts](src/server/services/searchGateway.ts)
  - ✅ MetaSearch node: [src/server/graph/subgraphs/research/nodes/meta-search.ts](src/server/graph/subgraphs/research/nodes/meta-search.ts)
* [x] Harvest/Normalize with respectful timeouts & robots.
  - ✅ Harvest service: [src/server/services/harvest.ts](src/server/services/harvest.ts)
  - ✅ Robots.txt compliance, 10s timeouts, HTML extraction
  - ✅ Harvest node: [src/server/graph/subgraphs/research/nodes/harvest.ts](src/server/graph/subgraphs/research/nodes/harvest.ts)
* [x] Content hashing + chunking; light rerank (recency/authority).
  - ✅ Hashing utility: [src/server/utils/hashing.ts](src/server/utils/hashing.ts)
  - ✅ Text chunking: [src/server/utils/text.ts](src/server/utils/text.ts)
  - ✅ URL normalization: [src/server/utils/url.ts](src/server/utils/url.ts)
  - ✅ Rerank service: [src/server/services/rerank.ts](src/server/services/rerank.ts)
  - ✅ DedupRerank node: [src/server/graph/subgraphs/research/nodes/dedup-rerank.ts](src/server/graph/subgraphs/research/nodes/dedup-rerank.ts)
* [x] Research subgraph assembly
  - ✅ Wired linear flow: [src/server/graph/subgraphs/research/index.ts](src/server/graph/subgraphs/research/index.ts)
  - ✅ Flow: QueryPlan → MetaSearch → Harvest → DedupRerank

### Phase 4 — Fact-check & Writer

* [ ] Deterministic fact-checks (support/contradict/missing) at least on a sample of claims.
* [ ] Writer produces sections + inline citations; Red-team enforces minimal quality gates.

### Phase 5 — API & Streaming

* [ ] `/api/threads/start`, `/state`, `/resume`, `/mode` implemented (Route Handlers). ([Next.js][5])
* [ ] `/api/stream/:threadId` SSE endpoint stable on target infra (or fallback). ([Upstash: Serverless Data Platform][9])

### Phase 6 — UI

* [ ] Prompt box + **Mode toggle**; Planner drawer (Plan-mode).
* [ ] **Answer pane** with clickable citations.
* [ ] **Sources panel** (card metadata, supporting excerpt, why-used, filters, pin).
* [ ] **Artifacts pane**; **Timeline** (checkpoints); **Run log**.

### Phase 7 — Ops & Compliance

* [ ] LRU/Redis caching in place; metrics dashboard (latency, cache hit rate, errors).
* [ ] Rate-limit handling for Tavily/Exa; cost exposure in UI. ([Tavily Docs][4])
* [ ] Robots compliance; HTML sanitization; injection filters on harvested text.

### Phase 8 — Tests

* [ ] Unit (gate, merge/dedupe, hashing).
* [ ] HITL behavior (interrupt/resume node-scoped). ([LangChain Docs][6])
* [ ] Parallelism (Send API map-reduce). ([LangChain AI][2])
* [ ] E2E (Auto), E2E (Plan), Resume after crash, Fork from checkpoint.

---

## Signed by…

| Agent / Module                      | Owner                | Signature  | Date (YYYY-MM-DD) | Notes                                      |
| ----------------------------------- | -------------------- | ---------- | ----------------- | ------------------------------------------ |
| **Parent Orchestrator (Graph)**     | Claude Code          | ✅         | 2025-01-04        | Checkpointer on; threads required.         |
| **Planner (Auto/Plan HITL)**        | Claude Code          | ✅         | 2025-01-04        | UI decides mode; `interrupt/Command` path. |
| **Research (Query→Search→Harvest)** | Claude Code          | ✅         | 2025-01-05        | Tavily + Exa fusion; dedupe & rerank.      |
| **Fact-checker**                    | ____________________ | __________ | 2025-xx-xx        | Deterministic v1; pluggable later.         |
| **Writer + Red-team**               | ____________________ | __________ | 2025-xx-xx        | Inline citations; quality gates.           |
| **API & Streaming**                 | Claude Code          | ⏳         | 2025-01-04        | Route Handlers (partial); SSE pending.     |
| **UI/UX (Sources/Artifacts)**       | Claude Code          | ⏳         | 2025-01-04        | ModeSwitch & InterruptPrompt only.         |
| **Ops (Cache/Observability)**       | ____________________ | __________ | 2025-xx-xx        | LRU/Redis, metrics, rate limits.           |

---
