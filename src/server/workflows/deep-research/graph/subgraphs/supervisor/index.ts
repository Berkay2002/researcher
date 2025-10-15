/**
 * Supervisor Subgraph Builder
 *
 * Creates a subgraph for the supervisor that delegates research to specialized researchers.
 */

import { StateGraph } from "@langchain/langgraph";
import { SupervisorStateAnnotation } from "../../state";
import { supervisor } from "./nodes/supervisor";
import { supervisorTools } from "./nodes/supervisor-tools";

/**
 * Route from supervisor based on tool calls
 */
function shouldExecuteTools(
  state: typeof SupervisorStateAnnotation.State
): string {
  const { supervisor_messages } = state;

  // Get last message
  const lastMessage = supervisor_messages.at(-1);

  if (!lastMessage) {
    return "__end__";
  }

  // Check if last message has tool calls
  const toolCalls = lastMessage.additional_kwargs?.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    return "__end__";
  }

  // Check if ResearchComplete was called
  const hasResearchComplete = toolCalls.some(
    (call) => call.function.name === "ResearchComplete"
  );

  if (hasResearchComplete) {
    return "__end__";
  }

  // Check if ConductResearch was called
  const hasConductResearch = toolCalls.some(
    (call) => call.function.name === "ConductResearch"
  );

  if (hasConductResearch) {
    return "supervisor_tools";
  }

  // Default: continue to supervisor (loop)
  return "supervisor";
}

/**
 * Create and compile the supervisor subgraph
 */
export function createSupervisorGraph() {
  const graph = new StateGraph({
    stateSchema: SupervisorStateAnnotation,
  })
    .addNode("supervisor", supervisor)
    .addNode("supervisor_tools", supervisorTools)
    .addEdge("__start__", "supervisor")
    .addConditionalEdges("supervisor", shouldExecuteTools, [
      "supervisor_tools",
      "supervisor",
      "__end__",
    ])
    .addEdge("supervisor_tools", "supervisor");

  return graph.compile();
}
