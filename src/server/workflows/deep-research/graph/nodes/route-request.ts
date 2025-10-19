/**
 * Route Request Node
 *
 * Analyzes user messages to determine if this is a follow-up question about
 * existing research or a new research request, and routes accordingly.
 */

import {
  coerceMessageLikeToMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { interrupt } from "@langchain/langgraph";
import { createRoutingModel, getConfiguration } from "../../configuration";
import { routeRequestPrompt } from "../../prompts";
import { getTodayStr } from "../../utils";
import type { AgentState } from "../state";
import { RouteDecisionSchema } from "../state";

/**
 * Route user requests to either new research or follow-up handler
 *
 * This function analyzes the user's message and determines whether it's a
 * follow-up question about existing research or a new research request.
 * Uses interrupts when confidence is below threshold.
 */
export async function routeRequest(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const configuration = getConfiguration(config);

  // If routing is disabled, always route to new research
  if (!configuration.enable_followup_routing) {
    return {
      routing_decision: "NEW_RESEARCH",
    };
  }

  // If no existing report, this must be new research
  if (!state.final_report) {
    return {
      routing_decision: "NEW_RESEARCH",
    };
  }

  // Get the latest user message
  const messages = state.messages;
  const convertedMessages = messages.map((msg) =>
    coerceMessageLikeToMessage(msg)
  );

  // Find the most recent human message
  const latestHumanMessage = convertedMessages
    .slice()
    .reverse()
    .find((msg) => HumanMessage.isInstance(msg));

  if (!latestHumanMessage) {
    // No human message found, route to new research by default
    return {
      routing_decision: "NEW_RESEARCH",
    };
  }

  // Extract the message content properly (same as clarify-with-user does)
  // Use .text property which handles message content correctly
  const latestMessageContent = latestHumanMessage.text;

  // Prepare the routing model with structured output
  const routingModel = createRoutingModel(config).withStructuredOutput(
    RouteDecisionSchema,
    {
      method: "jsonMode",
      includeRaw: false,
    }
  );

  // Build the routing prompt
  const promptContent = routeRequestPrompt
    .replace("{has_report}", state.final_report ? "Yes" : "No")
    .replace("{research_brief}", state.research_brief || "None")
    .replace("{latest_message}", latestMessageContent)
    .replace("{date}", getTodayStr());

  // Get routing decision from LLM
  const response = await routingModel.invoke([
    new HumanMessage({ content: promptContent }),
  ]);

  // Check confidence threshold
  if (response.confidence < configuration.followup_confidence_threshold) {
    // Low confidence - interrupt and ask user
    const userChoice = interrupt({
      question:
        "I'm not sure if you're asking a follow-up question about the previous report or requesting new research. Which is it?",
      options: [
        {
          label: "Follow-up question about the previous report",
          value: "FOLLOW_UP",
        },
        { label: "New research request", value: "NEW_RESEARCH" },
      ],
      reasoning: response.reasoning,
    });

    return {
      routing_decision: userChoice as "FOLLOW_UP" | "NEW_RESEARCH",
    };
  }

  // High confidence - use the routing decision
  return {
    routing_decision: response.decision,
  };
}

/**
 * Conditional edge function that returns the node name to route to
 * based on the routing decision in state
 */
export function routeDecision(state: AgentState): string {
  if (state.routing_decision === "FOLLOW_UP") {
    return "answer_followup";
  }
  return "clarify_with_user";
}
