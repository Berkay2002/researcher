## 1) Product intent (what we're building)

This document outlines the product requirements and system design for the research assistant. For detailed technical implementation, see the [implementation plan](plan.md). For LangGraph concepts used in this implementation, refer to the [LangGraph documentation](documentation/langgraph/01-introduction-quickstart.md).

* A **research assistant** that accepts broad prompts (e.g., “Give me an in-depth analysis of the American stock market”) and returns a **grounded report** with **inline citations** and a **sources panel**.
* Two operation modes:

  * **Auto-mode**: no questions; immediately runs the plan.
  * **Plan-mode**: human-in-the-loop (HITL) planning with dynamic clarifying questions. The planner analyzes the prompt, generates 1-4 specific questions with LLM-generated contextual answer options (4 options + "Custom" per question), and iteratively collects answers to build a tailored research plan.
* Deterministic plumbing (search/harvest/dedupe) is **not** a chatty agent; reasoning-heavy bits (planning, optional verification) are the only “agentic” parts.
* **Memory** across steps and resumability via LangGraph **checkpointers** and **threads**—this powers HITL, time-travel, and fault-tolerance. See [Persistence documentation](documentation/langgraph/05-persistence.md) for implementation details. ([LangChain AI][1])

---

## 2) System overview (mental model)

**Core runtime (LangGraph alpha-1.0)**

* **Parent graph** (compiled with a **checkpointer**, always invoked with a `thread_id`) orchestrates the run. Subgraphs use `ParentStateAnnotation` to inherit state schema and reducers from the parent automatically. ([LangChain AI][1])
* **Subgraphs**:

  1. **Planner** (Auto or Plan HITL via `interrupt`)
  2. **Research** (QueryPlan → MetaSearch → Harvest/Normalize → Dedup)
  3. **Fact-check** (deterministic today; can evolve into a tool-calling verifier)
  4. **Writer** (Synthesize → Red-team gate)
     Subgraphs are created with `StateGraph(ParentStateAnnotation)` pattern; they inherit parent state and checkpointer automatically. See [Multi-agent systems](documentation/langgraph/11-multi-agent-systems.md) for more details. ([LangChain AI][2])
* **Parallelization** inside Research uses the **Send API / map-reduce** style for fan-out/fan-in when fetching/processing many URLs. ([LangChain AI][3])

**App surface (Next.js App Router)**

* **Route Handlers** under `app/api/*` for: start, stream, state, resume, mode. App Router route handlers are the correct primitive for server logic & streaming. ([Next.js][4])
* **SSE stream** from the server to the UI uses `streamMode` parameter: `"updates"` (agent progress), `"messages"` (LLM tokens), or `"custom"` (user-defined). See [Streaming documentation](documentation/langgraph/09-streaming.md). ([Next.js][4])

**External data**

* **Search providers:** Tavily and Exa; fuse results, dedupe by URL + content hash, light rerank (recency/authority). Tavily & Exa have straightforward **/search** APIs and content retrieval options. ([Tavily Docs][5])

---

## 3) Modes: Auto vs Plan (UI-controlled)

* **UI owns the switch**. The UI sets `mode=auto|plan` in the run config. The graph respects the flag **before** entering Planner.
* **Auto-mode**: Planner runs in **auto path** (no interrupts), chooses a sensible default plan (e.g., deep-dive with fact-check + writer), then continues.
* **Plan-mode**: Planner runs **HITL via `interrupt`**, analyzing the prompt for completeness and generating 1-4 dynamic clarifying questions based on missing aspects (scope, timeframe, depth, use case). Each question has 4 contextual, LLM-generated answer options plus "Custom", with "All of the above" included where appropriate (e.g., scope questions). Questions are presented iteratively via interrupt/resume cycles until all are answered, then the final plan is constructed.
  `interrupt` pauses at a checkpoint; resuming uses **Command(resume=payload)**. This is the current, documented LangGraph HITL pattern. See [Human-in-the-loop documentation](documentation/langgraph/07-human-in-the-loop.md) for implementation details. ([LangChain Docs][6])
* Optional **auto-gate** (kept even when UI defaults to Auto): use cheap signals (prompt clarity, a 1-shot search preview, cost/risk heuristics) to **flip to Plan-mode** if the prompt is ambiguous or expensive. For parallel preview probes, use **Send API**. ([LangChain AI][3])

