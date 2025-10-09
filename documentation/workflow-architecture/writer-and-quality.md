# Writer & Synthesis

After research completes, the workflow synthesizes the findings into a comprehensive report. The synthesizer node aggregates results from all parallel research workers and generates a final draft with citations.

## Draft Synthesis

The `synthesize` node assembles a formal report by:

1. Aggregating and deduplicating documents from all parallel research workers.
2. Ranking documents by quality, relevance, and recency to select the best sources.
3. Preparing evidence context with proper citations and metadata.
4. Invoking the generation LLM to synthesize a comprehensive report that addresses the research goal.
5. Extracting citations and computing a confidence score based on evidence coverage and worker diversity.

The node implements the synthesis phase of the Orchestrator-Worker pattern, combining all worker outputs into a cohesive final deliverable with proper source attribution and quality metrics.

## Additional Approval Gate

For costly or risky research runs, the optional `approvals` node can interrupt execution before large harvest operations. It estimates resource usage, detects sensitive domains, and triggers a human approval interrupt when policy thresholds are exceeded, recording the signed decision back into `userInputs.approvals`.【F:src/server/workflows/researcher/graph/nodes/approvals.ts†L8-L257】 This gate provides governance over expensive or high-risk workflows without altering the deterministic structure of the main subgraphs.
