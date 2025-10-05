Below are the **implementation addenda** for the three orchestration gates you asked about—**`plan-gate.ts`**, **`approvals.ts`**, and **`publish-gate.ts`**—written as drop-in sections for your Implementation Plan. No code, just precise contracts, state I/O, decision rules, and HITL semantics aligned with LangGraph **v1-alpha** (threads, checkpointers, interrupts/Command). Citations point to the current LangGraph/LangChain docs these behaviors rely on.

---

## ✳️ `plan-gate.ts` — Planner Mode Decider (Auto ↔ Plan)

**Purpose**
Choose whether to run the Planner in **Auto-mode** (no questions) or **Plan-mode** (HITL), based on a UI override and cheap, fast signals. This node **does not** call `interrupt`; it only writes a decision into state, which the Planner reads next. (Use map-reduce/Send later if you want to parallelize preview probes.) ([LangChain Docs][1])

**Placement**
Parent graph, directly **before** the Planner subgraph.

**Reads from state**

* `userInputs.goal : string`
* `userInputs.modeOverride : "auto" | "plan" | null`

**Writes to state**

* `userInputs.gate : { clarity:number; coherence:number; usd:number; auto:boolean }`
* `userInputs.modeFinal : "auto" | "plan"`

**Decision rules**

1. **UI override wins**

   * If `modeOverride === "plan"` → `modeFinal="plan"`.
   * If `modeOverride === "auto"` → `modeFinal="auto"`.
2. **Otherwise, compute gating signals**

   * **Clarity** (IR-style heuristic): longer, time-scoped, single-intent prompts score higher (0–1).
   * **Preview coherence**: fire a single **preview search** (e.g., Tavily + Exa), evaluate top-K host diversity & title coherence (0–1). (Batch these calls in parallel; later you can move this to a Send fan-out.) ([LangChain Docs][1])
   * **Cost guard**: coarse token/time estimate → USD.
3. **Threshold policy**

   * `AUTO` if `clarity ≥ τ1` **and** `coherence ≥ τ2` **and** `usd ≤ budget`; else `PLAN`.
   * On **errors** (e.g., preview failed), **default to PLAN** for safety.

**Observability**
Log `{thread_id, clarity, coherence, usd, decision, goal_len}`. Helpful for tuning τ₁/τ₂.

**Why this is “graph correct”**
All you’re doing is **writing** a decision to state that the next node consumes—no HITL. Planner logic stays modular, state is persisted per step via the **checkpointer** and can be inspected or forked later with `getState` / `updateState`. ([LangChain Docs][1])

---

## ✅ `approvals.ts` — Pre-Action Approval Gate (before expensive/risky steps)

**Purpose**
Pause **before** high-cost / high-risk actions (e.g., a large crawl) to **approve, edit, or cancel**. This node **uses `interrupt()`**, which pausing the graph until you resume with a `Command(resume=…)`. Graph state at the pause is captured in a **checkpoint** tied to the **thread**, so you can time-travel or fork. ([LangChain Docs][2])

**Placement**
Parent graph, **between** Planner → Research (right before Harvest/large fan-out). Optionally add further approvals at other costly junctures.

**Triggering conditions** (any true → run this gate)

* Predicted cost/latency exceeds policy or user budget.
* New/untrusted domains; sensitive verticals (med/legal/finance).
* Paywalled content or robots risk; high host count or rate-limit pressure.

**Reads from state**

* `plan : { dag, constraints }`
* `queries : string[]` (if available)
* Cost/latency estimates produced earlier (if present)

**Interrupt payload (what the UI sees)**

```json
{
  "type": "approval_request",
  "summary": { "step": "harvest", "est_urls": 120, "hosts": 18, "est_cost_usd": 3.20, "est_time_s": 95 },
  "domains": ["example.com", "arxiv.org", "..."],
  "risks": ["paywall", "sensitive_topic:finance"],
  "checkpoint_hint": { "thread_id": "...", "latest_checkpoint_id": "..." }
}
```

