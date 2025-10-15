/**
 * Deep Research Main Graph
 *
 * Orchestrates the complete deep research workflow:
 * 1. Clarify user requirements
 * 2. Generate research brief
 * 3. Execute supervised research with parallel researchers
 * 4. Generate final comprehensive report
 */

import type { CompiledStateGraph } from "@langchain/langgraph";
import { MemorySaver, StateGraph } from "@langchain/langgraph";
import { clarifyWithUser } from "./nodes/clarify-with-user";
import { finalReportGeneration } from "./nodes/final-report-generation";
import { writeResearchBrief } from "./nodes/write-research-brief";
import type { AgentState } from "./state";
import { AgentStateAnnotation } from "./state";
import { createSupervisorGraph } from "./subgraphs/supervisor";

// Singleton instance with proper type
let graphInstance: CompiledStateGraph<
  AgentState,
  Partial<AgentState>,
  "__start__" | "clarify_with_user" | "write_research_brief" | "supervisor" | "final_report_generation"
> | null = null;

/**
 * Get or create the deep research graph singleton
 */
export function getDeepResearchGraph() {
  if (graphInstance) {
    return graphInstance;
  }

  // Create checkpointer for thread-level persistence
  const checkpointer = new MemorySaver();

  // Create supervisor subgraph
  const supervisorGraph = createSupervisorGraph();

  // Build main graph
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("clarify_with_user", clarifyWithUser, {
      ends: ["write_research_brief", "__end__"]
    })
    .addNode("write_research_brief", writeResearchBrief)
    .addNode("supervisor", supervisorGraph)
    .addNode("final_report_generation", finalReportGeneration)
    .addEdge("__start__", "clarify_with_user")
    // clarify_with_user handles its own routing with Command
    .addEdge("write_research_brief", "supervisor")
    .addEdge("supervisor", "final_report_generation")
    .addEdge("final_report_generation", "__end__");

  // Compile with checkpointer
  graphInstance = graph.compile({ checkpointer });

  return graphInstance;
}

/**
 * Reset the graph instance (useful for testing)
 */
export function resetDeepResearchGraph() {
  graphInstance = null;
}
