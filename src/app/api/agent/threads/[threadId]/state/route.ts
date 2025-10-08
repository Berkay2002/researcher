/** biome-ignore-all lint/suspicious/noConsole: <Development> */
import { BaseMessage } from "@langchain/core/messages";
import { type NextRequest, NextResponse } from "next/server";
import { getReactAgent } from "@/server/agents/react/runtime";

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVER_ERROR = 500;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const agent = getReactAgent();

    const snapshot = await agent.graph.getState({
      configurable: { thread_id: threadId },
    });

    if (!snapshot.values) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: HTTP_STATUS_NOT_FOUND }
      );
    }

    const serializedValues = serializeAgentValues(
      snapshot.values as Record<string, unknown>
    );

    return NextResponse.json(
      {
        values: serializedValues,
        next: snapshot.next ?? [],
        interrupt: (snapshot as { interrupt?: unknown }).interrupt ?? null,
        checkpointId:
          (
            snapshot as {
              config?: { configurable?: { checkpoint_id?: string } };
            }
          ).config?.configurable?.checkpoint_id ?? null,
      },
      { status: HTTP_STATUS_OK }
    );
  } catch (error) {
    console.error("[AgentAPI] Error getting thread state:", error);
    return NextResponse.json(
      { error: "Failed to get agent thread state", details: String(error) },
      { status: HTTP_STATUS_SERVER_ERROR }
    );
  }
}

function serializeAgentValues(values: Record<string, unknown>) {
  const serialized: Record<string, unknown> = {
    ...values,
    agentType: "react",
  };

  if (Array.isArray(values.messages)) {
    serialized.messages = values.messages.map((message) =>
      serializeMessage(message)
    );
  }

  return serialized;
}

function serializeMessage(message: unknown) {
  if (message instanceof BaseMessage) {
    return message.toDict();
  }
  if (
    typeof message === "object" &&
    message !== null &&
    "toDict" in message &&
    typeof (message as { toDict: unknown }).toDict === "function"
  ) {
    try {
      const possibleMessage = message as { toDict: () => unknown };
      return possibleMessage.toDict();
    } catch (error) {
      console.warn("[AgentAPI] Failed to serialize message via toDict", error);
    }
  }
  return message;
}
