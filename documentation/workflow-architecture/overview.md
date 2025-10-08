# Researcher Workflow Architecture Overview

This repository implements a workflow-style orchestration rather than an autonomous agent. The core execution path is encoded as a LangGraph `StateGraph` with fixed edges from planning through research and writing, and it is compiled once with a shared Postgres-backed checkpointer to persist thread state across interruptions.【F:src/server/workflows/researcher/graph/index.ts†L1-L86】 The shared `ParentStateAnnotation` defines a structured schema with reducers for user inputs, plans, queries, research artefacts, evidence, drafts, and quality issues, ensuring every node in the graph reads and updates state consistently.【F:src/server/workflows/researcher/graph/state.ts†L223-L296】

## Workflow Building Blocks

- **Deterministic orchestration.** The parent graph wires `planGate → planner → researchFlow → writer` without dynamic node selection beyond the explicit gates described below. Each subgraph compiles into the parent with namespaced channels so the runtime always follows the same top-level order.【F:src/server/workflows/researcher/graph/index.ts†L42-L74】
- **Persistent checkpointing.** A singleton `PostgresSaver` is attached during graph compilation so that human-in-the-loop (HITL) interruptions and retries resume from durable checkpoints instead of recomputing prior steps.【F:src/server/workflows/researcher/graph/index.ts†L30-L73】
- **Shared workflow state.** The annotation covers gating signals, planner caches, generated queries, multi-phase research results, evidence, drafts, and issue logs. Reducers merge or replace data depending on whether state is cumulative (e.g., queries, evidence) or atomic (e.g., plan, draft).【F:src/server/workflows/researcher/graph/state.ts†L236-L290】

## Coordination Patterns

- **Routing and gating.** The `planGate` node scores prompt clarity, coherence, and estimated cost to decide whether to remain in automated mode or require HITL planning. Explicit user overrides bypass the heuristic so the workflow honours manual choices while still logging gating telemetry.【F:src/server/workflows/researcher/graph/nodes/plan-gate.ts†L7-L240】
- **Human-in-the-loop pauses.** HITL planning and approvals use LangGraph commands and `interrupt` calls to pause the deterministic workflow, surface questions or approval requests, and resume only after human responses have been recorded.【F:src/server/workflows/researcher/graph/subgraphs/planner/nodes/hitl-planner.ts†L18-L164】【F:src/server/workflows/researcher/graph/nodes/approvals.ts†L8-L257】
- **Subgraph specialisation.** Dedicated subgraphs encapsulate planner, research, and writer responsibilities. Each subgraph contains the minimal nodes required for its phase, maintaining linear progression internally while allowing isolated changes per domain.【F:src/server/workflows/researcher/graph/subgraphs/planner/index.ts†L1-L35】【F:src/server/workflows/researcher/graph/subgraphs/research/index.ts†L1-L41】【F:src/server/workflows/researcher/graph/subgraphs/write/index.ts†L1-L23】

## Workflow vs. Agent Behaviour

While individual nodes may call LLMs or external services, the orchestration itself follows predetermined code paths. Decisions such as switching to HITL mode, selecting research candidates, or red-teaming drafts are implemented through explicit reducers, heuristics, and static graph edges instead of ad-hoc tool selection. As a result, the system behaves as a workflow with programmable stages, predictable checkpoints, and manual overrides—not as a free-form agent that plans its own actions at runtime.【F:src/server/workflows/researcher/graph/index.ts†L24-L74】【F:src/server/workflows/researcher/graph/subgraphs/research/index.ts†L10-L41】【F:src/server/workflows/researcher/graph/subgraphs/write/index.ts†L7-L23】
