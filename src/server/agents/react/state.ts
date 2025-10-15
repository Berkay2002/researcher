import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";
import {
  SearchRunMetadataSchema,
  ToolCallMetadataSchema,
} from "../../types/react-agent";

// ============================================================================
// ReAct Agent Graph State Schema
// ============================================================================

const AgentContextSchema = z
  .object({
    sessionId: z.string(),
    userId: z.string().optional(),
    locale: z.string().optional(),
  })
  .optional();

export const ReactAgentStateSchema = z
  .object({
    messages: MessagesZodState.shape.messages,
    // Note: todoListMiddleware will add its own todos field
    context: AgentContextSchema,
    recentToolCalls: z.array(ToolCallMetadataSchema).default([]),
    searchRuns: z.array(SearchRunMetadataSchema).default([]),
  })
  .passthrough(); // Allow todoListMiddleware to add its own fields

export type ReactAgentState = z.infer<typeof ReactAgentStateSchema>;
