"use client";

import type { BaseMessage } from "@langchain/core/messages";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLangGraphClient } from "@/lib/langgraph-client";
import type { ReactAgentState } from "@/server/agents/react/state";

// Helper type to properly type the messages field from stream events
// MessagesZodState.shape.messages is typed as unknown in Zod, but at runtime it's BaseMessage[]
type StreamState = Omit<ReactAgentState, "messages"> & {
  messages: BaseMessage[];
};

const REACT_AGENT_ASSISTANT_ID = "researcher";

export type UseAgentStreamOptions = {
  threadId: string | null;
  autoConnect?: boolean;
};

export type UseAgentStreamResult = {
  messages: BaseMessage[];
  todos: ReactAgentState["todos"];
  recentToolCalls: ReactAgentState["recentToolCalls"];
  searchRuns: ReactAgentState["searchRuns"];
  isStreaming: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
};

/**
 * Hook for streaming React agent execution via LangGraph SDK
 *
 * Replaces custom useSSEStream hook with SDK-based streaming.
 * Uses client.runs.stream() for real-time updates.
 *
 * @param options - Configuration options
 * @param options.threadId - Thread ID to stream from
 * @param options.autoConnect - Whether to auto-connect on mount (default: false)
 * @returns Streaming state, status, and control functions
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   todos,
 *   isStreaming,
 *   error,
 *   connect,
 *   disconnect
 * } = useAgentStream({
 *   threadId: "thread-123",
 *   autoConnect: false
 * });
 *
 * // Manually trigger streaming
 * <button onClick={connect}>Start Agent</button>
 * ```
 */
export function useAgentStream({
  threadId,
  autoConnect = false,
}: UseAgentStreamOptions): UseAgentStreamResult {
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [todos, setTodos] = useState<ReactAgentState["todos"]>([]);
  const [recentToolCalls, setRecentToolCalls] = useState<
    ReactAgentState["recentToolCalls"]
  >([]);
  const [searchRuns, setSearchRuns] = useState<ReactAgentState["searchRuns"]>(
    []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to handle full state updates from "values" events
  // Values events provide the complete state directly in chunk.data
  const handleValuesUpdate = useCallback((state: StreamState) => {
    // Messages come from MessagesZodState which types as unknown but is BaseMessage[] at runtime
    setMessages(state.messages);
    setTodos(state.todos);
    setRecentToolCalls(state.recentToolCalls);
    setSearchRuns(state.searchRuns);
  }, []);

  // Helper to handle delta updates from "updates" events
  // Updates events provide { [nodeName]: stateUpdate } structure
  // We merge updates from all nodes into current state
  const handleDeltaUpdate = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Delta update processing requires checking multiple optional arrays
    (updatesByNode: Record<string, Partial<StreamState>>) => {
      // Combine updates from all nodes in this event
      for (const nodeUpdate of Object.values(updatesByNode)) {
        // Append new messages if present
        const newMessages = nodeUpdate.messages;
        if (
          newMessages &&
          Array.isArray(newMessages) &&
          newMessages.length > 0
        ) {
          setMessages((prev) => [...prev, ...newMessages]);
        }

        // Replace todos array if present (not append - todos are replaced)
        const updatedTodos = nodeUpdate.todos;
        if (updatedTodos && Array.isArray(updatedTodos)) {
          setTodos(updatedTodos);
        }

        // Append new tool calls if present
        const toolCalls = nodeUpdate.recentToolCalls;
        if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
          setRecentToolCalls((prev) => [...prev, ...toolCalls]);
        }

        // Append new search runs if present
        const newSearchRuns = nodeUpdate.searchRuns;
        if (
          newSearchRuns &&
          Array.isArray(newSearchRuns) &&
          newSearchRuns.length > 0
        ) {
          setSearchRuns((prev) => [...prev, ...newSearchRuns]);
        }
      }
    },
    []
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Streaming function requires multiple state checks and updates
  const connect = useCallback(async () => {
    if (!threadId) {
      setError("No thread ID provided");
      return;
    }

    setIsStreaming(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const client = getLangGraphClient();
      const stream = client.runs.stream(threadId, REACT_AGENT_ASSISTANT_ID, {
        input: null,
        streamMode: ["values", "updates"] as const,
      });

      for await (const chunk of stream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (chunk.event === "values") {
          // Values event provides complete state directly
          handleValuesUpdate(chunk.data as StreamState);
        } else if (chunk.event === "updates") {
          // Updates event provides { [nodeName]: stateUpdate } map
          handleDeltaUpdate(chunk.data as Record<string, Partial<StreamState>>);
        }
      }

      setIsStreaming(false);
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Stream error");
      }
      setIsStreaming(false);
    }
  }, [threadId, handleValuesUpdate, handleDeltaUpdate]);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (autoConnect && threadId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, threadId, connect, disconnect]);

  return {
    messages,
    todos,
    recentToolCalls,
    searchRuns,
    isStreaming,
    error,
    connect,
    disconnect,
  };
}
