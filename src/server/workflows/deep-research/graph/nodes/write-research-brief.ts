/**
 * Write Research Brief Node
 *
 * Transform user messages into a structured research brief and initialize supervisor.
 */

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Command } from "@langchain/langgraph";
import { createLLM } from "@/server/shared/configs/llm";
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
  const researchModel = createLLM(
    configuration.research_model,
    0, // temperature for consistent research brief generation
    {
      maxTokens: configuration.research_model_max_tokens,
    }
  ).withStructuredOutput(ResearchQuestionSchema, {
    method: "jsonMode",
  });

  // Step 2: Generate structured research brief from user messages
  const messagesBuffer = state.messages
    .map((msg) => {
      let type = "unknown";
      if (HumanMessage.isInstance(msg)) {
        type = "human";
      } else if (AIMessage.isInstance(msg)) {
        type = "ai";
      }
      return `${type}: ${msg.content}`;
    })
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