---

## 4) Shared state keys (thread-level memory)

Use these **shared keys** so parent↔children stay in sync. (All persisted to the **thread** via checkpointer.)

* `threadId`: string
* `userInputs`: `{ goal: string; modeOverride?: "auto"|"plan"; gate?: { clarity:number; coherence:number; usd:number; auto:boolean }; plannerAnswers?: {...} }`
* `plan`: `{ goal, constraints, deliverable, dag[] }`
* `queries`: `string[]`
* `searchResults`: **pre-harvest** link objects (url, title, snippet, publishedAt)
* `evidence`: **post-harvest** normalized docs (url, title, snippet, contentHash, chunks[])
* `draft`: `{ text, citations[], confidence }`
* `issues`: `string[]` (from red-team/safety checks)

**Why this matters:** checkpoints save a snapshot of these values at each “super-step,” enabling **resume**, **time-travel**, and **forks** (via `getState`/`updateState`). ([LangChain AI][1])

---

## 5) Human-in-the-loop placement

* **Local (Planner HITL):** all the plan questions (mode + constraints) live **inside Planner**. That keeps the stop/resume semantics scoped and auditable. ([LangChain Docs][6])
* **Global (Parent HITL, optional):** approvals before **expensive harvest** or **final publish** can be implemented at parent boundaries (e.g., “Crawl 120 URLs? est. cost $X”). Also backed by the same thread/checkpointer. ([LangChain AI][1])

---

## 6) Research pipeline (deterministic core)

* **QueryPlan**: derive a small set of focused queries (base + domain-scoped).
* **MetaSearch**: call **Tavily** and **Exa** in parallel; merge/dedupe; record source type/date/host. Tavily & Exa are purpose-built for AI agents with simple APIs; Exa supports semantic/keyword search and rich content retrieval options. ([Tavily][7])
* **Harvest/Normalize**: fetch pages (respect robots, timeouts), strip boilerplate, hash content.
* **Dedup/Rerank**: content-hash dedupe; prefer recency/authority.
* Consider **Send API (map-reduce)** for large batches: fan-out fetch, reduce to `evidence` set. ([LangChain AI][8])

---

## 7) Fact-check & Writer

* **Fact-check** (start simple): deterministic checks—do we have supporting spans for claims; flag contradictions/missing support. If you later need a loop with tool-calling, move it **inside a subgraph** and keep the parent wiring unchanged. Subgraphs are designed for this modular swap. ([LangChain AI][2])
* **Writer**: synthesize sections with inline citations; **red-team gate** enforces: minimum citations, recency threshold, disclaimers for sensitive verticals.

---

## 8) UI/UX requirements (what to build)

* **Mode toggle**: Auto ↔ Plan (writes a flag; Plan opens a dynamic multi-question planner drawer).
* **Answer pane**: streaming narrative with **clickable citation markers** ([1], [2]).
* **Sources panel (right rail)**: cards show host, date, snippet, **supporting excerpt**, and **why-used**; filters by domain/type/date; pin/unpin. This mirrors the growing norm (ChatGPT Search shows linked sources; Gemini “double-check” highlights verifiability). ([OpenAI][9])
* **Artifacts pane** (separate work surface): tables/matrices/exports (Claude’s “Artifacts” pattern—keep big outputs editable and persistent next to chat). ([Claude101][10])
* **Checkpoint timeline**: slider to jump to any checkpoint and branch; reflects LangGraph threads/checkpoints. ([LangChain AI][1])
* **Run log**: chronological steps + tool calls + errors (for auditing trust).

---

## 9) API surface (no code; just contracts)

* **Start**: `POST /api/threads/start` → `{ threadId, status }`
  **Input** `{ goal, modeOverride? }`. On HITL, return `202` with `interrupt` envelope (opaque payload surfaced from `interrupt`).
* **Stream**: `GET /api/stream/:threadId` (SSE) → events like `status`, `section`, `citation`, `done`.
* **State**: `GET /api/threads/:threadId/state` → `{ values, next, checkpointId }` (latest snapshot).
* **Resume**: `POST /api/threads/:threadId/resume` → `{ ok, checkpointId }` (sends `Command(resume=...)`).
* **Mode**: `PATCH /api/threads/:threadId/mode` → `{ mode }` (UI override for auto/plan).
  App Router **Route Handlers** are the recommended primitive for these endpoints, and they can serve SSE. ([Next.js][4])

