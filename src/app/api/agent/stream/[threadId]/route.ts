/** biome-ignore-all lint/suspicious/noConsole: <Development> */
import { BaseMessage } from "@langchain/core/messages";
import { type NextRequest, NextResponse } from "next/server";
import { getReactAgent } from "@/server/agents/react/runtime";

export const runtime = "nodejs";

const STREAM_KEEP_ALIVE_MS = 30_000;
const STREAM_TIMEOUT_MS = 300_000;

const activeStreams = new Map<string, ReadableStream>();

type AgentStreamEventType =
  | "node"
  | "messages"
  | "todos"
  | "tool_calls"
  | "search_runs"
  | "llm_token"
  | "custom"
  | "error"
  | "done"
  | "keepalive";

type SSEEvent = {
  event: AgentStreamEventType;
  data: Record<string, unknown> | string;
};

function formatSSE(event: SSEEvent): string {
  const dataStr =
    typeof event.data === "string" ? event.data : JSON.stringify(event.data);
  return `event: ${event.event}\ndata: ${dataStr}\n\n`;
}

function createKeepAlive(): string {
  return formatSSE({
    event: "keepalive",
    data: { timestamp: new Date().toISOString() },
  });
}

function getOrCreateStream(
  threadId: string,
  createStreamFn: () => ReadableStream
): ReadableStream {
  const existingStream = activeStreams.get(threadId);
  if (existingStream) {
    try {
      existingStream.cancel();
    } catch (error) {
      console.warn("[AgentSSE] Failed to cancel existing stream:", error);
    }
  }

  const newStream = createStreamFn();
  activeStreams.set(threadId, newStream);

  const originalCancel = newStream.cancel.bind(newStream);
  newStream.cancel = () => {
    activeStreams.delete(threadId);
    return originalCancel();
  };

  return newStream;
}

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
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const encoder = new TextEncoder();
    let keepAliveTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const createStreamBody = () =>
      new ReadableStream({
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <!-- IGNORE -->
        async start(controller) {
          try {
            keepAliveTimer = setInterval(() => {
              try {
                if (controller.desiredSize !== null) {
                  controller.enqueue(encoder.encode(createKeepAlive()));
                }
              } catch (error) {
                console.error("[AgentSSE] Keep-alive error:", error);
              }
            }, STREAM_KEEP_ALIVE_MS);

            timeoutTimer = setTimeout(() => {
              try {
                if (controller.desiredSize !== null) {
                  controller.enqueue(
                    encoder.encode(
                      formatSSE({
                        event: "error",
                        data: {
                          error: "Stream timeout",
                          message: "Maximum stream duration exceeded",
                        },
                      })
                    )
                  );
                  controller.enqueue(
                    encoder.encode(formatSSE({ event: "done", data: {} }))
                  );
                  controller.close();
                }
              } catch (error) {
                console.error("[AgentSSE] Timeout cleanup error:", error);
              }
            }, STREAM_TIMEOUT_MS);

            const stream = await agent.graph.stream(null, {
              configurable: { thread_id: threadId },
              streamMode: ["updates", "messages", "custom"],
            });

            for await (const chunk of stream) {
              if (controller.desiredSize === null) {
                break;
              }

              try {
                if (Array.isArray(chunk)) {
                  for (const item of chunk) {
                    if (Array.isArray(item) && item.length === 2) {
                      const [streamMode, streamChunk] = item;
                      const events = processChunkByMode(
                        streamMode,
                        streamChunk
                      );
                      enqueueEvents(controller, encoder, events);
                    } else {
                      const events = processChunk(item);
                      enqueueEvents(controller, encoder, events);
                    }
                  }
                } else {
                  const events = processChunk(chunk);
                  enqueueEvents(controller, encoder, events);
                }
              } catch (chunkError) {
                console.error("[AgentSSE] Chunk processing error:", chunkError);
                if (controller.desiredSize !== null) {
                  controller.enqueue(
                    encoder.encode(
                      formatSSE({
                        event: "error",
                        data: {
                          error: "Chunk processing error",
                          details: String(chunkError),
                        },
                      })
                    )
                  );
                }
              }
            }

            if (controller.desiredSize !== null) {
              controller.enqueue(
                encoder.encode(formatSSE({ event: "done", data: {} }))
              );
              controller.close();
            }
          } catch (streamError) {
            console.error("[AgentSSE] Stream error:", streamError);
            if (controller.desiredSize !== null) {
              controller.enqueue(
                encoder.encode(
                  formatSSE({
                    event: "error",
                    data: {
                      error: "Stream error",
                      details: String(streamError),
                    },
                  })
                )
              );
              controller.enqueue(
                encoder.encode(formatSSE({ event: "done", data: {} }))
              );
              controller.close();
            }
          } finally {
            if (keepAliveTimer) {
              clearInterval(keepAliveTimer);
            }
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
            }
          }
        },
        cancel() {
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
          }
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
          }
        },
      });

    const body = getOrCreateStream(threadId, () => createStreamBody());

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
      status: 200,
    });
  } catch (error) {
    console.error("[AgentSSE] Error starting stream:", error);
    return NextResponse.json(
      {
        error: "Failed to start agent stream",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

function enqueueEvents(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  events: SSEEvent[] | SSEEvent | null
) {
  if (!events) {
    return;
  }

  const eventList = Array.isArray(events) ? events : [events];
  for (const event of eventList) {
    controller.enqueue(encoder.encode(formatSSE(event)));
  }
}

function processChunkByMode(
  streamMode: unknown,
  chunk: unknown
): SSEEvent[] | SSEEvent | null {
  if (typeof streamMode === "object" && streamMode !== null) {
    const chunkStr = String(streamMode);
    if (
      chunkStr === "[object AIMessageChunk]" ||
      chunkStr.includes("MessageChunk")
    ) {
      return null;
    }
  }

  if (streamMode === "updates") {
    return processChunk(chunk);
  }

  if (streamMode === "messages") {
    return processLLMMessage(chunk);
  }

  if (streamMode === "custom") {
    return processCustomEvent(chunk);
  }

  if (typeof streamMode === "string" && !streamMode.includes("token")) {
    console.warn(`[AgentSSE] Unknown stream mode: ${streamMode}`);
  }
  return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <!-- IGNORE -->
function processChunk(chunk: unknown): SSEEvent[] | SSEEvent | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  const chunkObj = chunk as Record<string, unknown>;

  if (Object.keys(chunkObj).length === 1) {
    const [nodeName, update] = Object.entries(chunkObj)[0];
    const updateObj = update as Record<string, unknown>;

    const events: SSEEvent[] = [];
    const timestamp = new Date().toISOString();

    events.push({
      event: "node",
      data: {
        node: nodeName,
        status: "updated",
        timestamp,
      },
    });

    if (updateObj.messages) {
      events.push({
        event: "messages",
        data: {
          messages: serializeMessages(updateObj.messages),
          node: nodeName,
          timestamp,
        },
      });
    }

    if (updateObj.todos) {
      events.push({
        event: "todos",
        data: {
          todos: updateObj.todos,
          node: nodeName,
          timestamp,
        },
      });
    }

    if (updateObj.recentToolCalls) {
      events.push({
        event: "tool_calls",
        data: {
          toolCalls: updateObj.recentToolCalls,
          node: nodeName,
          timestamp,
        },
      });
    }

    if (updateObj.searchRuns) {
      events.push({
        event: "search_runs",
        data: {
          searchRuns: updateObj.searchRuns,
          node: nodeName,
          timestamp,
        },
      });
    }

    return events;
  }

  if ("content" in chunkObj || "contentBlocks" in chunkObj) {
    const metadata = (
      "langgraph_node" in chunkObj
        ? { langgraph_node: chunkObj.langgraph_node }
        : {}
    ) as Record<string, unknown>;
    return processLLMToken(chunkObj, metadata);
  }

  if ("custom" in chunkObj || typeof chunkObj === "string") {
    return processCustomEvent(chunkObj);
  }

  return null;
}

function processLLMMessage(chunk: unknown): SSEEvent | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  const chunkObj = chunk as Record<string, unknown>;

  if (
    "completion_tokens" in chunkObj ||
    "total_tokens" in chunkObj ||
    "prompt_tokens" in chunkObj
  ) {
    return null;
  }

  if ("content" in chunkObj || "contentBlocks" in chunkObj) {
    const metadata = (
      "langgraph_node" in chunkObj
        ? { langgraph_node: chunkObj.langgraph_node }
        : {}
    ) as Record<string, unknown>;
    return processLLMToken(chunkObj, metadata);
  }

  return null;
}

function processLLMToken(
  token: unknown,
  metadata: Record<string, unknown>
): SSEEvent {
  return {
    event: "llm_token",
    data: {
      token,
      metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

function processCustomEvent(customData: unknown): SSEEvent {
  return {
    event: "custom",
    data: {
      custom: customData,
      timestamp: new Date().toISOString(),
    },
  };
}

function serializeMessages(messages: unknown) {
  if (!Array.isArray(messages)) {
    return messages;
  }
  return messages.map((message) => {
    if (message instanceof BaseMessage) {
      return message.toDict();
    }
    if (
      typeof message === "object" &&
      message !== null &&
      "toDict" in message &&
      typeof (message as { toDict: unknown }).toDict === "function"
    ) {
      return (message as { toDict: () => unknown }).toDict();
    }
    return message;
  });
}
