/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation, type ParentState } from "../../state";

/**
 * Writer Subgraph (Stub for Phase 1)
 *
 * Will implement: Synthesize → Red-team gate
 * For now, returns a placeholder draft.
 */
async function writerStub(_state: ParentState): Promise<Partial<ParentState>> {
  console.log("[writer] Writer stub executing...");

  return {
    draft: {
      text: "This is a placeholder research report.",
      citations: [],
      confidence: 0.5,
    },
  };
}

/**
 * Build Writer Subgraph
 *
 * Uses ParentStateAnnotation to inherit state schema and reducers from parent graph
 */
export function buildWriterSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("writerStub", writerStub)
    .addEdge(START, "writerStub")
    .addEdge("writerStub", END);

  return builder.compile();
}
