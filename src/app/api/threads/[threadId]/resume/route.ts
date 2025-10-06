/** biome-ignore-all lint/suspicious/noExplicitAny: <Needed> */
import { Command } from "@langchain/langgraph";
import { type NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/server/graph";

/**
 * POST /api/threads/:threadId/resume
 *
 * Resumes a thread after a human-in-the-loop interrupt.
 * Used in Plan mode when user answers planner questions.
 *
 * Body:
 * - resume: any (the user's answer/choice)
 *
 * Returns:
 * - 200: { ok: true, checkpointId, interrupt? } (may have another interrupt)
 * - 202: { threadId, interrupt: {...} } (if another interrupt occurs)
 * - 500: Server error
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await req.json();
    const graph = getGraph();

    const result = await graph.invoke(new Command({ resume: body.resume }), {
      configurable: { thread_id: threadId },
    });

    // Read state after invoke to detect fresh interrupts (multi-stage HITL)
    const snapshot = await graph.getState({
      configurable: { thread_id: threadId },
    });

    // Extract interrupt data from state (same logic as /state route)
    const interruptFromTasks =
      Array.isArray(snapshot.tasks) &&
      ((snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
        ?.interrupts?.[0]?.value ??
        null);

    const interruptFromTop = (snapshot as any).interrupts?.[0]?.value ?? null;
    const interruptFromValues = (snapshot.values as any).__interrupt__ ?? null;
    const interruptData =
      interruptFromTasks ?? interruptFromTop ?? interruptFromValues ?? null;

    if (interruptData) {
      return NextResponse.json(
        {
          threadId,
          interrupt: interruptData,
        },
        { status: 202 }
      );
    }

    const resultWithCheckpoint = result as unknown as {
      __checkpoint_id?: string;
    };

    return NextResponse.json({
      ok: true,
      checkpointId: resultWithCheckpoint.__checkpoint_id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to resume thread", details: String(error) },
      { status: 500 }
    );
  }
}
