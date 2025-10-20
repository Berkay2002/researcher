/**
 * Answer Follow-up Node
 *
 * Handles follow-up questions about existing research reports using the
 * existing report as context and optionally using search tools for
 * verification or updates.
 */

import {
  AIMessage,
  coerceMessageLikeToMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentMiddleware } from "langchain";
import {
  ClearToolUsesEdit,
  contextEditingMiddleware,
  createAgent,
  toolCallLimitMiddleware,
} from "langchain";
import { createSearchTools } from "@/server/agents/react/tools/search";
import { createFollowupModel, getConfiguration } from "../../configuration";
import { answerFollowupPrompt } from "../../prompts";
import { getTodayStr } from "../../utils";
import type { AgentState, SourceMetadata } from "../state";

// Regex patterns for citation extraction and source parsing
const CITATION_NUMBER_REGEX = /\[(\d+)\]/g;
const SOURCES_SECTION_REGEX = /###\s*Sources\s*([\s\S]*?)$/i;
const SOURCE_HEADER_REGEX = /---\s*SOURCE\s+(\d+):\s*(.+?)\s*---/gi;
const URL_LINE_REGEX = /^URL:\s*(.+)$/im;

/**
 * Extract citation information from the final report
 * Returns the highest citation number used and a list of citation entries
 */
function extractCitationsFromReport(finalReport: string | null): {
  maxCitationNumber: number;
  citationList: string;
} {
  if (!finalReport) {
    return { maxCitationNumber: 0, citationList: "" };
  }

  // Match citations in format [1], [2], etc.
  const citationMatches = finalReport.match(CITATION_NUMBER_REGEX);
  if (!citationMatches || citationMatches.length === 0) {
    return { maxCitationNumber: 0, citationList: "" };
  }

  // Extract all citation numbers
  const citationNumbers = citationMatches
    .map((match) => Number.parseInt(match.slice(1, -1), 10))
    .filter((num) => !Number.isNaN(num));

  const maxNumber = Math.max(...citationNumbers, 0);

  // Extract the Sources section from the report
  const sourcesMatch = finalReport.match(SOURCES_SECTION_REGEX);
  const citationList = sourcesMatch ? sourcesMatch[1].trim() : "";

  return {
    maxCitationNumber: maxNumber,
    citationList,
  };
}

/**
 * Extract sources from tool messages (for NEW searches in follow-ups)
 * Returns array of SourceMetadata with pristine URLs
 */
function extractSourcesFromToolMessages(messages: unknown[]): SourceMetadata[] {
  const sources: SourceMetadata[] = [];

  for (const msg of messages) {
    if (ToolMessage.isInstance(msg)) {
      const content = String(msg.content);

      // Extract sources from: --- SOURCE 1: Title ---\nURL: https://...
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

          sources.push({
            url,
            title: title || "Untitled Source",
          });
        }

        match = SOURCE_HEADER_REGEX.exec(content);
      }
    }
  }

  return sources;
}

/**
 * Answer follow-up questions about existing research using an agent with search tools
 */
export async function answerFollowup(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const configuration = getConfiguration(config);

  // Get the latest user message
  const messages = state.messages;
  const convertedMessages = messages.map((msg) =>
    coerceMessageLikeToMessage(msg)
  );

  const latestHumanMessage = convertedMessages
    .slice()
    .reverse()
    .find((msg) => HumanMessage.isInstance(msg));

  if (!latestHumanMessage) {
    return {
      messages: [
        new AIMessage({
          content: "No question found to answer.",
        }),
      ],
    };
  }

  // Extract the message content properly using .text property
  const latestMessageContent = latestHumanMessage.text;

  // Extract existing citations from the final report to maintain citation continuity
  const existingCitations = extractCitationsFromReport(state.final_report);

  // Create the model for follow-up handling
  const model = createFollowupModel(config);

  // Create search tools (same as researchers use)
  const searchTools = createSearchTools();

  // Prepare middleware
  // biome-ignore lint/suspicious/noExplicitAny: <Matches langchain middleware return type>
  const middleware: AgentMiddleware<undefined, undefined, any>[] = [];

  if (configuration.use_tool_call_limit) {
    // Limit search tool usage for follow-ups (they should primarily use existing report)
    middleware.push(
      toolCallLimitMiddleware({
        toolName: "tavily_search",
        threadLimit: 5, // Lower limit than full research
        runLimit: 3,
        exitBehavior: "end",
      })
    );
    middleware.push(
      toolCallLimitMiddleware({
        toolName: "exa_search",
        threadLimit: 5,
        runLimit: 3,
        exitBehavior: "end",
      })
    );
  }

  if (configuration.use_context_editing) {
    middleware.push(
      contextEditingMiddleware({
        edits: [new ClearToolUsesEdit({})],
      })
    );
  }

  // Create agent with search tools
  const agent = createAgent({
    model,
    tools: searchTools,
    middleware,
  });

  // Build the system prompt with context from existing research
  // Include citation information so the agent knows which numbers are already used
  let systemPrompt = answerFollowupPrompt
    .replace("{research_brief}", state.research_brief || "Not available")
    .replace("{final_report}", state.final_report || "Not available")
    .replace("{latest_message}", latestMessageContent)
    .replace("{date}", getTodayStr());

  // Add citation context if there are existing citations
  if (existingCitations.maxCitationNumber > 0) {
    const citationContext = `\n\n<Existing Citations from Original Report>
The original report uses citations [1] through [${existingCitations.maxCitationNumber}].
If you add NEW information from search tools, start your new citations at [${existingCitations.maxCitationNumber + 1}].

Original report's sources section:
${existingCitations.citationList}
</Existing Citations from Original Report>`;
    systemPrompt += citationContext;
  }

  // Build messages for the agent
  const agentMessages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: latestMessageContent,
    },
  ];

  // Invoke the agent
  const response = await agent.invoke({ messages: agentMessages }, config);

  // Extract sources from tool messages (NEW searches in this follow-up)
  const newSources = extractSourcesFromToolMessages(response.messages);

  // Extract the final AI message from the response
  const aiMessages = response.messages.filter((msg) =>
    AIMessage.isInstance(msg)
  );
  let finalMessage =
    aiMessages.length > 0
      ? // biome-ignore lint/style/noNonNullAssertion: Length check guarantees this exists
        aiMessages.at(-1)!
      : new AIMessage({
          content: "I was unable to answer your follow-up question.",
        });

  // If there are NEW sources from searches, append them with pristine URLs
  if (newSources.length > 0) {
    let content = String(finalMessage.content);

    // Remove any LLM-generated Sources section
    content = content.replace(SOURCES_SECTION_REGEX, "").trim();

    // Append structured sources section
    content += "\n\n### Sources\n\n";

    // Start numbering from where original report left off
    const startNum = existingCitations.maxCitationNumber + 1;

    for (const [index, source] of newSources.entries()) {
      const citationNum = startNum + index;
      content += `- [${citationNum}] ${source.title}: ${source.url}\n`;
    }

    // Create new message with updated content
    finalMessage = new AIMessage({
      content,
      additional_kwargs: finalMessage.additional_kwargs,
      response_metadata: finalMessage.response_metadata,
    });
  }

  // Return the answer without modifying research state
  return {
    messages: [finalMessage],
  };
}
