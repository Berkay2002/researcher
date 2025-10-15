import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import type { ReactAgentState } from "@/server/agents/react/state";
import type { MessageData } from "@/types/ui";

const MILLISECONDS_TO_SECONDS = 1000;

/**
 * Transform React agent state messages to UI-compatible format
 *
 * Converts LangChain BaseMessage objects to MessageData format
 * used by ResearchMessage and other UI components.
 *
 * @param messages - Array of BaseMessage from agent state
 * @returns Array of MessageData for UI rendering
 *
 * @example
 * ```tsx
 * const messages = agentStateToMessages(state.values.messages);
 * ```
 */
export function agentStateToMessages(messages: BaseMessage[]): MessageData[] {
  return messages.map((msg, idx) => ({
    id: `msg-${idx}`,
    role: HumanMessage.isInstance(msg) ? "user" : "assistant",
    content:
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content),
    timestamp: new Date().toISOString(),
    // React agent doesn't have citations like researcher
    // Tool calls are tracked separately in recentToolCalls
  }));
}

/**
 * Extract breadcrumb trail from recent tool calls
 *
 * Converts recent tool execution metadata into a breadcrumb trail
 * showing the agent's execution path (e.g., "Search → Extract → Summarize").
 *
 * @param recentToolCalls - Tool call metadata from agent state
 * @returns Array of tool names for breadcrumb display
 *
 * @example
 * ```tsx
 * const breadcrumbs = agentStateToBreadcrumbs(state.values.recentToolCalls);
 * // ["tavily_search", "web_scraper", "text_extractor"]
 * ```
 */
export function agentStateToBreadcrumbs(
  recentToolCalls: ReactAgentState["recentToolCalls"]
): string[] {
  return recentToolCalls.map((tc) => tc.toolName);
}

/**
 * Format tool call for display in RunLog component
 *
 * Transforms tool call metadata into a human-readable format
 * for the execution log.
 *
 * @param toolCall - Tool call metadata
 * @returns Formatted string for display
 *
 * @example
 * ```tsx
 * const logEntry = formatToolCallForLog({
 *   toolName: "tavily_search",
 *   invokedAt: "2025-01-10T12:00:00Z",
 *   correlationId: "abc123"
 * });
 * // "🔧 tavily_search (12:00:00)"
 * ```
 */
export function formatToolCallForLog(
  toolCall: ReactAgentState["recentToolCalls"][number]
): string {
  const time = new Date(toolCall.invokedAt).toLocaleTimeString();
  return `🔧 ${toolCall.toolName} (${time})`;
}

/**
 * Format search run for display in RunLog component
 *
 * Transforms search metadata into a human-readable format
 * for the execution log.
 *
 * @param searchRun - Search run metadata
 * @returns Formatted string for display
 *
 * @example
 * ```tsx
 * const logEntry = formatSearchRunForLog({
 *   query: "React hooks tutorial",
 *   provider: "tavily",
 *   startedAt: "2025-01-10T12:00:00Z",
 *   completedAt: "2025-01-10T12:00:05Z"
 * });
 * // "🔍 [tavily] React hooks tutorial (5s)"
 * ```
 */
export function formatSearchRunForLog(
  searchRun: ReactAgentState["searchRuns"][number]
): string {
  const startTime = new Date(searchRun.startedAt).getTime();
  const endTime = searchRun.completedAt
    ? new Date(searchRun.completedAt).getTime()
    : Date.now();
  const durationSeconds = Math.round(
    (endTime - startTime) / MILLISECONDS_TO_SECONDS
  );

  return `🔍 [${searchRun.provider}] ${searchRun.query} (${durationSeconds}s)`;
}

/**
 * Check if agent execution is in progress
 *
 * Determines if the agent is currently executing based on
 * the thread state's next field (pending nodes to execute).
 *
 * @param next - Next nodes to execute from ThreadState
 * @returns True if execution is in progress
 *
 * @example
 * ```tsx
 * const isExecuting = isAgentExecuting(state.next);
 * if (isExecuting) {
 *   // Show loading spinner
 * }
 * ```
 */
export function isAgentExecuting(next: string[] | undefined): boolean {
  return Boolean(next && next.length > 0);
}

/**
 * Check if agent execution is completed
 *
 * Determines if the agent has finished executing (no more nodes to run).
 *
 * @param next - Next nodes to execute from ThreadState
 * @returns True if execution is completed
 *
 * @example
 * ```tsx
 * const isComplete = isAgentCompleted(state.next);
 * if (isComplete) {
 *   // Show completion message
 * }
 * ```
 */
export function isAgentCompleted(next: string[] | undefined): boolean {
  return next?.length === 0;
}
