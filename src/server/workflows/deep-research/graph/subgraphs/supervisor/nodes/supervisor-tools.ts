/**
 * Supervisor Tools Node
 *
 * Executes research delegation by spawning parallel researcher subgraphs.
 */

import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { getConfiguration } from "../../../../configuration";
import type { SourceMetadata, SupervisorState } from "../../../../graph/state";
import { createResearcherGraph } from "../../researcher";

/**
 * Execute ConductResearch tool calls by spawning researchers
 */
export async function supervisorTools(
  state: SupervisorState,
  config?: RunnableConfig
): Promise<Partial<SupervisorState>> {
  const configuration = getConfiguration(config);
  const { supervisor_messages } = state;

  // Get the last AI message with tool calls
  const lastMessage = supervisor_messages.at(-1);

  if (!(lastMessage instanceof AIMessage)) {
    throw new Error("Last message is not an AIMessage");
  }

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    throw new Error("No tool calls found in last message");
  }

  const toolCalls = lastMessage.tool_calls;

  // Separate tool calls
  const researchCalls = toolCalls.filter(
    (call: { name: string }) => call.name === "ConductResearch"
  );
  const thinkCalls = toolCalls.filter(
    (call: { name: string }) => call.name === "think_tool"
  );

  // Limit parallel research to max_concurrent_research_units
  const limitedResearchCalls = researchCalls.slice(
    0,
    configuration.max_concurrent_research_units
  );

  // Create researcher subgraph
  const researcherGraph = createResearcherGraph();

  // Execute research tasks in parallel
  const researchPromises = limitedResearchCalls.map(
    async (toolCall: {
      id?: string;
      name: string;
      args: Record<string, unknown>;
    }) => {
      const { research_topic } = toolCall.args as { research_topic: string };

      try {
        // Invoke researcher subgraph with research topic
        const result = await researcherGraph.invoke(
          {
            research_topic,
            researcher_messages: [],
            compressed_research: null,
            raw_notes: [],
          },
          config
        );

        // Return tool message with compressed research
        return {
          toolMessage: new ToolMessage({
            tool_call_id: toolCall.id || "",
            content: result.compressed_research || "No research completed",
          }),
          rawNotes: result.raw_notes || [],
          sources: result.sources || [],
        };
      } catch (error) {
        return {
          toolMessage: new ToolMessage({
            tool_call_id: toolCall.id || "",
            content: `Error conducting research on "${research_topic}": ${error}`,
          }),
          rawNotes: [],
          sources: [],
        };
      }
    }
  );

  // Execute think tasks
  const thinkResults = thinkCalls.map(
    (toolCall: {
      id?: string;
      name: string;
      args: Record<string, unknown>;
    }) => {
      const { reflection } = toolCall.args as { reflection: string };
      return {
        toolMessage: new ToolMessage({
          tool_call_id: toolCall.id || "",
          content: `Reflection recorded: ${reflection}`,
        }),
        rawNotes: [],
        sources: [],
      };
    }
  );

  const researchResults = await Promise.all(researchPromises);
  const allResults = [...researchResults, ...thinkResults];

  // Extract tool messages and raw notes
  const toolMessages = allResults.map(
    (r: {
      toolMessage: ToolMessage;
      rawNotes: string[];
      sources: SourceMetadata[];
    }) => r.toolMessage
  );
  const allRawNotes = allResults.flatMap(
    (r: {
      toolMessage: ToolMessage;
      rawNotes: string[];
      sources: SourceMetadata[];
    }) => r.rawNotes
  );
  const allSources = allResults.flatMap(
    (r: {
      toolMessage: ToolMessage;
      rawNotes: string[];
      sources: SourceMetadata[];
    }) => r.sources
  );

  // Collect notes from compressed research (only from research results)
  const notes = researchResults
    .map((r: { toolMessage: ToolMessage; rawNotes: string[] }) => {
      const content = r.toolMessage.content;
      // Handle both string and array content types
      if (typeof content === "string") {
        return content;
      }
      // For array content, extract text from each block
      if (Array.isArray(content)) {
        return content
          .map((block) => {
            if (typeof block === "string") {
              return block;
            }
            // Handle message content blocks with text property
            if ("text" in block && typeof block.text === "string") {
              return block.text;
            }
            return "";
          })
          .join("");
      }
      return "";
    })
    .filter(
      (content: string) => content && content !== "No research completed"
    );

  return {
    supervisor_messages: toolMessages,
    notes,
    raw_notes: allRawNotes,
    sources: allSources,
  };
}