# Planner Subgraph

The planner subgraph is responsible for converting the user's goal into an executable research plan. The parent workflow routes into this subgraph after running the plan gate and chooses between automated planning and a human-in-the-loop (HITL) loop based on the gating decision.【F:src/server/graph/index.ts†L62-L70】【F:src/server/graph/subgraphs/planner/index.ts†L14-L35】

## Plan Gate Heuristics

`planGate` evaluates the request before entering the subgraph. It checks for explicit mode overrides and otherwise scores the prompt's clarity, expected search coherence, and estimated budget to decide whether automation is safe. Thresholds (`τ₁ = 0.6`, `τ₂ = 0.5`, `$5`) bias the workflow toward automation only when the prompt appears well-specified and inexpensive; otherwise the system steers into HITL planning.【F:src/server/graph/nodes/plan-gate.ts†L7-L240】 The gate also logs the final decision and signal values into state for observability and downstream UI rendering.【F:src/server/graph/nodes/plan-gate.ts†L181-L240】

## Auto Planning Path

In auto mode the `autoPlanner` node analyzes prompt completeness with an LLM, uses the existing prompt directly if it is deemed complete, and otherwise builds a plan with reasonable default assumptions. No human interrupts occur on this path, so the planner writes the synthesized `plan` back to state and the workflow advances immediately.【F:src/server/graph/subgraphs/planner/nodes/auto-planner.ts†L10-L50】

## HITL Planning Loop

When the gate selects plan mode, the `hitlPlanner` node orchestrates a multi-step dialogue:

1. **Bootstrap analysis.** It caches the prompt completeness analysis and generated question list so repeated resumes do not re-query the LLM.【F:src/server/graph/subgraphs/planner/nodes/hitl-planner.ts†L26-L80】
2. **Interrupt-driven Q&A.** For each unanswered question the node calls `interrupt`, prompting the user and suspending execution until a response is provided. Answers accumulate in `state.planning.answers` via structured commands so the loop can resume deterministically.【F:src/server/graph/subgraphs/planner/nodes/hitl-planner.ts†L82-L132】
3. **Plan synthesis.** After all questions are answered the node synthesizes the final plan, records the Q&A transcript in both `planning` and `userInputs`, and emits a `Command` to jump back to the parent graph's research phase.【F:src/server/graph/subgraphs/planner/nodes/hitl-planner.ts†L134-L164】

LLM helpers in the same folder provide prompt analysis, question generation, and plan construction routines so both planner modes share consistent logic and deliverables.【F:src/server/graph/subgraphs/planner/nodes/llm-helpers.ts†L24-L209】
