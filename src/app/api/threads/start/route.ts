/** biome-ignore-all lint/suspicious/noConsole: <For development> */
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

    // Execute graph and wait for initial result to check for interrupts
    const result = await graph.invoke(initial, {
      configurable: { thread_id: threadId },
    });

    // Check for interrupt in result (HITL planning in Plan mode)
    const resultWithInterrupt = result as unknown as {
      __interrupt__?: unknown;
    };

    if (resultWithInterrupt.__interrupt__) {
      console.log(`[API] Thread ${threadId} interrupted in Plan mode`);
      return NextResponse.json(
        {
          threadId,
          interrupt: resultWithInterrupt.__interrupt__,
        },
        { status: 202 }
      );
    }

    console.log(`[API] Thread ${threadId} started successfully`);
    return NextResponse.json({ threadId, status: "started" }, { status: 201 });
  } catch (error) {
    console.error("[API] Error starting thread:", error);
    return NextResponse.json(
      { error: "Failed to start thread", details: String(error) },
      { status: 500 }
    );
  }
}
