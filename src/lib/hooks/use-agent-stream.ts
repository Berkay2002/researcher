"use client";

import type { BaseMessage } from "@langchain/core/messages";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLangGraphClient } from "@/lib/langgraph-client";
import type { ReactAgentState } from "@/server/agents/react/state";

const REACT_AGENT_ASSISTANT_ID = "react-agent";

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

  // Helper to handle full state updates
  const handleValuesUpdate = useCallback((state: ReactAgentState) => {
    setMessages(state.messages || []);
    setTodos(state.todos || []);
    setRecentToolCalls(state.recentToolCalls || []);
    setSearchRuns(state.searchRuns || []);
  }, []);

  // Helper to handle delta updates
  const handleDeltaUpdate = useCallback((update: Partial<ReactAgentState>) => {
    if (update.messages) {
      setMessages((prev) => [...prev, ...update.messages]);
    }
    if (update.todos) {
      setTodos(update.todos);
    }
    if (update.recentToolCalls) {
      setRecentToolCalls((prev) => [...prev, ...update.recentToolCalls]);
    }
    if (update.searchRuns) {
      setSearchRuns((prev) => [...prev, ...update.searchRuns]);
    }
  }, []);

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
          handleValuesUpdate(chunk.data as ReactAgentState);
        } else if (chunk.event === "updates") {
          handleDeltaUpdate(chunk.data as Partial<ReactAgentState>);
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
