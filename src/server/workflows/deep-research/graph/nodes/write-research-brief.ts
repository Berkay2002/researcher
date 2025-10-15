/**
 * Write Research Brief Node
 *
 * Transform user messages into a structured research brief and initialize supervisor.
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { getConfiguration } from "../../configuration";
import {
  leadResearcherPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "../../prompts";
import { getTodayStr } from "../../utils";
import type { AgentState } from "../state";
import { ResearchQuestionSchema } from "../state";

/**
 * Transform user messages into a structured research brief and initialize supervisor.
 *
 * This function analyzes the user's messages and generates a focused research brief
 * that will guide the research supervisor. It also sets up the initial supervisor
 * context with appropriate prompts and instructions.
 */
export async function writeResearchBrief(
  state: AgentState,
  config?: RunnableConfig
): Promise<Command> {
  // Step 1: Set up the research model for structured output
  const configuration = getConfiguration(config);

  // Configure model for structured research question generation
  const researchModel = new ChatOpenAI({
    modelName: configuration.research_model,
    maxTokens: configuration.research_model_max_tokens,
    temperature: 0,
  }).withStructuredOutput(ResearchQuestionSchema, {
    method: "jsonMode",
  });

  // Step 2: Generate structured research brief from user messages
  const messagesBuffer = state.messages
    .map((msg) => `${msg._getType()}: ${msg.content}`)
    .join("\n");

  const promptContent = transformMessagesIntoResearchTopicPrompt
    .replace("{messages}", messagesBuffer)
    .replace("{date}", getTodayStr());

  const response = await researchModel.invoke([
    new HumanMessage({ content: promptContent }),
  ]);

  // Step 3: Initialize supervisor with research brief and instructions
  const supervisorSystemPrompt = leadResearcherPrompt
    .replace("{date}", getTodayStr())
    .replace(
      "{max_concurrent_research_units}",
      String(configuration.max_concurrent_research_units)
    )
    .replace(
      "{max_researcher_iterations}",
      String(configuration.max_researcher_iterations)
    );

  return new Command({
    goto: "research_supervisor",
    update: {
      research_brief: response.research_brief,
      supervisor_messages: {
        type: "override",
        value: [
          new SystemMessage({ content: supervisorSystemPrompt }),
          new HumanMessage({ content: response.research_brief }),
        ],
      },
    },
  });
}