---

## 10) Non-functionals (what to bake in from day one)

* **Observability**: request IDs, thread IDs, step timings, external API latency, cache hit rate.
* **Caching**: in-process LRU for small dev runs; Redis in prod for (query → hits) and (url → normalized content).
* **Cost & rate limits**: budget guards (tokens + HTTP quotas). Tavily & Exa publish rate-limit guidance and dashboards. ([Tavily Docs][5])
* **Fault-tolerance**: rely on checkpointing; on node failure, **resume from last good checkpoint** (LangGraph persistence guarantees pending writes aren’t lost). ([LangChain AI][1])
* **Security**: sanitize/escape HTML; obey robots; enforce content-type allowlist; block obvious prompt-injection patterns (e.g., “ignore previous instructions” within fetched pages) by stripping instructions from harvested text before model prompts.

---

## 11) Testing plan (what to verify)

* **Unit**:

  * Gating decisions (Auto vs Plan) across varied prompts.
  * Dedupe & merge logic for search results; hashing stability.
* **HITL**: simulate `interrupt` payloads and `resume` paths; ensure Planner re-runs only its node as documented. ([LangChain Docs][6])
* **Parallelism**: Send-API fan-out over N URLs, then reduction correctness (no dupes, stable ordering). ([LangChain AI][8])
* **E2E**: happy path (Auto), HITL path (Plan), resume after restart, time-travel (get state at checkpoint X, fork with updated deliverable). ([LangChain AI][1])
* **UI**: citations jump to the correct source card; SSE disconnect/reconnect behavior; checkpoint slider restores the right draft.

---

## 12) UX patterns borrowed from the ecosystem (for stakeholder buy-in)

* **ChatGPT Search**: answers **with links** to sources—set expectation that citations are first-class. ([OpenAI][9])
* **Gemini “Double-check”**: make verification visible (e.g., green/orange markers), or at minimum a “Verify” button that focuses relevant sources. ([Google Help][11])
* **Claude “Artifacts”**: second pane for substantial outputs (tables/matrices), persistent and editable. ([Claude101][10])

---

## 13) External services quick facts (for the implementer)

* **Tavily**: purpose-built web search for agents; **/search** endpoint; supports depth, domain filtering, and credits/rate limits. Docs and Playground are straightforward. ([Tavily Docs][5])
* **Exa**: “meaning-based” search; **/search** endpoint; configurable **contents retrieval** (full text, summaries, highlights), semantic/keyword, filters. ([docs.exa.ai][12])

---

## 14) Future-proofing (nice-to-haves, not required day one)

* **Grandchildren** only when justified: e.g., a **Crawler** with a **private schema** (`{ url, html, text, status }`) or a **Verifier** with private message history. Parent↔child mapping isolates bloat while keeping parent state clean. ([LangChain AI][2])
* **Long-term memory** via a **Store** for user prefs or reusable facts—distinct from thread memory. ([LangChain AI][13])
* **Map-reduce everywhere it pays**: any batchy step should consider Send API before deeper nesting. ([LangChain AI][8])

---

## 15) Acceptance checklist (definition of done)

* [ ] Start → Stream → (optional) HITL → Resume → Final report works end-to-end on a single **thread_id**.
* [ ] Sources panel shows at least **title, host, date, snippet, link**, and **why used**.
* [ ] Inline citations are clickable and always map to cards.
* [ ] Mode toggle changes behavior immediately (Auto bypasses questions; Plan triggers planner drawer).
* [ ] `getState` returns snapshots; user can select a checkpoint and **fork** a new path. ([LangChain AI][1])
* [ ] Basic guardrails: robots/timeouts, cache hits logged, external errors surfaced to Run Log.

---

**If anything feels ambiguous, anchor to the primary docs first** (LangGraph persistence, subgraphs, HITL/interrupts, Send API; Next.js Route Handlers; Tavily/Exa endpoints). These are the most “load-bearing” references for the engineer implementing this: ([LangChain AI][1])