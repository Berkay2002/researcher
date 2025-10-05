/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation } from "../../state";
import { factcheck } from "./nodes/factcheck";

/**
 * Build Fact-check Subgraph
 *
 * Performs deterministic fact-checking by verifying claims in the draft
 * have supporting evidence in the research results.
 */
export function buildFactcheckSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("factcheck", factcheck)
    .addEdge(START, "factcheck")
    .addEdge("factcheck", END);

  return builder.compile();
}
