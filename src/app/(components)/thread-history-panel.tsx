"use client";

import { useCallback, useEffect, useState } from "react";
import { useThreadHistory } from "@/lib/hooks/use-thread-history";
import type { ThreadHistoryEntry, ThreadMetadata } from "@/types/ui";
import { PanelHeader } from "./app-shell";
import { ThreadList } from "./thread-list";

// Constants for thread history panel
const MAX_THREADS_HISTORY_LIMIT = 100;
const HISTORY_REFRESH_INTERVAL = 5000; // 5 seconds

// Type for API error response
type ApiError = {
  message: string;
  status?: number;
};

/**
 * Thread History Panel Props
 */
export type ThreadHistoryPanelProps = {
  activeThreadId?: string | null;
  onThreadSelect?: (threadId: string) => void;
  className?: string;
};

/**
 * Convert ThreadHistoryEntry to ThreadMetadata
 */
const historyEntryToMetadata = (entry: ThreadHistoryEntry): ThreadMetadata => {
  // Convert status from ThreadHistoryEntry to ThreadMetadata format
  const statusConversion: Record<
    ThreadHistoryEntry["status"],
    ThreadMetadata["status"]
  > = {
    started: "running",
    running: "running",
    completed: "completed",
    interrupted: "interrupted",
    error: "failed",
  };

  return {
    threadId: entry.id,
    title: entry.title,
    goal: entry.goal,
    status: statusConversion[entry.status],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    messageCount: 0, // Thread history doesn't track individual messages, only thread-level status
    mode: entry.mode,
    preview: entry.metadata?.step ? `Step: ${entry.metadata.step}` : undefined,
  };
};

/**
 * Thread History Panel Component
 *
 * Fetches thread history from the API and displays it using the existing ThreadList component.
 * This bridges the new history API with the existing UI components.
 */
export function ThreadHistoryPanel({
  activeThreadId,
  onThreadSelect: _onThreadSelect,
  className,
}: ThreadHistoryPanelProps) {
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the history hook with auto-refresh for real-time updates
  const {
    threads: historyThreads,
    loading: historyLoading,
    error: historyError,
    refresh,
  } = useThreadHistory({
    limit: MAX_THREADS_HISTORY_LIMIT,
    autoRefresh: true, // Auto-refresh to see status changes
    refreshInterval: HISTORY_REFRESH_INTERVAL,
  });

  // Memoize the conversion function to avoid unnecessary recalculations
  const memoizedHistoryEntryToMetadata = useCallback(
    historyEntryToMetadata,
    []
  );

  // Convert history entries to metadata format
  useEffect(() => {
    const convertedThreads = historyThreads.map(memoizedHistoryEntryToMetadata);
    setThreads(convertedThreads);
  }, [historyThreads, memoizedHistoryEntryToMetadata]);

  // Update loading state
  useEffect(() => {
    setLoading(historyLoading);
  }, [historyLoading]);

  // Update error state
  useEffect(() => {
    setError(historyError);
  }, [historyError]);

  // Handle thread deletion
  const handleDeleteThread = useCallback(async (threadId: string) => {
    try {
      const response = await fetch("/api/history", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: [threadId] }),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          message: "Failed to delete thread",
        }));
        throw new Error(errorData.message || "Failed to delete thread");
      }

      // Remove from local state
      setThreads((prev) => prev.filter((t) => t.threadId !== threadId));
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: <Development>
      console.error("Error deleting thread:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete thread";
      setError(errorMessage);
    }
  }, []);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Handle keyboard events for refresh button
  const handleRefreshKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRefresh();
      }
    },
    [handleRefresh]
  );

  // Handle keyboard events for "Try again" button
  const handleTryAgainKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRefresh();
      }
    },
    [handleRefresh]
  );

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <PanelHeader
        actions={
          <button
            aria-label="Refresh threads"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleRefresh}
            onKeyDown={handleRefreshKeyDown}
            title="Refresh"
            type="button"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Refresh</title>
              <path
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        }
        subtitle={`${threads.length} threads`}
        title="Thread History"
      />

      {/* Error State */}
      {error && (
        <div className="border-b bg-destructive/10 px-4 py-3">
          <p className="text-destructive text-sm">Error: {error}</p>
          <button
            className="mt-1 text-destructive text-sm underline"
            onClick={handleRefresh}
            onKeyDown={handleTryAgainKeyDown}
            type="button"
          >
            Try again
          </button>
        </div>
      )}

      {/* Thread List */}
      <ThreadList
        activeThreadId={activeThreadId}
        className="flex-1"
        onDeleteThread={handleDeleteThread}
        threads={threads}
      />
    </div>
  );
}

/**
 * Export a simplified version for use in existing layouts
 */
export function ThreadHistoryPanelWithShell(props: ThreadHistoryPanelProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-muted/30 lg:flex xl:w-80">
      <ThreadHistoryPanel {...props} />
    </aside>
  );
}
