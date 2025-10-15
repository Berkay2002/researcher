/**
 * Researcher Subgraph Builder
 *
 * Creates a subgraph for individual researchers that conduct focused research
 * on specific topics using tool calls (search, think, etc.).
 */

import { StateGraph } from "@langchain/langgraph";
import {
  ResearcherOutputStateAnnotation,
  ResearcherStateAnnotation,
} from "../../state";
import { compressResearch } from "./nodes/compress-research";
import { researcher } from "./nodes/researcher";
import { researcherTools } from "./nodes/researcher-tools";

/**
 * Route from researcher based on whether there are tool calls
 */
function shouldCallTools(
  state: typeof ResearcherStateAnnotation.State
): string {
  const { researcher_messages } = state;

  // Get last message
  const lastMessage = researcher_messages.at(-1);

  // Check if last message has tool calls
  const hasToolCalls =
    lastMessage?.additional_kwargs?.tool_calls &&
    lastMessage.additional_kwargs.tool_calls.length > 0;

  if (hasToolCalls) {
    return "researcher_tools";
  }

  return "compress_research";
}

/**
 * Create and compile the researcher subgraph
 */
export function createResearcherGraph() {
  const graph = new StateGraph({
    stateSchema: ResearcherStateAnnotation,
    output: ResearcherOutputStateAnnotation,
  })
    .addNode("researcher", researcher)
    .addNode("researcher_tools", researcherTools)
    .addNode("compress_research", compressResearch)
    .addEdge("__start__", "researcher")
    .addConditionalEdges("researcher", shouldCallTools, [
      "researcher_tools",
      "compress_research",
    ])
    .addEdge("researcher_tools", "researcher")
    .addEdge("compress_research", "__end__");

  return graph.compile();
}
