"use server";

import { revalidatePath } from "next/cache";
import {
  deleteThreadHistoryEntries,
  getAllThreadHistory,
  getThreadHistoryEntry,
  setThreadHistoryEntry,
} from "@/lib/store/thread-history";
import type { ThreadHistoryEntry } from "@/types/ui";

// Constants for pagination and title generation
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Constants for regex patterns
const PREFIX_REGEX =
  /^(Give me|Provide|Create|Generate|Write|Analyze|Research|Find|Tell me about)\s+/i;
const TRAILING_PERIOD_REGEX = /\.$/;

/**
 * Server actions for thread management
 */

/**
 * Get all thread history entries with optional filtering
 */
export function getThreads(options: {
  limit?: number;
  offset?: number;
  status?: ThreadHistoryEntry["status"];
  mode?: ThreadHistoryEntry["mode"];
}) {
  try {
    let threads = getAllThreadHistory();

    // Apply filters
    if (options.status) {
      threads = threads.filter((thread) => thread.status === options.status);
    }
    if (options.mode) {
      threads = threads.filter((thread) => thread.mode === options.mode);
    }

    // Sort by lastActivity (or createdAt) descending
    threads.sort((a, b) => {
      const aTime = a.lastActivity || a.updatedAt;
      const bTime = b.lastActivity || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    const total = threads.length;
    const offset = options.offset || 0;
    const limit = Math.min(options.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const paginatedThreads = threads.slice(offset, offset + limit);

    return {
      success: true,
      data: {
        threads: paginatedThreads,
        total,
        limit,
        offset,
      },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to fetch threads",
    };
  }
}

/**
 * Get a single thread by ID
 */
export function getThread(threadId: string) {
  try {
    const thread = getThreadHistoryEntry(threadId);

    if (!thread) {
      return {
        success: false,
        error: "Thread not found",
      };
    }

    return {
      success: true,
      data: { thread },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to fetch thread",
    };
  }
}

/**
 * Create or update a thread history entry
 */
export function upsertThread(threadData: {
  id: string;
  title?: string;
  goal: string;
  mode: "auto" | "plan";
  status: ThreadHistoryEntry["status"];
  metadata?: ThreadHistoryEntry["metadata"];
}) {
  try {
    const now = new Date().toISOString();
    const existingEntry = getThreadHistoryEntry(threadData.id);

    const threadEntry: ThreadHistoryEntry = {
      id: threadData.id,
      title: threadData.title || generateTitleFromGoal(threadData.goal),
      goal: threadData.goal,
      mode: threadData.mode,
      status: threadData.status,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
      lastActivity: now,
      checkpointId: existingEntry?.checkpointId,
      metadata: {
        ...existingEntry?.metadata,
        ...threadData.metadata,
      },
    };

    setThreadHistoryEntry(threadEntry);

    // Revalidate the history pages
    revalidatePath("/api/history");
    revalidatePath("/");

    return {
      success: true,
      data: { thread: threadEntry },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to create/update thread",
    };
  }
}

/**
 * Update thread status and metadata
 */
export function updateThreadStatus(
  threadId: string,
  status: ThreadHistoryEntry["status"],
  metadata?: ThreadHistoryEntry["metadata"]
) {
  try {
    const existingThread = getThreadHistoryEntry(threadId);

    if (!existingThread) {
      return {
        success: false,
        error: "Thread not found",
      };
    }

    const now = new Date().toISOString();
    const updatedThread: ThreadHistoryEntry = {
      ...existingThread,
      status,
      lastActivity: now,
      updatedAt: now,
      metadata: {
        ...existingThread.metadata,
        ...metadata,
      },
    };

    setThreadHistoryEntry(updatedThread);

    // Revalidate the history pages
    revalidatePath("/api/history");
    revalidatePath("/");

    return {
      success: true,
      data: { thread: updatedThread },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to update thread status",
    };
  }
}

/**
 * Delete multiple threads
 */
export function deleteThreads(threadIds: string[]) {
  try {
    const deleted = deleteThreadHistoryEntries(threadIds);

    // Revalidate the history pages
    revalidatePath("/api/history");
    revalidatePath("/");

    return {
      success: true,
      data: { deleted },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to delete threads",
    };
  }
}

/**
 * Delete a single thread
 */
export async function deleteThread(threadId: string) {
  try {
    const existed = getThreadHistoryEntry(threadId) !== undefined;

    if (!existed) {
      return {
        success: false,
        error: "Thread not found",
      };
    }

    const { deleteThreadHistoryEntry } = await import(
      "@/lib/store/thread-history"
    );
    const success = deleteThreadHistoryEntry(threadId);

    if (!success) {
      return {
        success: false,
        error: "Failed to delete thread",
      };
    }

    // Revalidate the history pages
    revalidatePath("/api/history");
    revalidatePath("/");

    return {
      success: true,
      data: { deleted: true },
    };
  } catch (_error) {
    return {
      success: false,
      error: "Failed to delete thread",
    };
  }
}

/**
 * Helper function to generate title from goal
 */
function generateTitleFromGoal(goal: string): string {
  const MAX_TITLE_LENGTH = 60;
  const TRUNCATED_LENGTH = 57;
  const MIN_WORD_BREAK_LENGTH = 30;

  // Remove common prefixes and clean up
  const cleanGoal = goal
    .replace(PREFIX_REGEX, "")
    .replace(TRAILING_PERIOD_REGEX, "")
    .trim();

  // Truncate if too long
  if (cleanGoal.length <= MAX_TITLE_LENGTH) {
    return cleanGoal;
  }

  // Try to break at word boundaries
  const truncated = cleanGoal.substring(0, TRUNCATED_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > MIN_WORD_BREAK_LENGTH) {
    return `${truncated.substring(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}
