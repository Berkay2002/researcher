import { MessagesZodState } from "@langchain/langgraph";
import { z } from "zod";
import {
  SearchRunMetadataSchema,
  TodoItemSchema,
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

export const ReactAgentStateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  todos: z.array(TodoItemSchema).default([]),
  context: AgentContextSchema,
  recentToolCalls: z.array(ToolCallMetadataSchema).default([]),
  searchRuns: z.array(SearchRunMetadataSchema).default([]),
});

export type ReactAgentState = z.infer<typeof ReactAgentStateSchema>;
