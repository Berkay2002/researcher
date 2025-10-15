/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { type NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/server/workflows/researcher/graph";

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

    // Debug: Log the full snapshot structure
    console.log("[API] State route snapshot structure:", {
      hasValues: Boolean(snapshot.values),
      hasNext: Boolean(snapshot.next),
      nextLength: snapshot.next?.length ?? 0,
      hasTasks: Boolean(snapshot.tasks),
      tasksLength: snapshot.tasks?.length ?? 0,
      hasInterrupt: Boolean((snapshot as any).interrupt),
      snapshotKeys: Object.keys(snapshot),
    });

    // Debug: Log detailed task structure
    if (Array.isArray(snapshot.tasks) && snapshot.tasks.length > 0) {
      const firstTask = snapshot.tasks[0] as any;
      console.log("[API] State route tasks detail:", {
        firstTask: {
          keys: Object.keys(firstTask),
          hasInterrupts: "interrupts" in firstTask,
          interruptsLength: firstTask.interrupts?.length ?? 0,
          interruptsValue: JSON.stringify(firstTask.interrupts),
          taskState: firstTask.state,
        },
      });
    }

    // Check if graph is still executing (not completed)
    const isExecuting = snapshot.next && snapshot.next.length > 0;
    const hasEmptyInterruptsArray =
      Array.isArray(snapshot.tasks) &&
      snapshot.tasks.length > 0 &&
      "interrupts" in snapshot.tasks[0] &&
      Array.isArray((snapshot.tasks[0] as any).interrupts) &&
      (snapshot.tasks[0] as any).interrupts.length === 0;

    // If graph is executing and has empty interrupts array, it might be about to interrupt
    // Return null for now but log for debugging
    if (isExecuting && hasEmptyInterruptsArray) {
      console.log(
        "[API] Graph is executing with empty interrupts array - interrupt may be pending"
      );
    }

    // Extract interrupt data from multiple possible locations in LangGraph state
    // Try multiple detection strategies based on LangGraph version

    // Strategy 1: Check tasks array for interrupts (most common in current versions)
    let interruptFromTasks: any = null;
    if (Array.isArray(snapshot.tasks)) {
      const taskWithInterrupt = (snapshot.tasks as any[]).find(
        (t: any) => Array.isArray(t?.interrupts) && t.interrupts.length > 0
      );
      if (taskWithInterrupt) {
        // Try .value property first (wrapped format)
        interruptFromTasks =
          taskWithInterrupt.interrupts[0]?.value ??
          taskWithInterrupt.interrupts[0] ??
          null;
      }
    }

    // Strategy 2: Check for explicit interrupts array (some LangGraph versions)
    const interruptFromTop = (snapshot as any).interrupts?.[0]?.value ?? null;

    // Strategy 3: Check for __interrupt__ in values (legacy/compatibility)
    const interruptFromValues = (snapshot.values as any).__interrupt__ ?? null;

    // Strategy 4: Check for interrupt in the snapshot itself (LangGraph interrupt() function)
    const interruptFromSnapshot = (snapshot as any).interrupt ?? null;

    // Use the first available interrupt source
    const interruptData =
      interruptFromSnapshot ??
      interruptFromTasks ??
      interruptFromTop ??
      interruptFromValues ??
      null;

    console.log("[API] Interrupt detection results:");
    console.log(`- From snapshot: ${interruptFromSnapshot ? "FOUND" : "null"}`);
    console.log(`- From tasks: ${interruptFromTasks ? "FOUND" : "null"}`);
    console.log(`- From top: ${interruptFromTop ? "FOUND" : "null"}`);
    console.log(`- From values: ${interruptFromValues ? "FOUND" : "null"}`);
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
