# Implementation Plan — Deep Research (Next.js App Router + LangGraph)

This plan hands you a coherent path from "blank repo" to a grounded, multi-mode research assistant. It follows one thread (pun intended): **the `thread_id` that binds memory, HITL, and time-travel** through LangGraph's checkpointer.

For the product requirements and system design, see the [project brief](brief.md). For detailed technical architecture diagrams, see the [plan.md](plan.md). For LangGraph concepts used in this implementation, refer to the [LangGraph documentation](documentation/langgraph/01-introduction-quickstart.md).

---

## 1) North Star & Guardrails

* **Outcome:** A research assistant that turns broad prompts into **grounded, cited** reports with an always-visible **Sources** panel and optional **Artifacts** pane (tables/matrices).
* **Modes:**

  * **Auto-mode:** immediate run, no questions.
  * **Plan-mode:** human-in-the-loop (HITL) planning with dynamic multi-question flow. LLM analyzes prompt completeness, generates 1-4 contextual questions with 4 options + "Custom" each, and iteratively collects answers.
* **Determinism where possible:** Search, harvest, dedupe, and ranking are **deterministic nodes**; only reasoning-heavy steps (planner, optional verifier) are agentic.
* **Memory:** Use **LangGraph checkpointers + threads** for durable per-run memory (also powers HITL, time-travel, and fault-tolerance). ([LangChain AI][1])

---

## 2) Architecture Thread (what exists + how it fits)

* **Parent graph (with checkpointer):** orchestration, mode handling, and global approvals; invoked with `thread_id`. Subgraphs use `ParentStateAnnotation` to inherit state schema and reducers automatically (alpha-1.0 pattern). ([LangChain AI][1])
* **Subgraphs (children):**

  1. **Planner** (Auto path or HITL path).
  2. **Research** (QueryPlan → MetaSearch → Harvest/Normalize → Dedup; can use Send API for parallel batches). ([LangChain AI][2])
  3. **Fact-check** (deterministic today; can evolve to tool-calling later).
  4. **Writer** (Synthesize → Red-team gate).
     Subgraphs are created with `StateGraph(ParentStateAnnotation)` pattern; they inherit parent state and checkpointer automatically (alpha-1.0). ([LangChain AI][3])
* **Orchestration Gates:** Three parent-graph nodes for control flow and quality assurance:
  - **plan-gate** - Decides Auto vs Plan mode based on UI override and cheap signals
  - **approvals** - Pre-action HITL gate for expensive/risky operations
  - **publish-gate** - Pre-publish quality gate with deterministic checks and optional HITL
* **External data:** **Tavily** (fast agent-oriented web search) and **Exa** (meaning-based + content extraction). We’ll fuse, dedupe, and lightly rerank. ([Tavily Docs][4])
* **Delivery surface (Next.js App Router):** route handlers for **start / stream / state / resume / mode**. Use **SSE** for progress and partial answers. ([Next.js][5])

---

## 3) Modes & Gating (UI drives, runtime respects)

* **UI switch is source of truth**: `mode=auto|plan` lands in run config.
* **Plan-gate (mode decider):** Evaluates UI override and cheap signals to choose Auto vs Plan mode
  * **UI override wins:** If `modeOverride` is set, it's respected directly
  * **Signal-based gating:** Computes clarity (IR-style), preview coherence, and cost estimates
  * **Threshold policy:** Auto if clarity ≥ τ₁ AND coherence ≥ τ₂ AND cost ≤ budget; else Plan
  * **Error handling:** Defaults to Plan-mode on failures for safety
* **Planner behavior:**

  * **Auto path:** no `interrupt`; select a default plan (e.g., Deep-Dive) and go.
  * **Plan path:** `interrupt()` iteratively to present dynamic clarifying questions (1-4 questions total) based on prompt analysis. Each question has LLM-generated contextual options (4 + "Custom"), with "All of the above" included where appropriate. Resume via `Command({ resume })` after each answer until all questions are answered. ([LangChain Docs][6])
* **Approvals gate (pre-action HITL):** Pauses before expensive/risky operations
  * **Triggers:** High cost/latency, new domains, sensitive topics, paywalls, rate limits
  * **Interrupt payload:** Summary with step details, estimates, domains, and risks
  * **Resume options:** approve, edit (constraints), or cancel
  * **Decision record:** Timestamp, signer, policy snapshot persisted to state
