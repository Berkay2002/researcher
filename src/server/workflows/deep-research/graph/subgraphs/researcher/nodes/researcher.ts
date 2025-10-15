/**
 * Researcher Node
 *
 * Individual researcher agent that conducts focused research on a specific topic.
 * Uses LLM with tool calling to search and gather information.
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  ClearToolUsesEdit,
  contextEditingMiddleware,
  createAgent,
  toolCallLimitMiddleware,
} from "langchain";
import { getConfiguration } from "../../../../configuration";
import { researchSystemPrompt } from "../../../../prompts";
import { getTodayStr } from "../../../../utils";
import type { ResearcherStateAnnotation } from "../../../state";

type ResearcherState = typeof ResearcherStateAnnotation.State;

/**
 * Researcher node that conducts research using agent with middleware
 */
export async function researcher(
  state: ResearcherState,
  config?: RunnableConfig
): Promise<Partial<ResearcherState>> {
  const configuration = getConfiguration(config);
  const { research_topic, researcher_messages } = state;

  // Configure LLM
  const model: string = configuration.research_model;

  // Prepare system prompt with research topic and date
  const systemPrompt = researchSystemPrompt
    .replace("{date}", getTodayStr())
    .replace("{mcp_prompt}", configuration.mcp_prompt || "");

  // Prepare middleware
  // biome-ignore lint/suspicious/noEvolvingTypes: <Evolving based on config>
  const middleware = [];

  if (configuration.use_tool_call_limit) {
    middleware.push(
      toolCallLimitMiddleware({
        threadLimit: configuration.max_react_tool_calls,
        runLimit: Math.ceil(configuration.max_react_tool_calls / 2), // Allow multiple runs per thread
        exitBehavior: "end",
      })
    );
  }

  if (configuration.use_context_editing) {
    const CLEAR_THRESHOLD_PERCENT = 0.7; // Extract magic number to constant
    middleware.push(
      contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            maxTokens: Math.floor(
              configuration.research_model_max_tokens * CLEAR_THRESHOLD_PERCENT
            ),
          }),
        ],
      })
    );
  }

  // Create agent with middleware
  const agent = createAgent({
    model,
    middleware,
  });

  // Build initial messages
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

  // Invoke agent
  const response = await agent.invoke({ messages }, config);

  return {
    researcher_messages: response.messages || [
      new AIMessage({ content: "Research completed." }),
    ],
  };
}
