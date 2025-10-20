/**
 * Compress Research Node
 *
 * Compresses and cleans up research findings from the researcher's tool calls.
 * Preserves all relevant information while removing duplicates and irrelevant content.
 */
/** biome-ignore-all lint/style/useBlockStatements: <> */

import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { createCompressionModel } from "../../../../configuration";
import {
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
} from "../../../../prompts";
import { getTodayStr } from "../../../../utils";
import type { ResearcherState, SourceMetadata } from "../../../state";

// Regex patterns for extracting sources from tool messages
const SOURCE_HEADER_REGEX = /---\s*SOURCE\s+(\d+):\s*(.+?)\s*---/gi;
const URL_LINE_REGEX = /^URL:\s*(.+)$/im;

/**
 * Compress research findings into a clean, comprehensive format
 */
export async function compressResearch(
  state: ResearcherState,
  config?: RunnableConfig
): Promise<Partial<ResearcherState>> {
  const { researcher_messages } = state;

  // Step 1: Extract sources from tool messages BEFORE compression
  const sources: SourceMetadata[] = [];

  for (const msg of researcher_messages) {
    if (ToolMessage.isInstance(msg)) {
      const content = String(msg.content);

      // Extract all sources from this tool message
      // Format: --- SOURCE 1: Title ---\nURL: https://...\n

      // Reset regex state
      SOURCE_HEADER_REGEX.lastIndex = 0;

      let match = SOURCE_HEADER_REGEX.exec(content);
      while (match !== null) {
        const title = match[2]?.trim();

        // Find the URL line after this source header
        const startPos = match.index + match[0].length;
        const remainingContent = content.slice(startPos);
        const urlMatch = remainingContent.match(URL_LINE_REGEX);

        if (urlMatch?.[1]) {
          const url = urlMatch[1].trim();

          // Add source with pristine URL
          sources.push({
            url,
            title: title || "Untitled Source",
          });
        }

        match = SOURCE_HEADER_REGEX.exec(content);
      }
    }
  }

  // Step 2: Configure compression model
  const compressionModel = createCompressionModel(config);

  // Step 3: Build compression prompt
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

  // Step 4: Invoke compression model (only compresses text, not sources)
  const response = await compressionModel.invoke(messages);

  // Extract compressed research
  const compressedResearch = String(response.content);

  // Step 5: Return compressed text AND pristine sources
  return {
    compressed_research: compressedResearch,
    sources, // Pristine sources extracted before LLM processing
    raw_notes: [], // Keep empty, sources now tracked separately
  };
}
