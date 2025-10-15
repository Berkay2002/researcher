/**
 * Write Research Brief Node
 *
 * Transform user messages into a structured research brief and initialize supervisor.
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { Command } from "@langchain/langgraph";
import { createResearchBriefModel } from "../../configuration";
import { transformMessagesIntoResearchTopicPrompt } from "../../prompts";
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
  // Configure model for structured research question generation
  const researchModel = createResearchBriefModel(config).withStructuredOutput(
    ResearchQuestionSchema,
    {
      method: "jsonMode",
    }
  );

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

  // Step 3: Return research brief - supervisor will initialize its own messages
  return new Command({
    goto: "research_supervisor",
    update: {
      research_brief: response.research_brief,
      supervisor_messages: {
        type: "override",
        value: [], // Clear any existing messages - supervisor will initialize
      },
    },
  });
}