* **Publish-gate (pre-publish quality):** Final validation before export/publish
  * **Deterministic checks:** Citations present, recency window, section completeness, red-team clean
  * **Conditional HITL:** Only interrupts if checks fail or policy requires manual review
  * **Resume options:** approve, fix_auto, edit_then_retry, or reject
  * **Audit trail:** Full checkpoint history for time-travel and compliance
* **HITL mechanics:** Gates use `interrupt()` + `Command(resume)` pattern with thread-level checkpointing
  * Node re-executes from start on resume with provided resume value
  * Multiple interrupts can be resumed in one shot with interruptId → value mapping
  * All state changes persisted via checkpointer for fault tolerance

---

## 4) State & Memory (Annotation.Root with reducers; time-travel)

* **Thread-scoped memory** (checkpointer): State defined with `Annotation.Root()` containing `threadId`, `userInputs`, `plan`, `queries`, `searchResults`, `evidence`, `draft`, `issues`. Each field has explicit reducers for state merging. Persisted at each super-step for replay, forks, and crash recovery. ([LangChain AI][1])
* **Gate state extensions:** Additional fields for orchestration gates:
  - `userInputs.gate` - Plan-gate decision metrics (clarity, coherence, cost, auto)
  - `userInputs.modeFinal` - Final mode decision after plan-gate processing
  - `userInputs.approvals[]` - Approval records with timestamps, signers, and policy snapshots
  - `userInputs.publish` - Publish gate metadata and approval status
* **Time-travel & forks:** `getState()` to inspect latest or a checkpoint; `updateState()` to fork (e.g., change deliverable) and re-invoke from there. ([LangChain AI][7])
* **Subgraph state inheritance:** Subgraphs use `StateGraph(ParentStateAnnotation)` to automatically inherit schema and reducers. No manual state mapping needed (alpha-1.0 pattern). ([LangChain AI][3])

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
* **Gate testing:** plan-gate threshold logic, approvals trigger conditions, publish-gate deterministic checks.
* **HITL:** simulate `interrupt` → ensure `Command(resume)` only re-executes the paused node (documented behavior). ([LangChain Docs][6])
* **Gate HITL behavior:** Interrupt payload generation, resume value handling, decision record persistence.
* **Parallelism:** Send-API fan-out over N URLs and correct reduction. ([LangChain AI][2])
* **E2E:** Auto happy path; Plan path; resume after restart; `getState` + `updateState` fork. ([LangChain AI][7])
* **Gate integration:** Full flow with all gates; error handling and fallback modes; time-travel through gate decisions.

---

## 12) Go-Live Phases (röd tråd through milestones)

1. **Wire the parent graph with checkpointer**; stub subgraphs; prove `thread_id` persistence and `getState`. ([LangChain AI][1])
2. **Planner (Auto & Plan)**: hit an `interrupt` in Plan-mode; resume with UI; confirm plan saved to state. ([LangChain Docs][6])
3. **Orchestration Gates**: implement plan-gate, approvals, and publish-gate with full HITL semantics.
4. **Research**: Tavily+Exa fusion, dedupe, harvest, hashing; add small reranker; integrate Send API for bulk. ([Tavily Docs][4])
5. **Writer & Red-team**: minimal synthesis + checks; ensure citations render.
6. **Fact-check**: deterministic checks first; leave interface open for future ReAct loop.
7. **API & SSE**: start/stream/state/resume/mode; handle disconnects gracefully. ([Next.js][11])
8. **UI**: mode toggle, sources rail, artifacts pane, timeline, run log.
9. **Ops pass**: caching, metrics, rate limits, robots compliance.
10. **Beta**: run real prompts; adjust gate thresholds; capture costs and fix flaky hosts.
11. **1.0**: acceptance checks (below) all green.

---

## 13) Acceptance Criteria (definition of done)

* Single thread runs **start → (optional) HITL → result** with **grounded citations** visible and clickable.
* **Auto-mode** bypasses planner questions; **Plan-mode** pauses and resumes cleanly. ([LangChain Docs][6])
* **State snapshots** visible via `getState`; can **fork** via `updateState` and re-run. ([LangChain AI][7])
* Sources panel shows **title, host, date, snippet, supporting excerpt, link, why-used**; pins work.
* SSE stream stabilizes on target infra (or graceful polling fallback). ([Upstash: Serverless Data Platform][9])
* **Gate-specific acceptance checks:**
  * **plan-gate**: UI override respected; signal-based decisions follow thresholds; defaults to Plan on errors
  * **approvals**: Triggers on cost/risk thresholds; interrupt payload shows summary; resume with approve/edit/cancel works
  * **publish-gate**: Deterministic checks run first; conditional HITL works; approval metadata stamped correctly
  * **HITL behavior**: All interrupt/resume operations work with thread-level checkpointing; state persists across pauses
  * **Time-travel**: Can retrieve any checkpoint and fork from any gate decision point

