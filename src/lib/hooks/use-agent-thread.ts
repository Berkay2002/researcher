"use client";

import type { ThreadState } from "@langchain/langgraph-sdk";
import { useCallback, useEffect, useState } from "react";
import { getLangGraphClient } from "@/lib/langgraph-client";
import type { ReactAgentState } from "@/server/agents/react/state";

export type UseAgentThreadOptions = {
  threadId: string | null;
  autoFetch?: boolean;
};

export type UseAgentThreadResult = {
  state: ThreadState<ReactAgentState> | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Hook for accessing React agent thread state via LangGraph SDK
 *
 * Replaces custom useThreadState hook with SDK-based state management.
 * Uses client.threads.getState() to fetch thread snapshots.
 *
 * @param options - Configuration options
 * @param options.threadId - Thread ID to fetch state for
 * @param options.autoFetch - Whether to auto-fetch on mount (default: true)
 * @returns Thread state, loading status, error, and refetch function
 *
 * @example
 * ```tsx
 * const { state, isLoading, error, refetch } = useAgentThread({
 *   threadId: "thread-123",
 *   autoFetch: true
 * });
 *
 * // Access state values
 * const messages = state?.values?.messages || [];
 * const todos = state?.values?.todos || [];
 * ```
 */
export function useAgentThread({
  threadId,
  autoFetch = true,
}: UseAgentThreadOptions): UseAgentThreadResult {
  const [state, setState] = useState<ThreadState<ReactAgentState> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!threadId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = getLangGraphClient();
      const threadState =
        await client.threads.getState<ReactAgentState>(threadId);
      setState(threadState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch state");
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  const refetch = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (autoFetch && threadId) {
      fetchState();
    }
  }, [autoFetch, threadId, fetchState]);

  return { state, isLoading, error, refetch };
}
