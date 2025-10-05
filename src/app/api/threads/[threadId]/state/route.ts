/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { type NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/server/graph";

/**
 * GET /api/threads/:threadId/state
 *
 * Returns the latest state snapshot for a thread.
 * Useful for inspecting checkpoints, timeline, and current values.
 *
 * Returns:
 * - 200: { values, next, checkpointId }
 * - 404: Thread not found
 * - 500: Server error
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const graph = getGraph();

    console.log(`[API] Getting state for thread ${threadId}`);

    const snapshot = await graph.getState({
      configurable: { thread_id: threadId },
    });

    if (!snapshot.values) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Extract interrupt data from snapshot.tasks if present
    const tasks = snapshot.tasks ?? [];
    const interruptTask = tasks.find(
      (t: { interrupts?: unknown[] }) => t.interrupts && t.interrupts.length > 0
    ) as { interrupts?: { value?: unknown }[] } | undefined;

    const interruptData = interruptTask?.interrupts?.[0]?.value;

    return NextResponse.json({
      values: snapshot.values,
      next: snapshot.next ?? [],
      interrupt: interruptData ?? null,
      checkpointId:
        (snapshot as { config?: { configurable?: { checkpoint_id?: string } } })
          .config?.configurable?.checkpoint_id ?? null,
    });
  } catch (error) {
    console.error("[API] Error getting thread state:", error);
    return NextResponse.json(
      { error: "Failed to get thread state", details: String(error) },
      { status: 500 }
    );
  }
}
