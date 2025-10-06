/** biome-ignore-all lint/suspicious/noConsole: <Development> */
import { useCallback, useEffect, useState } from "react";
import type { ThreadHistoryEntry } from "@/types/ui";

// Constants for API requests
const HTTP_NOT_FOUND_STATUS = 404;

export type UseThreadHistoryOptions = {
  limit?: number;
  status?: ThreadHistoryEntry["status"];
  mode?: ThreadHistoryEntry["mode"];
  autoRefresh?: boolean;
  refreshInterval?: number;
};

export type UseThreadHistoryReturn = {
  threads: ThreadHistoryEntry[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  deleteThreads: (threadIds: string[]) => Promise<void>;
  updateThreadStatus: (
    threadId: string,
    status: ThreadHistoryEntry["status"],
    metadata?: ThreadHistoryEntry["metadata"]
  ) => Promise<void>;
};

const DEFAULT_OPTIONS = {
  limit: 50,
  status: undefined as undefined,
  mode: undefined as undefined,
  autoRefresh: false,
  refreshInterval: 30_000, // 30 seconds
};

/**
 * Hook for managing thread history
 */
export function useThreadHistory(
  options: UseThreadHistoryOptions = {}
): UseThreadHistoryReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [threads, setThreads] = useState<ThreadHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const fetchThreads = useCallback(
    async (resetOffset = false) => {
      try {
        setLoading(true);
        setError(null);

        const currentOffset = resetOffset ? 0 : offset;
        const params = new URLSearchParams({
          limit: opts.limit.toString(),
          offset: currentOffset.toString(),
        });

        if (opts.status) {
          params.append("status", opts.status);
        }
        if (opts.mode) {
          params.append("mode", opts.mode);
        }

        const response = await fetch(`/api/history?${params}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch threads: ${response.statusText}`);
        }

        const data = await response.json();

        if (resetOffset) {
          setThreads(data.threads);
          setOffset(data.threads.length);
        } else {
          setThreads((prev) => [...prev, ...data.threads]);
          setOffset((prev) => prev + data.threads.length);
        }

        setTotal(data.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch threads"
        );
        console.error("Error fetching thread history:", err);
      } finally {
        setLoading(false);
      }
    },
    [opts.limit, opts.status, opts.mode, offset]
  );

  const refresh = useCallback(async () => {
    await fetchThreads(true);
  }, [fetchThreads]);

  const loadMore = useCallback(async () => {
    if (!loading && threads.length < total) {
      await fetchThreads(false);
    }
  }, [fetchThreads, loading, threads.length, total]);

  const deleteThreads = useCallback(async (threadIds: string[]) => {
    try {
      const response = await fetch("/api/history", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: threadIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete threads: ${response.statusText}`);
      }

      // Remove deleted threads from state
      setThreads((prev) =>
        prev.filter((thread) => !threadIds.includes(thread.id))
      );
      setTotal((prev) => Math.max(0, prev - threadIds.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete threads");
      console.error("Error deleting threads:", err);
    }
  }, []);

  const updateThreadStatus = useCallback(
    async (
      threadId: string,
      status: ThreadHistoryEntry["status"],
      metadata?: ThreadHistoryEntry["metadata"]
    ) => {
      try {
        const response = await fetch(`/api/history/${threadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status, metadata }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update thread: ${response.statusText}`);
        }

        const { thread } = await response.json();

        // Update thread in state
        setThreads((prev) => prev.map((t) => (t.id === threadId ? thread : t)));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update thread"
        );
        console.error("Error updating thread:", err);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!opts.autoRefresh) {
      return;
    }

    const interval = setInterval(refresh, opts.refreshInterval);
    return () => clearInterval(interval);
  }, [opts.autoRefresh, opts.refreshInterval, refresh]);

  return {
    threads,
    loading,
    error,
    total,
    hasMore: threads.length < total,
    loadMore,
    refresh,
    deleteThreads,
    updateThreadStatus,
  };
}

/**
 * Hook for managing a single thread
 */
export function useThread(threadId: string | null) {
  const [thread, setThread] = useState<ThreadHistoryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    if (!threadId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/history/${threadId}`);

      if (!response.ok) {
        if (response.status === HTTP_NOT_FOUND_STATUS) {
          setThread(null);
          return;
        }
        throw new Error(`Failed to fetch thread: ${response.statusText}`);
      }

      const { thread: threadData } = await response.json();
      setThread(threadData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch thread");
      console.error("Error fetching thread:", err);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  const updateThread = useCallback(
    async (updates: Partial<ThreadHistoryEntry>) => {
      if (!threadId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/history/${threadId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(`Failed to update thread: ${response.statusText}`);
        }

        const { thread: updatedThread } = await response.json();
        setThread(updatedThread);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update thread"
        );
        console.error("Error updating thread:", err);
      } finally {
        setLoading(false);
      }
    },
    [threadId]
  );

  const deleteThread = useCallback(async () => {
    if (!threadId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/history/${threadId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete thread: ${response.statusText}`);
      }

      setThread(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete thread");
      console.error("Error deleting thread:", err);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  return {
    thread,
    loading,
    error,
    refresh: fetchThread,
    update: updateThread,
    delete: deleteThread,
  };
}
