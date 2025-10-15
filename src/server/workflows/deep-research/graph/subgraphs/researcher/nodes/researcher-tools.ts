/**
 * Researcher Tools Node
 *
 * Executes tool calls made by the researcher node in parallel.
 */

import type { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { getConfiguration } from "../../../../configuration";
import {
  exaSearchTool,
  getNotesFromToolCalls,
  tavilySearchTool,
  thinkTool,
} from "../../../../utils";
import type { ResearcherState } from "../../../state";

/**
 * Execute tool calls from researcher
 */
export async function researcherTools(
  state: ResearcherState,
  config?: RunnableConfig
): Promise<Partial<ResearcherState>> {
  const configuration = getConfiguration(config);
  const { researcher_messages, tool_call_iterations } = state;

  // Get the last AI message with tool calls
  const lastMessage = researcher_messages.at(-1) as AIMessage | undefined;

  if (!lastMessage?.tool_calls || lastMessage.tool_calls.length === 0) {
    throw new Error("No tool calls found in last message");
  }

  const toolCalls = lastMessage.tool_calls;

  // Create a map of available tools
  const toolMap: Record<string, StructuredToolInterface> = {
    think_tool: thinkTool,
  };

  // Add search tools based on configuration
  if (configuration.search_api === "tavily") {
    toolMap.tavily_search = tavilySearchTool;
  } else if (configuration.search_api === "exa") {
    toolMap.exa_search = exaSearchTool;
  }

  // Execute all tool calls in parallel
  const toolExecutionPromises = toolCalls.map(async (toolCall) => {
    const toolName = toolCall.name;
    const tool = toolMap[toolName];

    if (!tool) {
      return new ToolMessage({
        tool_call_id: toolCall.id || "",
        content: `Error: Tool ${toolName} not found`,
      });
    }

    try {
      const result = await tool.invoke(toolCall.args, config);

      return new ToolMessage({
        tool_call_id: toolCall.id || "",
        content: String(result),
      });
    } catch (error) {
      return new ToolMessage({
        tool_call_id: toolCall.id || "",
        content: `Error executing ${toolName}: ${error}`,
      });
    }
  });

  const toolMessages = await Promise.all(toolExecutionPromises);

  // Extract raw notes from tool messages
  const newRawNotes = getNotesFromToolCalls(toolMessages);

  // Increment tool call iterations
  const newIterations = tool_call_iterations + 1;

  return {
    researcher_messages: toolMessages,
    tool_call_iterations: newIterations,
    raw_notes: newRawNotes,
  };
}
