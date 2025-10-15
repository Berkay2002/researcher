/**
 * Final Report Generation Node
 *
 * Generate the final comprehensive research report with retry logic for token limits.
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentMiddleware } from "langchain";
import { createAgent, modelFallbackMiddleware } from "langchain";
import { getConfiguration } from "../../configuration";
import type { AgentState } from "../state";

/**
 * Generate the final comprehensive research report using agent with model fallback middleware.
 *
 * This function takes all collected research findings and synthesizes them into a
 * well-structured, comprehensive final report using the configured report generation model.
 * The model fallback middleware automatically handles token limit errors by retrying
 * with fallback models.
 */
export async function finalReportGeneration(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  // Step 1: Prepare state cleanup
  const clearedState = {
    notes: { type: "override", value: [] } as unknown as string[],
  };

  // Step 2: Configure the final report generation model
  const configuration = getConfiguration(config);

  const primaryModel = configuration.final_report_model;

  // Step 3: Prepare middleware for model fallback
  // biome-ignore lint/suspicious/noExplicitAny: <Different middleware types have different schemas>
  const middleware: AgentMiddleware<undefined, undefined, any>[] = [];

  if (
    configuration.use_model_fallback &&
    configuration.fallback_models.length > 0
  ) {
    middleware.push(modelFallbackMiddleware(...configuration.fallback_models));
  }

  // Step 4: Create agent with middleware
  const agent = createAgent({
    model: primaryModel,
    middleware,
  });

  // Step 5: Create messages buffer for context
  const messagesBuffer = state.messages
    .map((msg) => {
      let type = "unknown";
      if (HumanMessage.isInstance(msg)) type = "human";
      else if (AIMessage.isInstance(msg)) type = "ai";
      return `${type}: ${msg.content}`;
    })
    .join("\n");

  // Step 6: Invoke agent to generate the final report
  try {
    const response = await agent.invoke(
      {
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant. Generate a comprehensive research report based on the provided context.",
          },
          {
            role: "user",
            content: `Generate a comprehensive research report based on the following context:\n\n${messagesBuffer}`,
          },
        ],
      },
      config
    );

    // Return successful report generation
    const lastMessage = response.messages?.at(-1);
    const finalReportContent =
      lastMessage?.content || "Report generation completed.";

    return {
      final_report: String(finalReportContent),
      messages: response.messages || [
        new AIMessage({ content: finalReportContent }),
      ],
      ...clearedState,
    };
  } catch (error) {
    const err = error as Error;

    // Handle any remaining errors that middleware couldn't handle
    return {
      final_report: `Error generating final report: ${err.message}`,
      messages: [
        new AIMessage({
          content: "Report generation failed due to an error",
        }),
      ],
      ...clearedState,
    };
  }
}
