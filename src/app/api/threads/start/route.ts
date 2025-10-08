/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getGraph } from "@/server/workflows/researcher/graph";
import { UserInputsSchema } from "@/server/workflows/researcher/graph/state";

/**
 * Create a thread history entry
 */
async function createThreadHistoryEntry(data: {
  id: string;
  goal: string;
  mode: "auto" | "plan";
  status: "started" | "running" | "completed" | "interrupted" | "error";
  metadata?: any;
}) {
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/history`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      console.warn(
        "[API] Failed to create thread history entry:",
        await response.text()
      );
    }
  } catch (error) {
    console.warn("[API] Error creating thread history entry:", error);
  }
}

/**
 * POST /api/threads/start
 *
 * Starts a new research thread or continues an existing one.
 *
 * Body:
 * - goal: string (required)
 * - modeOverride?: "auto" | "plan"
 * - threadId?: string (optional, for resuming)
 *
 * Returns:
 * - 201: { threadId, status: "started" }
 * - 202: { threadId, interrupt: {...} } (if Plan mode triggers interrupt)
 * - 400: Validation error
 * - 500: Server error
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <>
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate inputs
    const validation = UserInputsSchema.safeParse({
      goal: body.goal,
      modeOverride: body.modeOverride ?? null,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const threadId = body.threadId ?? uuid();
    const graph = getGraph();

    const initial = {
      threadId,
      userInputs: validation.data,
    };

    console.log(`[API] Starting thread ${threadId} with goal: "${body.goal}"`);

    // Create thread history entry
    await createThreadHistoryEntry({
      id: threadId,
      goal: body.goal,
      mode: validation.data.modeOverride || "auto",
      status: "started",
    });

    // Check if we're in Plan mode (need to run and check for interrupts)
    if (validation.data.modeOverride === "plan") {
      // First seed the initial state like Auto mode
      await graph.updateState(
        { configurable: { thread_id: threadId } },
        initial
      );

      // Then execute graph and wait for initial result
      // biome-ignore lint/correctness/noUnusedVariables: <Result is not used>
      const result = await graph.invoke(initial, {
        configurable: { thread_id: threadId },
      });

      // Read state after invoke to detect fresh interrupts
      const snapshot = await graph.getState({
        configurable: { thread_id: threadId },
      });

      // Debug: Log the full snapshot structure
      console.log("[API] Snapshot structure after invoke:", {
        hasValues: Boolean(snapshot.values),
        hasNext: Boolean(snapshot.next),
        nextLength: snapshot.next?.length ?? 0,
        hasTasks: Boolean(snapshot.tasks),
        tasksLength: snapshot.tasks?.length ?? 0,
        hasInterrupt: Boolean((snapshot as any).interrupt),
        snapshotKeys: Object.keys(snapshot),
      });

      // Extract interrupt data from state (same logic as /state route)
      const interruptFromTasks =
        (Array.isArray(snapshot.tasks) &&
          (snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
            ?.interrupts?.[0]?.value) ??
        null;

      const interruptFromTop = (snapshot as any).interrupts?.[0]?.value ?? null;
      const interruptFromValues =
        (snapshot.values as any).__interrupt__ ?? null;

      // Check for interrupt in the snapshot itself (LangGraph interrupt() function)
      const interruptFromSnapshot = (snapshot as any).interrupt ?? null;

      const interruptData =
        interruptFromSnapshot ??
        interruptFromTasks ??
        interruptFromTop ??
        interruptFromValues ??
        null;

      console.log("[API] Start route interrupt detection results:");
      console.log(
        `- From snapshot: ${interruptFromSnapshot ? "FOUND" : "null"}`
      );
      console.log(`- From tasks: ${interruptFromTasks ? "FOUND" : "null"}`);
      console.log(`- From top: ${interruptFromTop ? "FOUND" : "null"}`);
      console.log(`- From values: ${interruptFromValues ? "FOUND" : "null"}`);
      console.log(`- Final result: ${interruptData ? "FOUND" : "null"}`);

      if (interruptData) {
        console.log(`[API] Thread ${threadId} interrupted in Plan mode`);

        // Update thread history to interrupted status
        await createThreadHistoryEntry({
          id: threadId,
          goal: body.goal,
          mode: validation.data.modeOverride || "plan",
          status: "interrupted",
          metadata: {
            step: "planner",
          },
        });

        return NextResponse.json(
          {
            threadId,
            interrupt: interruptData,
          },
          { status: 202 }
        );
      }

      console.log(`[API] Thread ${threadId} started successfully in Plan mode`);
      return NextResponse.json(
        { threadId, status: "started" },
        { status: 201 }
      );
    }

    // Auto mode: Seed state without blocking for immediate navigation
    // The actual graph execution will happen in the /stream endpoint
    await graph.updateState({ configurable: { thread_id: threadId } }, initial);

    console.log(`[API] Thread ${threadId} state seeded for Auto mode`);
    return NextResponse.json({ threadId, status: "started" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error starting thread:", error);
    return NextResponse.json(
      { error: "Failed to start thread", details: String(error) },
      { status: 500 }
    );
  }
}