---

## 14) External References (for implementers)

* **LangGraph — Persistence / Threads / Checkpointers**; **HITL (interrupt/Command)**; **Subgraphs**; **Graph API & Send API**. ([LangChain AI][1])
* **Gate Implementation Details** — Complete specifications for plan-gate, approvals, and publish-gate with state schemas, decision rules, and HITL patterns. ([implementation-for-gates.md](implementation-for-gates.md))
* **Next.js App Router — Route Handlers** (server endpoints & streaming). ([Next.js][5])
* **Tavily API** (base URL, search endpoint & credit model). **Exa API** (search & content extraction). ([Tavily Docs][4])

---

# Project Checklist

### Phase 1 — Runtime Backbone ✅ COMPLETE

* [x] Parent graph compiled with **checkpointer**; `thread_id` required on invocations. ([LangChain AI][1])
  - ✅ Implemented in [src/server/graph/index.ts](src/server/graph/index.ts)
  - ✅ **Updated to use `PostgresSaver` checkpointer for persistent thread-level storage**
  - ✅ **Neon database integration with full schema bootstrapping**
  - ✅ All subgraphs inherit parent checkpointer
  - ✅ **Plan mode interrupts now persist across server restarts**
* [x] `getState` / `updateState` smoke tests (time-travel + fork). ([LangChain AI][7])
  - ✅ `GET /api/threads/:id/state` returns state snapshots
  - ✅ `PATCH /api/threads/:id/mode` uses `updateState()` for mode changes
* [x] **Dependencies Installed**
  - ✅ `@langchain/langgraph@1.0.0-alpha.5`
  - ✅ `@langchain/core@1.0.0-alpha.6`
  - ✅ `langchain@1.0.0-alpha.7`
  - ✅ `@langchain/langgraph-checkpoint-postgres@0.1.2`
  - ✅ `uuid@13.0.0`
* [x] **State Schema** - [src/server/graph/state.ts](src/server/graph/state.ts)
  - ✅ `ParentStateAnnotation` defined with `Annotation.Root()` (alpha-1.0 pattern)
  - ✅ All state fields have explicit reducers for merging behavior
  - ✅ Zod schemas for runtime validation
  - ✅ TypeScript types inferred from Zod schemas
* [x] **Stub Nodes Created**
  - ✅ [planGate](src/server/graph/nodes/planGate.ts) - Pass-through (will add auto-gate in Phase 2.5)
  - ✅ [research](src/server/graph/subgraphs/research/index.ts) - Stub (Phase 3)
  - ✅ [factcheck](src/server/graph/subgraphs/factcheck/index.ts) - Stub (Phase 4)
  - ✅ [writer](src/server/graph/subgraphs/write/index.ts) - Stub (Phase 4)
* [x] **Neon Postgres Persistence Implementation**
  - ✅ **Database setup script**: [scripts/setup-persistence.ts](scripts/setup-persistence.ts) with schema bootstrapping
  - ✅ **Graph factory updated**: [src/server/graph/index.ts](src/server/graph/index.ts) uses `PostgresSaver` instead of `MemorySaver`
  - ✅ **Connection singleton**: Cached Postgres connection for performance
  - ✅ **Environment configuration**: `DATABASE_URL` with SSL-enabled Neon connection
  - ✅ **Plan mode persistence tested**: Interrupts survive server restarts and persist across API calls
* [x] **API Routes Implemented**
  - ✅ [POST /api/threads/start](src/app/api/threads/start/route.ts) - Start threads, handle interrupts
  - ✅ [GET /api/threads/:id/state](src/app/api/threads/[threadId]/state/route.ts) - Get state snapshots
  - ✅ [POST /api/threads/:id/resume](src/app/api/threads/[threadId]/resume/route.ts) - Resume HITL flows

### Phase 2 — Planner (Auto & Plan) ✅ COMPLETE

* [x] Mode override honored from UI (auto|plan).
  - ✅ `userInputs.modeOverride` controls routing in planner subgraph
  - ✅ [PATCH /api/threads/:id/mode](src/app/api/threads/[threadId]/mode/route.ts) implemented