This is **opaque** to the UI; just render it and collect a decision. When you **resume**, pass the decision via `Command(resume=…)`. On resume, LangGraph **re-executes the node from the start**; `interrupt()` returns the resume value instead of pausing again. ([LangChain Docs][2])

**Expected resume value (UI → gate)**

```json
{
  "decision": "approve" | "edit" | "cancel",
  "edits": {
    "max_urls": 80,
    "allow_domains": ["arxiv.org", "nber.org"],
    "block_domains": ["lowtrust.example"],
    "date_range": "last_2y",
    "budget_usd_cap": 2.50
  },
  "notes": "Trim to primary hosts; skip low-trust."
}
```

**Writes to state (effects)**

* On **approve**: persist a record under e.g. `userInputs.approvals[]` (timestamp, signer, policy snapshot) and continue.
* On **edit**: merge edits into `plan.constraints` and/or Research inputs; persist decision record.
* On **cancel**: write a terminal status (e.g., `issues.push("user_cancelled_at_approvals")`) and short-circuit the run.

**Multiple approvals?**
If you ever parallelize and hit multiple `interrupt`s at once, you can resume **all** with a single `Command` mapping from interrupt IDs → resume values. (Edge case; note it for future.) ([LangChain Docs][3])

**Why this is “graph correct”**

* `interrupt` + `Command(resume)` are the **canonical** HITL primitives; a **checkpointer** is required so the graph can pause indefinitely and resume with consistent state. ([LangChain Docs][2])
* Because this gate is at the **parent layer**, the decision applies globally (downstream subgraphs inherit the updated state automatically). ([LangChain Docs][4])

---

## 🚦 `publish-gate.ts` — Pre-Publish Release Gate (after red-team, before export)

**Purpose**
Pause **after** synthesis/red-team to verify quality and get final **approval to publish/export**. Catch missing citations, stale sources, or unresolved red-team issues. Like the approvals gate, this uses `interrupt()` + `Command(resume)` and relies on the same checkpoint/thread model. ([LangChain Docs][2])

**Placement**
Parent graph, **after** Writer’s red-team node and **before** any export/notify step.

**Reads from state**

* `draft : { text, citations[], confidence }`
* `issues : string[]` (from red-team)
* `evidence : Evidence[]` (for recency checks)

**Deterministic checks (run before HITL)**

* **Citations present** for non-obvious claims (policy threshold).
* **Recency window** (e.g., no key claims older than N months).
* **Section completeness** vs. deliverable template.
* **Red-team clean** (no blocking issues).
  If **all pass** and policy allows auto-publish, **skip** interrupt and continue.

**Interrupt payload (what the UI sees)**

```json
{
  "type": "publish_review",
  "summary": {
    "sections_ok": true,
    "citations_count": 23,
    "recency_ok": false,
    "blocking_issues": ["stale_source_window_breach: 3 items"]
  },
  "preview": { "snippet": "First 600 chars of draft...", "sections": ["summary","findings","citations"] },
  "sources_sample": [
    { "title": "BLS CPI release", "url": "...", "date": "2025-08-14" },
    { "title": "FOMC statement", "url": "...", "date": "2025-09-17" }
  ],
  "checkpoint_hint": { "thread_id": "...", "latest_checkpoint_id": "..." }
}
```

**Expected resume value (UI → gate)**

```json
{
  "decision": "approve" | "fix_auto" | "edit_then_retry" | "reject",
  "edits": {
    "force_recency_months": 12,
    "require_min_citations": 10,
    "add_disclaimer": true
  }
}
```

**Writes to state (effects)**

