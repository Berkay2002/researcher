import { z } from "zod";

// ============================================================================
// ReAct Agent Shared Types
// ============================================================================

export const TodoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "completed"]),
  notes: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable().optional(),
});

export const ToolCallMetadataSchema = z.object({
  toolName: z.string(),
  invokedAt: z.string(),
  correlationId: z.string().optional(),
});

export const SearchRunMetadataSchema = z.object({
  query: z.string(),
  provider: z.enum(["tavily", "exa"]),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;
export type ToolCallMetadata = z.infer<typeof ToolCallMetadataSchema>;
export type SearchRunMetadata = z.infer<typeof SearchRunMetadataSchema>;
