/** biome-ignore-all lint/suspicious/noConsole: <Development> */
import { type NextRequest, NextResponse } from "next/server";
import {
  deleteThreadHistoryEntries,
  getAllThreadHistory,
  getThreadHistoryEntry,
  setThreadHistoryEntry,
} from "@/lib/store/thread-history";
import type { ThreadHistoryEntry } from "@/types/ui";

// Constants for magic numbers
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_TITLE_LENGTH = 60;
const TRUNCATED_LENGTH = 57;
const MIN_WORD_BREAK_LENGTH = 30;

// Constants for regex patterns
const PREFIX_REGEX =
  /^(Give me|Provide|Create|Generate|Write|Analyze|Research|Find|Tell me about)\s+/i;
const TRAILING_PERIOD_REGEX = /\.$/;

/**
 * GET /api/history
 *
 * Returns a list of all thread history entries
 *
 * Query params:
 * - limit?: number (default: 50)
 * - offset?: number (default: 0)
 * - status?: "started" | "running" | "completed" | "interrupted" | "error"
 * - mode?: "auto" | "plan"
 *
 * Returns:
 * - 200: { threads: ThreadHistoryEntry[], total: number }
 */
export function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Number(searchParams.get("limit")) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const offset = Math.max(
      Number(searchParams.get("offset")) || DEFAULT_OFFSET,
      DEFAULT_OFFSET
    );
    const statusFilter = searchParams.get("status") as
      | ThreadHistoryEntry["status"]
      | null;
    const modeFilter = searchParams.get("mode") as
      | ThreadHistoryEntry["mode"]
      | null;

    // Get all threads from store and apply filters
    let threads = getAllThreadHistory();

    // Apply filters
    if (statusFilter) {
      threads = threads.filter((thread) => thread.status === statusFilter);
    }
    if (modeFilter) {
      threads = threads.filter((thread) => thread.mode === modeFilter);
    }

    // Sort by lastActivity (or createdAt) descending
    threads.sort((a, b) => {
      const aTime = a.lastActivity || a.updatedAt;
      const bTime = b.lastActivity || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    const total = threads.length;
    const paginatedThreads = threads.slice(offset, offset + limit);

    return NextResponse.json({
      threads: paginatedThreads,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[API] Error fetching thread history:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread history" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/history
 *
 * Creates or updates a thread history entry
 *
 * Body:
 * - id: string (required)
 * - title: string (optional, will be generated from goal if not provided)
 * - goal: string (required)
 * - mode: "auto" | "plan" (required)
 * - status: ThreadHistoryEntry["status"] (required)
 * - metadata?: ThreadHistoryEntry["metadata"]
 *
 * Returns:
 * - 200: { thread: ThreadHistoryEntry }
 * - 400: Validation error
 * - 500: Server error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    // Validate required fields
    if (!(body.id && body.goal && body.mode && body.status)) {
      return NextResponse.json(
        { error: "Missing required fields: id, goal, mode, status" },
        { status: 400 }
      );
    }

    // Generate title from goal if not provided
    const title = body.title || generateTitleFromGoal(body.goal);

    const existingEntry = getThreadHistoryEntry(body.id);
    const threadEntry: ThreadHistoryEntry = {
      id: body.id,
      title,
      goal: body.goal,
      mode: body.mode,
      status: body.status,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
      lastActivity: now,
      checkpointId: body.checkpointId || existingEntry?.checkpointId,
      metadata: {
        ...existingEntry?.metadata,
        ...body.metadata,
      },
    };

    setThreadHistoryEntry(threadEntry);

    return NextResponse.json({ thread: threadEntry });
  } catch (error) {
    console.error("[API] Error creating/updating thread history:", error);
    return NextResponse.json(
      { error: "Failed to create/update thread history" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history
 *
 * Deletes thread history entries
 *
 * Body:
 * - ids: string[] (required) - Array of thread IDs to delete
 *
 * Returns:
 * - 200: { deleted: number }
 * - 400: Validation error
 * - 500: Server error
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'ids' field" },
        { status: 400 }
      );
    }

    const deleted = deleteThreadHistoryEntries(body.ids);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[API] Error deleting thread history:", error);
    return NextResponse.json(
      { error: "Failed to delete thread history" },
      { status: 500 }
    );
  }
}

/**
 * Generate a concise title from a goal string
 */
function generateTitleFromGoal(goal: string): string {
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