* On **approve**: stamp an approval record (who, when, policy snapshot) and set `userInputs.publish.approved=true`; proceed to export/publish.
* On **fix_auto**: update constraints (e.g., stricter recency), set a **rerun route** (e.g., jump back to Research or Writer), and continue.
* On **edit_then_retry**: annotate state for a manual edit pass (or open HITL editor), then re-enter Writer.
* On **reject**: mark terminal status and stop.

**Audit & time-travel**
Because each stop writes a checkpoint, reviewers can retrieve snapshots with `getState(thread_id)` or target a specific `checkpoint_id`, adjust with `updateState(...)`, and **resume/fork** from there. ([LangChain Docs][1])

**Why this is “graph correct”**
Global publish decisions belong at the **parent boundary** so you keep a clean audit trail, and downstream exports can remain deterministic. The pause/resume semantics and durability are guaranteed by **interrupt + Command + checkpointer**. ([LangChain Docs][2])

---

### Cross-cutting notes for all three gates

* **HITL mechanics** (for `approvals.ts` and `publish-gate.ts`):

  * `interrupt(payload)` **pauses** the node; the graph returns an `__interrupt__` envelope to the caller.
  * Resuming uses `invoke(new Command({ resume }))` (or `.stream(...)`), and the **node re-executes from the beginning**; this time `interrupt()` returns the provided value without pausing. ([LangChain Docs][2])
  * If you ever collect **multiple interrupts** (e.g., parallel approvals), you can resume them in one shot by passing a map of `interruptId → value`. ([LangChain Docs][3])

* **Memory & scope**
  All three gates rely on the parent graph’s **checkpointer** and **thread** to retain state between steps and across resumes; subgraphs inherit that by default when they share keys. ([LangChain Docs][4])

* **Parallelization**
  Only `plan-gate.ts` may benefit from a small preview probe. If you scale this up (batch previews), prefer **Send API** (map-reduce) rather than deeper nesting. ([LangChain Docs][1])

* **LangChain v1-alpha surface** (if you later wrap tools/agents around these)

  * Use `createAgent` and `ToolNode` from `langchain` for ReAct-style tool loops inside *subgraphs*, not at these gates. ([LangChain Docs][5])

---

### Acceptance checks (specific to the three files)

* **`plan-gate.ts`**

  * Given `{goal, modeOverride:null}`, writes `{gate:{clarity,coherence,usd,auto}, modeFinal}` according to thresholds.
  * Honors `modeOverride`.
  * On preview failure: sets `modeFinal="plan"` and records error in gate metrics.

* **`approvals.ts`**

  * Triggers on cost/risk thresholds; emits a **single** `interrupt` with summarized plan + risks; resumes with approve/edit/cancel.
  * Merges edits into constraints; logs a durable decision record in state.

* **`publish-gate.ts`**

  * Runs deterministic checks first; **skips** HITL if all pass and policy allows auto-publish.
  * Otherwise interrupts with a release checklist + preview; resumes with approve/fix/edit/reject; stamps approval metadata or routes back appropriately.

These items give your local agent unambiguous targets for implementing the three nodes while staying inside the LangGraph **v1-alpha** semantics for persistence, subgraphs, and HITL. If you need me to define the **resume payload shapes** your UI will send for each case (approve/edit/reject), I can spell them out per route next.

[1]: https://docs.langchain.com/oss/javascript/langgraph/use-graph-api?utm_source=chatgpt.com "Use the graph API - Docs by LangChain"
[2]: https://docs.langchain.com/oss/javascript/langgraph/add-human-in-the-loop?utm_source=chatgpt.com "Enable human intervention - Docs by LangChain"
[3]: https://docs.langchain.com/oss/python/langgraph/add-human-in-the-loop?utm_source=chatgpt.com "Enable human intervention - Docs by LangChain"
[4]: https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs?utm_source=chatgpt.com "Use subgraphs - Docs by LangChain"
[5]: https://docs.langchain.com/oss/javascript/releases/langchain-v1?utm_source=chatgpt.com "LangChain JavaScript v1.0"
