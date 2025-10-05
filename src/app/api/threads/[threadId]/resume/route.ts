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

    // Check if there's another interrupt (multi-stage HITL)
    // LangGraph adds __interrupt__ at runtime when interrupt() is called
    const resultWithInterrupt = result as unknown as {
      __interrupt__?: unknown;
      __checkpoint_id?: string;
    };

    if (resultWithInterrupt.__interrupt__) {
      return NextResponse.json(
        {
          threadId,
          interrupt: resultWithInterrupt.__interrupt__,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      ok: true,
      checkpointId: resultWithInterrupt.__checkpoint_id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to resume thread", details: String(error) },
      { status: 500 }
    );
  }
}