* [x] **Auto path**: emits default DAG with deliverable.
  - ✅ [auto-planner node](src/server/graph/subgraphs/planner/nodes/auto-planner.ts) generates "Deep Technical" plan
  - ✅ No user interaction required
* [x] **Plan path**: `interrupt` → UI → `Command(resume)`; persists answers to state. ([LangChain Docs][6])
  - ✅ [hitl-planner node](src/server/graph/subgraphs/planner/nodes/hitl-planner.ts) with dynamic multi-question interrupts
  - ✅ Analyzes prompt for missing aspects (scope, timeframe, depth, use case) via [prompt-analyzer.system.md](src/server/configs/prompts/prompt-analyzer.system.md)
  - ✅ Generates 1-4 contextual questions with LLM-generated options via [question-generator.system.md](src/server/configs/prompts/question-generator.system.md)
  - ✅ Each question has 4 contextual options + "Custom" (5 total)
  - ✅ "All of the above" included where appropriate per question type (e.g., scope questions)
  - ✅ Iterative interrupt/resume cycles (one question at a time) until all answered
  - ✅ Answers saved to `userInputs.plannerAnswers` as QuestionAnswer[] array
  - ✅ Final plan constructed from all collected answers via [plan-constructor.system.md](src/server/configs/prompts/plan-constructor.system.md)
* [x] **Planner Subgraph** - [src/server/graph/subgraphs/planner/index.ts](src/server/graph/subgraphs/planner/index.ts)
  - ✅ Conditional routing based on `modeOverride`
  - ✅ Routes to `auto-planner` or `hitl-planner`
* [x] **Planner State & Types** - [src/server/graph/subgraphs/planner/state.ts](src/server/graph/subgraphs/planner/state.ts)
  - ✅ PromptAnalysis schema (isComplete, missingAspects, suggestedQuestions)
  - ✅ Question schema with dynamic options (value, label, description)
  - ✅ InterruptPayload schema for question interrupts
  - ✅ QuestionAnswer schema for collected responses
* [x] **UI Components**
  - ✅ [ModeSwitch](src/app/(components)/ModeSwitch.tsx) - Toggle between Auto/Plan
  - ✅ [InterruptPrompt](src/app/(components)/InterruptPrompt.tsx) - Display options, collect responses

### Phase 2.5 — Orchestration Gates ✅ COMPLETE

* [x] **plan-gate.ts** - Planner Mode Decider (Auto ↔ Plan)
  - ✅ Evaluates UI override first, then computes gating signals
  - ✅ Clarity scoring (IR-style heuristic) for longer, time-scoped prompts
  - ✅ Preview coherence check using single Tavily + Exa search
  - ✅ Cost guard with coarse token/time estimates → USD conversion
  - ✅ Threshold policy: τ₁ (clarity) and τ₂ (coherence) parameters
  - ✅ Writes `{gate: {clarity, coherence, usd, auto}, modeFinal}` to state
  - ✅ Defaults to Plan-mode on errors for safety
  - ✅ Implemented in [src/server/graph/nodes/plan-gate.ts](src/server/graph/nodes/plan-gate.ts)
* [x] **approvals.ts** - Pre-Action Approval Gate (before expensive/risky steps)
  - ✅ Triggers on cost/latency thresholds, new domains, sensitive verticals
  - ✅ Paywall detection and robots.txt risk assessment
  - ✅ Uses `interrupt()` with comprehensive summary payload
  - ✅ Resume via `Command(resume)` with approve/edit/cancel options
  - ✅ Merges edits into plan.constraints and persists decision records
  - ✅ Supports multiple parallel interrupts with interruptId → value mapping
  - ✅ Implemented in [src/server/graph/nodes/approvals.ts](src/server/graph/nodes/approvals.ts)
* [x] **publish-gate.ts** - Pre-Publish Release Gate (after red-team, before export)
  - ✅ Runs deterministic checks first: citations, recency, completeness, red-team clean
  - ✅ Skips HITL if all checks pass and policy allows auto-publish
  - ✅ Interrupt payload with summary, preview, sources sample
  - ✅ Resume options: approve, fix_auto, edit_then_retry, reject
  - ✅ Stamps approval metadata and routes back appropriately
  - ✅ Full audit trail with checkpoint history for compliance
  - ✅ Implemented in [src/server/graph/nodes/publish-gate.ts](src/server/graph/nodes/publish-gate.ts)
