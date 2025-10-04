/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation, type ParentState } from "../../state";

/**
 * Fact-check Subgraph (Stub for Phase 1)
 *
 * Will implement deterministic checks for supporting evidence.
 * For now, returns no issues.
 */
async function factcheckStub(
  _state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[factcheck] Fact-check stub executing...");

  return {
    issues: [],
  };
}

/**
 * Build Fact-check Subgraph
 *
 * Uses ParentStateAnnotation to inherit state schema and reducers from parent graph
 */
export function buildFactcheckSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("factcheckStub", factcheckStub)
    .addEdge(START, "factcheckStub")
    .addEdge("factcheckStub", END);

  return builder.compile();
}
