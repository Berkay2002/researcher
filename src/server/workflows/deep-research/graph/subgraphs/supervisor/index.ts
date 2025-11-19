/**
 * Supervisor Subgraph Builder
 *
 * Creates a subgraph for the supervisor that delegates research to specialized researchers.
 */

import { AIMessage } from "@langchain/core/messages";
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
  // Support both standard tool_calls and legacy additional_kwargs
  const lastAiMessage = lastMessage as AIMessage;
  const toolCalls =
    lastAiMessage.tool_calls && lastAiMessage.tool_calls.length > 0
      ? lastAiMessage.tool_calls
      : lastMessage.additional_kwargs?.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    return "__end__";
  }

  // Helper to safely get tool name
  const getToolName = (call: any) => call.name || call.function?.name;

  // Check if ResearchComplete was called
  const hasResearchComplete = toolCalls.some(
    (call: any) => getToolName(call) === "ResearchComplete"
  );

  if (hasResearchComplete) {
    return "__end__";
  }

  // Check if ConductResearch or think_tool was called
  const hasActionableTool = toolCalls.some(
    (call: any) => {
      const name = getToolName(call);
      return name === "ConductResearch" || name === "think_tool";
    }
  );

  if (hasActionableTool) {
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