* [x] **Gate Integration** - Parent graph wiring with LangGraph v1-alpha patterns
  - ✅ Updated flow: START → plan-gate → planner → approvals → research → factcheck → writer → publish-gate → END
  - ✅ All gates use `interrupt()` + `Command(resume)` with thread-level checkpointing
  - ✅ Subgraphs inherit updated state automatically (alpha-1.0 pattern)
  - ✅ Time-travel and fork support via `getState()` and `updateState()`
  - ✅ Error handling with graceful fallbacks to safe modes
* [x] **State Schema Updates** - Extended for gate operations
  - ✅ Added `userInputs.gate`, `userInputs.modeFinal`, `userInputs.approvals[]`, `userInputs.publish`
  - ✅ Updated [src/server/graph/state.ts](src/server/graph/state.ts) with explicit reducers
  - ✅ Zod schemas for runtime validation of gate payloads

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
  - ✅ Uses `StateGraph(ParentStateAnnotation)` for automatic state inheritance (alpha-1.0 pattern)

### Phase 4 — Fact-check & Writer ✅ COMPLETE

* [x] Deterministic fact-checks (support/contradict/missing) at least on a sample of claims.
  - ✅ Implemented in [src/server/graph/subgraphs/factcheck/nodes/factcheck.ts](src/server/graph/subgraphs/factcheck/nodes/factcheck.ts)
  - ✅ Validates citations against evidence, checks claim patterns, enforces thresholds
* [x] Writer produces sections + inline citations; Red-team enforces minimal quality gates.
  - ✅ Synthesize node: [src/server/graph/subgraphs/write/nodes/synthesize.ts](src/server/graph/subgraphs/write/nodes/synthesize.ts)
  - ✅ Red-team node: [src/server/graph/subgraphs/write/nodes/redteam.ts](src/server/graph/subgraphs/write/nodes/redteam.ts)
  - ✅ Multi-node flow: START → synthesize → redteam → END

### Phase 5 — API & Streaming ✅ COMPLETE

* [x] `/api/threads/start`, `/state`, `/resume`, `/mode` implemented (Route Handlers). ([Next.js][5])
  - ✅ All route handlers implemented in Phase 1 & 2
  - ✅ Full interrupt/resume flow with Command pattern
  - ✅ State snapshots for time-travel
  - ✅ Mode switching with updateState()
* [x] `/api/stream/:threadId` SSE endpoint stable on target infra (or fallback). ([Upstash: Serverless Data Platform][9])
  - ✅ Implemented in [src/app/api/stream/[threadId]/route.ts](src/app/api/stream/[threadId]/route.ts)
  - ✅ Multi-mode streaming: `["updates", "messages", "custom"]`
  - ✅ Event types: node, draft, evidence, queries, citations, issues, llm_token, custom, error, done, keepalive
  - ✅ Proper SSE headers with keep-alive and timeout protection
  - ✅ Error handling with graceful stream termination (404, 500)
  - ✅ Node.js runtime enforcement
  - ✅ Type-safe implementation (no `any` types)
  - ✅ Passes Ultracite linting checks

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
| **Parent Orchestrator (Graph)**     | Claude Code          | ✅         | 2025-01-06        | Alpha-1.0: `Annotation.Root()` pattern; **Neon Postgres persistence implemented**.    |
| **Planner (Auto/Plan HITL)**        | Claude Code          | ✅         | 2025-01-05        | Alpha-1.0: `StateGraph(ParentStateAnnotation)`; LangGraph 1.0-alpha interrupt() primitive; kebab-case filenames. |
| **Orchestration Gates**             | Claude Code          | ✅         | 2025-01-05        | plan-gate, approvals, publish-gate with full HITL semantics; interrupt() + Command(resume) pattern. |
| **Research (Query→Search→Harvest)** | Claude Code          | ✅         | 2025-01-05        | Alpha-1.0 compliant; Tavily + Exa fusion.  |
| **Fact-checker**                    | Claude Code          | ✅         | 2025-01-05        | Deterministic validation; evidence verification. |
| **Writer + Red-team**               | Claude Code          | ✅         | 2025-01-05        | GPT-4o-mini synthesis; quality gates implemented. |
| **API & Streaming**                 | Claude Code          | ✅         | 2025-01-05        | All route handlers complete; SSE multi-mode streaming with type safety. |
| **UI/UX (Sources/Artifacts)**       | Claude Code          | ⏳         | 2025-01-04        | ModeSwitch & InterruptPrompt only.         |
| **Ops (Cache/Observability)**       | ____________________ | __________ | 2025-xx-xx        | LRU/Redis, metrics, rate limits.           |

---
