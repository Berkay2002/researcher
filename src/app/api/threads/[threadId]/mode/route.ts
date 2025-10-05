import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGraph } from "@/server/graph";

const ModeSchema = z.object({
  mode: z.enum(["auto", "plan"]),
});

/**
 * PATCH /api/threads/:threadId/mode
 *
 * Updates the mode override for a thread.
 * Useful for switching between Auto and Plan modes before execution.
 *
 * Body:
 * - mode: "auto" | "plan"
 *
 * Returns:
 * - 200: { ok: true, mode }
 * - 400: Invalid input
 * - 500: Server error
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await req.json();

    // Validate input
    const validation = ModeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid mode", details: validation.error.issues },
        { status: 400 }
      );
    }

    const graph = getGraph();

    // Update state with new mode
    await graph.updateState(
      {
        configurable: { thread_id: threadId },
      },
      {
        userInputs: {
          modeOverride: validation.data.mode,
        },
      }
    );

    return NextResponse.json({ ok: true, mode: validation.data.mode });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update mode", details: String(error) },
      { status: 500 }
    );
  }
}
