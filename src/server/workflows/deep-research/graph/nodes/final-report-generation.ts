/**
 * Final Report Generation Node
 *
 * Generate the final comprehensive research report with retry logic for token limits.
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createLLM } from "@/server/shared/configs/llm";
import { getConfiguration } from "../../configuration";
import { finalReportGenerationPrompt } from "../../prompts";
import {
  getModelTokenLimit,
  getTodayStr,
  isTokenLimitExceeded,
} from "../../utils";
import type { AgentState } from "../state";

const MAX_RETRIES = 3;
const TOKEN_TO_CHAR_MULTIPLIER = 4; // Approximate 4 chars per token
const RETRY_REDUCTION_FACTOR = 0.9; // Reduce by 10% each retry

/**
 * Generate the final comprehensive research report with retry logic for token limits.
 *
 * This function takes all collected research findings and synthesizes them into a
 * well-structured, comprehensive final report using the configured report generation model.
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: It is fine
export async function finalReportGeneration(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  // Step 1: Extract research findings and prepare state cleanup
  const notes = state.notes ?? [];
  const clearedState = {
    notes: { type: "override", value: [] } as unknown as string[],
  };
  let findings = notes.join("\n");

  // Step 2: Configure the final report generation model
  const configuration = getConfiguration(config);

  const writerModel = createLLM(
    configuration.final_report_model,
    0, // temperature
    {
      maxTokens: configuration.final_report_model_max_tokens,
    }
  );

  // Step 3: Attempt report generation with token limit retry logic
  let currentRetry = 0;
  let findingsTokenLimit: number | null = null;

  while (currentRetry <= MAX_RETRIES) {
    try {
      // Create comprehensive prompt with all research context
      const messagesBuffer = state.messages
        .map((msg) => `${msg._getType()}: ${msg.content}`)
        .join("\n");

      const finalReportPrompt = finalReportGenerationPrompt
        .replace("{research_brief}", state.research_brief ?? "")
        .replace("{messages}", messagesBuffer)
        .replace("{findings}", findings)
        .replace("{date}", getTodayStr());

      // Generate the final report
      const finalReport = await writerModel.invoke([
        new HumanMessage({ content: finalReportPrompt }),
      ]);

      // Return successful report generation
      return {
        final_report: String(finalReport.content),
        messages: [finalReport],
        ...clearedState,
      };
    } catch (error) {
      const err = error as Error;

      // Handle token limit exceeded errors with progressive truncation
      if (isTokenLimitExceeded(err, configuration.final_report_model)) {
        currentRetry++;

        if (currentRetry === 1) {
          // First retry: determine initial truncation limit
          const modelTokenLimit = getModelTokenLimit(
            configuration.final_report_model
          );

          if (!modelTokenLimit) {
            return {
              final_report: `Error generating final report: Token limit exceeded, however, we could not determine the model's maximum context length. ${err.message}`,
              messages: [
                new AIMessage({
                  content: "Report generation failed due to token limits",
                }),
              ],
              ...clearedState,
            };
          }

          // Use 4x token limit as character approximation for truncation
          findingsTokenLimit = modelTokenLimit * TOKEN_TO_CHAR_MULTIPLIER;
        } else {
          // Subsequent retries: reduce by 10% each time
          findingsTokenLimit = Math.floor(
            (findingsTokenLimit ?? 0) * RETRY_REDUCTION_FACTOR
          );
        }

        // Truncate findings and retry
        findings = findings.slice(0, findingsTokenLimit);
        continue;
      }

      // Non-token-limit error: return error immediately
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

  // Step 4: Return failure result if all retries exhausted
  return {
    final_report: "Error generating final report: Maximum retries exceeded",
    messages: [
      new AIMessage({
        content: "Report generation failed after maximum retries",
      }),
    ],
    ...clearedState,
  };
}
