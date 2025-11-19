/**
 * Final Report Generation Node
 *
 * Generate the final comprehensive research report with retry logic for token limits.
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentMiddleware } from "langchain";
import { createAgent, modelFallbackMiddleware } from "langchain";
import { createFinalReportModel, getConfiguration } from "../../configuration";
import { finalReportGenerationPrompt } from "../../prompts";
import { getTodayStr } from "../../utils";
import type { AgentState } from "../state";

/**
 * Generate the final comprehensive research report using agent with model fallback middleware.
 *
 * This function takes all collected research findings and synthesizes them into a
 * well-structured, comprehensive final report using the configured report generation model.
 * The model fallback middleware automatically handles token limit errors by retrying
 * with fallback models.
 *
 * @param state - The current state of the agent
 * @param config - The configuration for the final report generation
 * @returns A partial state update for the agent
 */
export async function finalReportGeneration(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  // Step 1: Prepare state cleanup
  const clearedState = {
    notes: { type: "override", value: [] } as unknown as string[],
  };

  // Step 2: Configure the final report generation model with tracing
  const configuration = getConfiguration(config);

  const primaryModel = createFinalReportModel(config);

  // Step 3: Prepare middleware for model fallback
  // biome-ignore lint/suspicious/noExplicitAny: <Different middleware types have different schemas>
  const middleware: AgentMiddleware<any, any, any>[] = [];

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
      if (HumanMessage.isInstance(msg)) {
        type = "human";
      } else if (AIMessage.isInstance(msg)) {
        type = "ai";
      }
      return `${type}: ${msg.content}`;
    })
    .join("\n");

  // Step 6: Prepare findings from research notes
  const findings = state.notes.join("\n\n---\n\n");

  // Step 7: Build the final report prompt with proper date injection
  const promptContent = finalReportGenerationPrompt
    .replace("{research_brief}", state.research_brief || "")
    .replace("{messages}", messagesBuffer)
    .replace(/{date}/g, getTodayStr()) // Replace all occurrences of {date}
    .replace("{findings}", findings);

  // Step 8: Invoke agent to generate the final report
  try {
    const response = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
      },
      config
    );

    // Return successful report generation
    const lastMessage = response.messages?.at(-1);
    let finalReportContent =
      String(lastMessage?.content) || "Report generation completed.";

    // Step 9: Append structured sources section with pristine URLs
    if (state.sources && state.sources.length > 0) {
      finalReportContent += "\n\n### Sources\n\n";

      for (const [index, source] of state.sources.entries()) {
        const citationNum = index + 1;
        finalReportContent += `- [${citationNum}] ${source.title}: ${source.url}\n`;
      }
    }

    return {
      final_report: finalReportContent,
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
