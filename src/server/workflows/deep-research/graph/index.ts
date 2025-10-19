/**
 * Deep Research Main Graph
 *
 * Orchestrates the complete deep research workflow:
 * 1. Route request (follow-up vs new research)
 * 2. For follow-ups: Answer using existing report
 * 3. For new research:
 *    a. Clarify user requirements
 *    b. Generate research brief
 *    c. Execute supervised research with parallel researchers
 *    d. Generate final comprehensive report
 */

import type { CompiledStateGraph } from "@langchain/langgraph";
import { MemorySaver, StateGraph } from "@langchain/langgraph";
import { answerFollowup } from "./nodes/answer-followup";
import { clarifyWithUser } from "./nodes/clarify-with-user";
import { finalReportGeneration } from "./nodes/final-report-generation";
import { routeDecision, routeRequest } from "./nodes/route-request";
import { writeResearchBrief } from "./nodes/write-research-brief";
import type { AgentState } from "./state";
import { AgentStateAnnotation } from "./state";
import { createSupervisorGraph } from "./subgraphs/supervisor";

// Singleton instance with proper type
let graphInstance: CompiledStateGraph<
  AgentState,
  Partial<AgentState>,
  | "__start__"
  | "route_request"
  | "answer_followup"
  | "clarify_with_user"
  | "write_research_brief"
  | "supervisor"
  | "final_report_generation"
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

  /**
   * Conditional edge function to decide whether to route requests or skip directly to clarification.
   * If no existing report exists, we skip routing and go straight to clarification.
   */
  function shouldRoute(state: AgentState): string {
    if (!state.final_report) {
      // No previous report - skip routing, go directly to clarification
      return "clarify_with_user";
    }
    // Previous report exists - run the router
    return "route_request";
  }

  // Build main graph with routing
  const graph = new StateGraph(AgentStateAnnotation)
    // Add routing nodes
    .addNode("route_request", routeRequest)
    .addNode("answer_followup", answerFollowup)
    // Add existing research flow nodes
    .addNode("clarify_with_user", clarifyWithUser, {
      ends: ["write_research_brief", "__end__"],
    })
    .addNode("write_research_brief", writeResearchBrief)
    .addNode("supervisor", supervisorGraph)
    .addNode("final_report_generation", finalReportGeneration)
    // Entry point: check if we should route or skip to clarification
    .addConditionalEdges("__start__", shouldRoute, [
      "route_request",
      "clarify_with_user",
    ])
    // Route request uses conditional edges to decide between follow-up and new research
    .addConditionalEdges("route_request", routeDecision, [
      "answer_followup",
      "clarify_with_user",
    ])
    // Follow-up path goes directly to end
    .addEdge("answer_followup", "__end__")
    // Research flow (unchanged)
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
