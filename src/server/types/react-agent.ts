/**
 * React Agent Types
 *
 * Type definitions for the React agent implementation using LangGraph SDK.
 * These types define the state structure and metadata for the agent,
 * aligned with LangGraph SDK's message and state types.
 */

import type { Message } from "@langchain/langgraph-sdk";

export type TodoItem = {
  id: string;
  title: string;
  status: "pending" | "completed";
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

export type ToolCallMetadata = {
  toolName: string;
  invokedAt: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
};

export type SearchRunMetadata = {
  query: string;
  provider: "tavily" | "exa";
  startedAt: string;
  completedAt?: string;
  results?: number;
  error?: string;
};

export type ReactAgentContext = {
  sessionId?: string;
  userId?: string;
  locale?: string;
};

/**
 * React Agent State structure matching LangGraph SDK's ThreadState format.
 * This is the state shape that the agent graph maintains and streams to the frontend.
 */
export type ReactAgentState = {
  // SDK Message array - contains HumanMessage, AIMessage, ToolMessage, etc.
  messages: Message[];
  // Agent-specific state
  todos: TodoItem[];
  recentToolCalls: ToolCallMetadata[];
  searchRuns: SearchRunMetadata[];
  context?: ReactAgentContext;
};

/**
 * Type guard to check if a value is a valid ReactAgentState
 */
export function isReactAgentState(
  value: unknown
): value is ReactAgentState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Record<string, unknown>;

  return (
    Array.isArray(state.messages) &&
    Array.isArray(state.todos) &&
    Array.isArray(state.recentToolCalls) &&
    Array.isArray(state.searchRuns)
  );
}
