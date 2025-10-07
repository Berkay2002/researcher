/** biome-ignore-all lint/suspicious/noConsole: <> */
import { type NextRequest, NextResponse } from "next/server";
import type { ThreadHistoryEntry } from "@/types/ui";

/**
 * GET /api/history/[threadId]
 *
 * Returns a single thread history entry
 *
 * Returns:
 * - 200: { thread: ThreadHistoryEntry }
 * - 404: Thread not found
 * - 500: Server error
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    // Import the thread history store functions
    const { getThreadHistoryEntry } = await import(
      "@/lib/store/thread-history"
    );

    const thread = getThreadHistoryEntry(threadId);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("[API] Error fetching thread history:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread history" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/history/[threadId]
 *
 * Updates a thread history entry
 *
 * Body:
 * - title?: string
 * - status?: ThreadHistoryEntry["status"]
 * - metadata?: ThreadHistoryEntry["metadata"]
 * - checkpointId?: string
 *
 * Returns:
 * - 200: { thread: ThreadHistoryEntry }
 * - 404: Thread not found
 * - 400: Validation error
 * - 500: Server error
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    // Import the thread history store functions
    const { getThreadHistoryEntry, setThreadHistoryEntry } = await import(
      "@/lib/store/thread-history"
    );

    const existingThread = getThreadHistoryEntry(threadId);

    if (!existingThread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Update the thread entry
    const updatedThread: ThreadHistoryEntry = {
      ...existingThread,
      ...body, // Merge updates
      id: threadId, // Ensure ID doesn't change
      updatedAt: now,
      lastActivity: now,
    };

    setThreadHistoryEntry(updatedThread);

    return NextResponse.json({ thread: updatedThread });
  } catch (error) {
    console.error("[API] Error updating thread history:", error);
    return NextResponse.json(
      { error: "Failed to update thread history" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history/[threadId]
 *
 * Deletes a single thread history entry
 *
 * Returns:
 * - 200: { deleted: true }
 * - 404: Thread not found
 * - 500: Server error
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;

    // Import the thread history store functions
    const { getThreadHistoryEntry, deleteThreadHistoryEntry } = await import(
      "@/lib/store/thread-history"
    );

    const existed = getThreadHistoryEntry(threadId) !== undefined;

    if (!existed) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    deleteThreadHistoryEntry(threadId);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[API] Error deleting thread history:", error);
    return NextResponse.json(
      { error: "Failed to delete thread history" },
      { status: 500 }
    );
  }
}
