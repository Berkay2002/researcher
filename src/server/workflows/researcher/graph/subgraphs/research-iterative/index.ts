/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { END, START, StateGraph } from "@langchain/langgraph";
import {
  round1ReasoningNode,
  round2ReasoningNode,
  round3ReasoningNode,
} from "./nodes/reasoning";
import {
  round1SearchNode,
  round2SearchNode,
  round3SearchNode,
} from "./nodes/search";
import { synthesisNode } from "./nodes/synthesis";
import { IterativeResearchStateAnnotation } from "./state";

/**
 * Build Iterative Research Subgraph
 *
 * Creates a 3-round sequential research pattern following ChatGPT Deep Research methodology.
 *
 * Flow:
 * - Round 1: Broad Orientation (2-3 broad queries → sequential search)
 * - Round 2: Deep Dive (3-4 targeted queries → sequential search, alternating providers)
 * - Round 3: Validation (2-3 validation queries → sequential search)
 * - Synthesis: Prepare results for downstream synthesizer
 *
 * Pattern from: documentation/langgraph/10-subgraphs.md
 * - Uses StateGraph with its own Annotation-based state
 * - Input/output transformations for parent-subgraph communication
 * - Sequential edges (no conditional routing)
 * - Each node uses config.writer for streaming thoughts
 *
 * NO CUSTOM CODE - Only LangGraph patterns:
 *  Annotation for state management
 *  StateGraph for graph construction
 *  config.writer for streaming
 *  Sequential .addEdge() for flow
 *  Standard node signature: (state, config) => Promise<Partial<State>>
 *
 * @returns Compiled LangGraph that executes iterative research
 */
/**
 * Initialize subgraph state from parent state
 * This node transforms incoming state into IterativeResearchState format
 */
function initializeIterativeState(state: Record<string, unknown>) {
  console.log("[IterativeResearch] Initializing subgraph state");

  const userInputs = state.userInputs as { goal?: string } | undefined;
  const plan = state.plan as
    | { constraints?: Record<string, unknown> }
    | undefined;

  return {
    goal: userInputs?.goal || "",
    constraints: plan?.constraints || {},
    findings: [],
    currentRound: 1,
    allSources: [],
    researchComplete: false,
    currentQueries: [],
  };
}
export function buildIterativeResearchSubgraph() {
  console.log(
    "[IterativeResearch] Building 3-round sequential research subgraph..."
  );

  const builder = new StateGraph(IterativeResearchStateAnnotation)
    // Initialization node to transform parent state
    .addNode("initialize", initializeIterativeState)

    // Round 1: Broad Orientation
    .addNode("round1_reasoning", round1ReasoningNode)
    .addNode("round1_search", round1SearchNode)

    // Round 2: Deep Dive
    .addNode("round2_reasoning", round2ReasoningNode)
    .addNode("round2_search", round2SearchNode)

    // Round 3: Validation
    .addNode("round3_reasoning", round3ReasoningNode)
    .addNode("round3_search", round3SearchNode)

    // Synthesis
    .addNode("synthesis", synthesisNode)

    // Wire sequential flow (NO conditional routing)
    .addEdge(START, "initialize")
    .addEdge("initialize", "round1_reasoning")
    .addEdge("round1_reasoning", "round1_search")
    .addEdge("round1_search", "round2_reasoning")
    .addEdge("round2_reasoning", "round2_search")
    .addEdge("round2_search", "round3_reasoning")
    .addEdge("round3_reasoning", "round3_search")
    .addEdge("round3_search", "synthesis")
    .addEdge("synthesis", END);

  console.log("[IterativeResearch] Compiling subgraph...");
  const compiled = builder.compile();

  console.log("[IterativeResearch] Subgraph compiled successfully");
  console.log(
    "[IterativeResearch] Flow: START → Round1 → Round2 → Round3 → Synthesis → END"
  );

  return compiled;
}
