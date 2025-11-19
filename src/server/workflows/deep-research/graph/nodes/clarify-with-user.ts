/**
 * Clarify With User Node
 *
 * Analyzes user messages and asks clarifying questions if the research scope is unclear.
 */
/** biome-ignore-all lint/style/useBlockStatements: <> */

import {
  AIMessage,
  coerceMessageLikeToMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Command } from "@langchain/langgraph";
import {
  createClarificationModel,
  getConfiguration,
} from "../../configuration";
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
  const clarificationModel = createClarificationModel(
    config
  ).withStructuredOutput(ClarifyWithUserSchema, {
    method: "functionCalling",
    includeRaw: false,
  });

  // Step 3: Analyze whether clarification is needed
  // Convert plain message objects to proper LangChain message instances
  const convertedMessages = messages.map((msg) =>
    coerceMessageLikeToMessage(msg)
  );

  const messagesBuffer = convertedMessages
    .map((msg) => {
      let type = "unknown";
      if (HumanMessage.isInstance(msg)) type = "human";
      else if (AIMessage.isInstance(msg)) type = "ai";
      return `${type}: ${msg.text}`;
    })
    .join("\n");

  const promptContent = clarifyWithUserInstructions
    .replace("{messages}", messagesBuffer)
    .replace("{date}", getTodayStr());

  const response = await clarificationModel.invoke([
    new HumanMessage({ content: promptContent }),
  ]);

  if (response.need_clarification) {
    // Step 4: Route based on clarification analysis
    // End with clarifying question for user
    const questionMessage = new AIMessage({
      content: response.question,
      response_metadata: {
        model_name: configuration.clarification_model,
      },
    });
    return new Command({
      goto: "__end__",
      update: {
        messages: [questionMessage],
      },
    });
  }

  // Proceed to research with verification message
  const verificationMessage = new AIMessage({
    content: response.verification,
    response_metadata: {
      model_name: configuration.clarification_model,
    },
  });
  // biome-ignore lint/suspicious/noConsole: <Needed for debugging>
  console.log("Returning verification message:", verificationMessage.content);
  return new Command({
    goto: "write_research_brief",
    update: {
      messages: [verificationMessage],
    },
  });
}
