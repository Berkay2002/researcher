import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import type {
  SearchRunMetadata,
  ToolCallMetadata,
} from "../../../types/react-agent";
import { createResearchSubagent } from "../subgraphs/research";

const researchAgent = createResearchSubagent();

const ResearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Detailed research prompt to send to the subagent"),
});

type RecentToolState = {
  recentToolCalls?: ToolCallMetadata[];
};

type ObservationState = {
  searchRuns?: SearchRunMetadata[];
};

const serializeContent = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text: unknown }).text ?? "");
        }
        return JSON.stringify(part);
      })
      .join("\n");
  }
  if (content === null || content === undefined) {
    return "";
  }
  return JSON.stringify(content);
};

export function createResearchSubagentTool() {
  return tool(
    async (input, config) => {
      const args = ResearchInputSchema.parse(input);
      const startedAt = new Date().toISOString();
      const result = await researchAgent.invoke(
        { messages: [new HumanMessage(args.query)] },
        { context: config?.context }
      );
      const completedAt = new Date().toISOString();
      const recentState = getCurrentTaskInput<RecentToolState>();
      const lastMessage = result.messages.at(-1);
      const observationPayload = {
        query: args.query,
        completedAt,
        response: serializeContent(lastMessage?.content),
        searchRuns: (result as ObservationState).searchRuns ?? [],
      };
      const toolCallId =
        config.toolCall?.id ?? `research-subagent-${Date.now()}`;
      const metadata = {
        toolName: "research_subagent",
        invokedAt: startedAt,
        correlationId: toolCallId,
      } satisfies ToolCallMetadata;
      return new Command({
        update: {
          recentToolCalls: [...(recentState.recentToolCalls ?? []), metadata],
          messages: [
            new ToolMessage({
              content: JSON.stringify(observationPayload),
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "research_subagent",
      description:
        "Escalate to the dedicated research agent for multi-step investigations.",
      schema: ResearchInputSchema,
    }
  );
}
