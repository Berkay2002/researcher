/**
 * Researcher Node
 *
 * Individual researcher agent that conducts focused research on a specific topic.
 * Uses LLM with tool calling to search and gather information.
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createLLM } from "@/server/shared/configs/llm";
import { getConfiguration } from "../../../../configuration";
import { researchSystemPrompt } from "../../../../prompts";
import {
  exaSearchTool,
  getTodayStr,
  tavilySearchTool,
  thinkTool,
} from "../../../../utils";
import type { ResearcherStateAnnotation } from "../../../state";

type ResearcherState = typeof ResearcherStateAnnotation.State;

const DEFAULT_RESEARCH_TEMPERATURE = 0.3;

/**
 * Researcher node that conducts research using tool calls
 */
export async function researcher(
  state: ResearcherState,
  config?: RunnableConfig
): Promise<Partial<ResearcherState>> {
  const configuration = getConfiguration(config);
  const { research_topic, researcher_messages } = state;

  // Configure LLM with tools
  const model = createLLM(
    configuration.research_model,
    DEFAULT_RESEARCH_TEMPERATURE,
    {
      maxTokens: configuration.research_model_max_tokens,
    }
  );

  // Bind tools based on search API configuration
  // Add search tool based on configuration and bind to model
  const modelWithTools = (() => {
    if (configuration.search_api === "tavily") {
      return model.bindTools([thinkTool, tavilySearchTool]);
    }
    if (configuration.search_api === "exa") {
      return model.bindTools([thinkTool, exaSearchTool]);
    }
    return model.bindTools([thinkTool]);
  })();

  // Prepare system prompt with research topic and date
  const systemPrompt = researchSystemPrompt
    .replace("{date}", getTodayStr())
    .replace("{mcp_prompt}", configuration.mcp_prompt || "");

  // Build messages array with system prompt
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `Research topic: ${research_topic}`,
    },
    ...researcher_messages,
  ];

  // Invoke model
  const response = await modelWithTools.invoke(messages);

  // Check if response has tool calls
  const _hasToolCalls =
    response.additional_kwargs?.tool_calls &&
    response.additional_kwargs.tool_calls.length > 0;

  // Return updated state with new message
  return {
    researcher_messages: [new AIMessage(response)],
  };
}
