/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getGraph } from "@/server/graph";
import { UserInputsSchema } from "@/server/graph/state";

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

    // Check if we're in Plan mode (need to run and check for interrupts)
    if (validation.data.modeOverride === "plan") {
      // First seed the initial state like Auto mode
      await graph.updateState({ configurable: { thread_id: threadId } }, initial);

      // Then execute graph and wait for initial result
      // biome-ignore lint/correctness/noUnusedVariables: <Result is not used>
      const result = await graph.invoke(initial, {
        configurable: { thread_id: threadId },
      });

      // Read state after invoke to detect fresh interrupts
      const snapshot = await graph.getState({
        configurable: { thread_id: threadId },
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
      const interruptData =
        interruptFromTasks ?? interruptFromTop ?? interruptFromValues ?? null;

      if (interruptData) {
        console.log(`[API] Thread ${threadId} interrupted in Plan mode`);
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
