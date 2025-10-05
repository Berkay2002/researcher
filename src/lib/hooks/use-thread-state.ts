"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadStateSnapshot } from "@/types/ui";

/**
 * Thread State Hook Options
 */
export type UseThreadStateOptions = {
  threadId: string | null;
  autoFetch?: boolean;
  pollInterval?: number; // Poll interval in ms (0 = no polling)
};

/**
 * Thread State Hook Result
 */
export type UseThreadStateResult = {
  snapshot: ThreadStateSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Thread State Hook
 *
 * Fetches and manages thread state snapshots from /api/threads/[threadId]/state.
 * Supports auto-fetching, polling, and manual refresh.
 */
export function useThreadState({
  threadId,
  autoFetch = true,
  pollInterval = 0,
}: UseThreadStateOptions): UseThreadStateResult {
  const [snapshot, setSnapshot] = useState<ThreadStateSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch thread state snapshot
   */
  const fetchState = useCallback(async () => {
    if (!threadId) {
      setSnapshot(null);
      setError("No thread ID provided");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/threads/${threadId}/state`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch thread state: ${response.status} ${errorText}`
        );
      }

      const data = (await response.json()) as ThreadStateSnapshot;
      setSnapshot(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  /**
   * Manual refetch wrapper
   */
  const refetch = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  /**
   * Auto-fetch on mount or threadId change
   */
  useEffect(() => {
    if (autoFetch && threadId) {
      fetchState();
    }
  }, [autoFetch, threadId, fetchState]);

  /**
   * Set up polling if interval > 0
   */
  useEffect(() => {
    if (pollInterval <= 0 || !threadId) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchState();
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [pollInterval, threadId, fetchState]);

  return {
    snapshot,
    isLoading,
    error,
    refetch,
  };
}
