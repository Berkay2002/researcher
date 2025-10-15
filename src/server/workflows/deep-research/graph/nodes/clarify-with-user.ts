/**
 * Clarify With User Node
 *
 * Analyzes user messages and asks clarifying questions if the research scope is unclear.
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Command } from "@langchain/langgraph";
import { createLLM } from "@/server/shared/configs/llm";
import { getConfiguration } from "../../configuration";
import { clarifyWithUserInstructions } from "../../prompts";
import { getTodayStr } from "../../utils";
import type { AgentState } from "../state";
import { ClarifyWithUserSchema } from "../state";

/**
 * Analyze user messages and ask clarifying questions if the research scope is unclear.
 *
 * This function determines whether the user's request needs clarification before proceeding
 * with research. If clarification is disabled or not needed, it proceeds directly to research.
 */
export async function clarifyWithUser(
  state: AgentState,
  config?: RunnableConfig
): Promise<Command> {
  // Step 1: Check if clarification is enabled in configuration
  const configuration = getConfiguration(config);

  if (!configuration.allow_clarification) {
    // Skip clarification step and proceed directly to research
    return new Command({
      goto: "write_research_brief",
    });
  }

  // Step 2: Prepare the model for structured clarification analysis
  const messages = state.messages;

  // Configure model with structured output and retry logic
  const llm = createLLM(
    configuration.research_model,
    0, // temperature
    {
      maxTokens: configuration.research_model_max_tokens,
    }
  );

  const clarificationModel = llm.withStructuredOutput(ClarifyWithUserSchema, {
    method: "jsonMode",
  });

  // Step 3: Analyze whether clarification is needed
  const messagesBuffer = messages
    .map((msg) => `${msg._getType()}: ${msg.content}`)
    .join("\n");

  const promptContent = clarifyWithUserInstructions
    .replace("{messages}", messagesBuffer)
    .replace("{date}", getTodayStr());

  const response = await clarificationModel.invoke([
    new HumanMessage({ content: promptContent }),
  ]);

  // Step 4: Route based on clarification analysis
  if (response.need_clarification) {
    // End with clarifying question for user
    return new Command({
      goto: "__end__",
      update: {
        messages: [new AIMessage({ content: response.question })],
      },
    });
  }

  // Proceed to research with verification message
  return new Command({
    goto: "write_research_brief",
    update: {
      messages: [new AIMessage({ content: response.verification })],
    },
  });
}
