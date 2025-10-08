# Writer Subgraph & Quality Gates

After research completes, the workflow enters the writer subgraph to synthesize a draft and perform quality checks before publication. The subgraph contains a linear `synthesize → redteam` pipeline compiled against the shared state annotation so both nodes read the same plan, evidence, and issue channels.【F:src/server/workflows/researcher/graph/subgraphs/write/index.ts†L7-L23】

## Draft Synthesis

The `synthesize` node assembles a formal report by:

1. Validating that a goal and evidence set exist before proceeding.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/synthesize.ts†L52-L71】
2. Building a system prompt from the plan deliverable and a human prompt that enumerates truncated evidence chunks, preserving citations back to the original sources.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/synthesize.ts†L76-L190】
3. Invoking the generation LLM, normalizing the output, extracting citations, and computing a confidence score based on evidence coverage and diversity before storing the resulting `draft` in state.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/synthesize.ts†L88-L135】

The node limits the number of chunks per evidence item, enforces citation formatting, and calculates quality metrics (e.g., citation density, source diversity) to inform the downstream confidence value.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/synthesize.ts†L16-L125】

## Red-team Quality Checks

The `redteam` node performs deterministic validations plus an LLM-based review:

- Deterministic checks ensure the draft meets relaxed thresholds for confidence, length, citation density, and evidence utilization while flagging placeholder text or missing structure.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/redteam.ts†L10-L164】
- An LLM quality review scores the draft against relevance, coherence, accuracy, completeness, objectivity, and clarity, returning JSON-formatted issues that are appended to the shared `issues` channel.【F:src/server/workflows/researcher/graph/subgraphs/write/nodes/redteam.ts†L169-L200】

All issues from both passes accumulate in `state.issues`, allowing the workflow to pause publication or prompt humans for intervention if quality gates fail.【F:src/server/workflows/researcher/graph/state.ts†L284-L290】

## Additional Approval Gate

For costly or risky research runs, the optional `approvals` node can interrupt execution before large harvest operations. It estimates resource usage, detects sensitive domains, and triggers a human approval interrupt when policy thresholds are exceeded, recording the signed decision back into `userInputs.approvals`.【F:src/server/workflows/researcher/graph/nodes/approvals.ts†L8-L257】 This gate provides governance over expensive or high-risk workflows without altering the deterministic structure of the main subgraphs.
