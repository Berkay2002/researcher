import { HumanMessage } from "@langchain/core/messages";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getReactAgent } from "@/server/agents/react/runtime";

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CREATED = 201;
const HTTP_STATUS_SERVER_ERROR = 500;

const ERROR_MESSAGES = {
  missingPrompt: "Prompt is required",
  failedToStart: "Failed to start agent thread",
};

type StartAgentRequestBody = {
  prompt?: unknown;
  threadId?: unknown;
};

type StartAgentResponseBody = {
  threadId: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartAgentRequestBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingPrompt },
        { status: HTTP_STATUS_BAD_REQUEST }
      );
    }

    const threadId =
      typeof body.threadId === "string" && body.threadId.trim().length > 0
        ? body.threadId
        : uuid();

    const agent = getReactAgent();
    await agent.graph.updateState(
      { configurable: { thread_id: threadId } },
      {
        messages: [new HumanMessage({ content: prompt })],
      }
    );

    const responseBody: StartAgentResponseBody = {
      threadId,
    };

    return NextResponse.json(responseBody, { status: HTTP_STATUS_CREATED });
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: <Development>
    console.error("[AgentAPI] Error starting thread:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToStart, details: String(error) },
      { status: HTTP_STATUS_SERVER_ERROR }
    );
  }
}
