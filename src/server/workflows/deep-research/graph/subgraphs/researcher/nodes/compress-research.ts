/**
 * Compress Research Node
 *
 * Compresses and cleans up research findings from the researcher's tool calls.
 * Preserves all relevant information while removing duplicates and irrelevant content.
 */
/** biome-ignore-all lint/style/useBlockStatements: <> */

import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createLLM } from "@/server/shared/configs/llm";
import { getConfiguration } from "../../../../configuration";
import {
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
} from "../../../../prompts";
import { getTodayStr } from "../../../../utils";
import type { ResearcherState } from "../../../state";

const COMPRESSION_TEMPERATURE = 0.1; // Low temperature for quality

// Regex patterns for extracting sources from compressed research
const SOURCES_SECTION_REGEX = /###?\s*Sources[\s\S]*/i;
const SOURCE_LINE_REGEX = /^\[\d+\]/; // Lines starting with [1], [2], etc.

/**
 * Compress research findings into a clean, comprehensive format
 */
export async function compressResearch(
  state: ResearcherState,
  config?: RunnableConfig
): Promise<Partial<ResearcherState>> {
  const configuration = getConfiguration(config);
  const { researcher_messages } = state;

  // Configure compression model
  const compressionModel = createLLM(
    configuration.compression_model,
    COMPRESSION_TEMPERATURE,
    {
      maxTokens: configuration.compression_model_max_tokens,
    }
  );

  // Build compression prompt
  const systemPrompt = compressResearchSystemPrompt.replace(
    "{date}",
    getTodayStr()
  );

  // Include all researcher messages for context
  const messagesBuffer = researcher_messages
    .map((msg: BaseMessage) => {
      let role = "unknown";
      if (HumanMessage.isInstance(msg)) role = "human";
      else if (AIMessage.isInstance(msg)) role = "ai";
      return `${role}: ${msg.content}`;
    })
    .join("\n\n");

  // Build full prompt
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: messagesBuffer,
    },
    new HumanMessage({ content: compressResearchSimpleHumanMessage }),
  ];

  // Invoke compression model
  const response = await compressionModel.invoke(messages);

  // Extract compressed research
  const compressedResearch = String(response.content);

  // Extract sources/citations from the compressed research
  // Sources are typically listed at the end in a "Sources" section
  const rawNotes: string[] = [];

  // Try to extract individual sources from the compressed research
  const sourcesMatch = compressedResearch.match(SOURCES_SECTION_REGEX);
  if (sourcesMatch) {
    const sourcesSection = sourcesMatch[0];
    // Extract each source line
    const sourceLines = sourcesSection
      .split("\n")
      .filter((line) => line.trim().match(SOURCE_LINE_REGEX) !== null);
    rawNotes.push(...sourceLines);
  }

  return {
    compressed_research: compressedResearch,
    raw_notes: rawNotes,
  };
}
