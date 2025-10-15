import type { ThreadState } from "@langchain/langgraph-sdk";
import type { ReactAgentState } from "@/server/agents/react/state";

/**
 * Thread state type for React agent (SDK-based)
 */
export type AgentThreadState = ThreadState<ReactAgentState>;

/**
 * Message format compatible with UI components
 *
 * Used by ResearchMessage and conversation components.
 * Transformed from LangChain BaseMessage via agentStateToMessages().
 */
export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    id: string;
    tool: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
};

/**
 * Todo item for agent task tracking
 *
 * Displayed in the UI to show agent progress and completed tasks.
 */
export type AgentTodo = {
  id: string;
  title: string;
  status: "pending" | "completed";
  notes?: string;
  createdAt: string;
  completedAt?: string | null;
};

/**
 * Tool call metadata for execution log
 *
 * Used to display breadcrumb trail and execution history.
 */
export type AgentToolCall = {
  toolName: string;
  invokedAt: string;
  correlationId?: string;
};

/**
 * Search run metadata for tracking queries
 *
 * Tracks search operations across Tavily and Exa providers.
 */
export type AgentSearchRun = {
  query: string;
  provider: "tavily" | "exa";
  startedAt: string;
  completedAt?: string;
};

/**
 * Agent execution status
 */
export type AgentStatus =
  | "idle" // Not started
  | "running" // Currently executing
  | "completed" // Finished successfully
  | "error" // Encountered an error
  | "interrupted"; // Paused for user input

/**
 * Run log entry for execution timeline
 *
 * Similar to researcher's run log but adapted for React agent.
 */
export type AgentRunLogEntry = {
  id: string;
  type: "tool" | "search" | "message" | "status";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};
