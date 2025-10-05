/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation } from "../../state";
import { redteam } from "./nodes/redteam";
import { synthesize } from "./nodes/synthesize";

/**
 * Build Writer Subgraph
 *
 * Implements the full writing pipeline: Synthesize → Red-team gate
 * - Synthesize: Generate report with citations from evidence
 * - Redteam: Quality gate checks before publication
 */
export function buildWriterSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("synthesize", synthesize)
    .addNode("redteam", redteam)
    .addEdge(START, "synthesize")
    .addEdge("synthesize", "redteam")
    .addEdge("redteam", END);

  return builder.compile();
}
