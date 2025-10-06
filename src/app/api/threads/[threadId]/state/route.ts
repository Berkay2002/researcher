/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Needs to check multiple possible interrupt locations>
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

    // Extract interrupt data from multiple possible locations in LangGraph state
    // Check tasks for interrupt metadata (new LangGraph versions)
    const interruptFromTasks =
      Array.isArray(snapshot.tasks) &&
      ((snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
        ?.interrupts?.[0]?.value ??
        null);

    // Check for explicit interrupts array (some LangGraph versions)
    const interruptFromTop = (snapshot as any).interrupts?.[0]?.value ?? null;

    // Check for __interrupt__ in values (legacy/compatibility)
    const interruptFromValues = (snapshot.values as any).__interrupt__ ?? null;

    // Additional: Check if the interrupt is stored directly in tasks without .value wrapper
    const interruptFromTasksDirect =
      Array.isArray(snapshot.tasks) &&
      ((snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
        ?.interrupts?.[0] ??
        null);

    // Use the first available interrupt source
    const interruptData =
      interruptFromTasks ??
      interruptFromTop ??
      interruptFromValues ??
      interruptFromTasksDirect ??
      null;

    console.log("[API] Interrupt detection results:");
    console.log(`- From tasks: ${interruptFromTasks ? "FOUND" : "null"}`);
    console.log(`- From top: ${interruptFromTop ? "FOUND" : "null"}`);
    console.log(`- From values: ${interruptFromValues ? "FOUND" : "null"}`);
    console.log(
      `- From tasks direct: ${interruptFromTasksDirect ? "FOUND" : "null"}`
    );
    console.log(`- Final result: ${interruptData ? "FOUND" : "null"}`);

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
