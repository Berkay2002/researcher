/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { type NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/server/graph";

// Ensure Node.js runtime for SSE streaming support
export const runtime = "nodejs";

// ============================================================================
// Constants (extracted magic numbers for Biome compliance)
// ============================================================================

const STREAM_KEEP_ALIVE_MS = 30_000; // 30s keep-alive ping interval
const STREAM_TIMEOUT_MS = 300_000; // 5min max stream duration

// ============================================================================
// Event Types
// ============================================================================

type StreamEventType =
  | "node"
  | "draft"
  | "evidence"
  | "queries"
  | "citations"
  | "issues"
  | "llm_token"
  | "custom"
  | "error"
  | "done"
  | "keepalive";

type SSEEvent = {
  event: StreamEventType;
  data: Record<string, unknown> | string;
};

// ============================================================================
// SSE Formatting Helpers
// ============================================================================

/**
 * Formats an event object as Server-Sent Events format
 * Format: event: <type>\ndata: <json>\n\n
 */
function formatSSE(event: SSEEvent): string {
  const dataStr =
    typeof event.data === "string" ? event.data : JSON.stringify(event.data);
  return `event: ${event.event}\ndata: ${dataStr}\n\n`;
}

/**
 * Creates a keep-alive ping event to prevent connection timeout
 */
function createKeepAlive(): string {
  return formatSSE({
    event: "keepalive",
    data: { timestamp: new Date().toISOString() },
  });
}

// ============================================================================
// Stream Event Handlers
// ============================================================================

/**
 * Processes graph updates (node executions)
 * Emits node events with state updates
 */
function processNodeUpdate(
  nodeName: string,
  update: Record<string, unknown>
): SSEEvent {
  return {
    event: "node",
    data: {
      node: nodeName,
      timestamp: new Date().toISOString(),
      update,
    },
  };
}

/**
 * Processes LLM token streams
 * Emits individual tokens as they're generated
 */
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

/**
 * Processes custom events from nodes
 * Used for progress signals, citations discoveries, etc.
 */
function processCustomEvent(customData: unknown): SSEEvent {
  return {
    event: "custom",
    data: {
      custom: customData,
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// Main Route Handler
// ============================================================================

/**
 * GET /api/stream/:threadId
 *
 * Server-Sent Events (SSE) endpoint for streaming graph execution progress.
 *
 * Stream Modes:
 * - "updates": Node execution updates with state changes
 * - "messages": LLM token streaming as they're generated
 * - "custom": Custom events from nodes (progress, citations, etc.)
 *
 * Event Types:
 * - node: Node execution updates
 * - draft: Draft updates from writer
 * - evidence: Evidence accumulation from research
 * - queries: Query generation from planner
 * - citations: Citation discoveries
 * - issues: Quality gate issues
 * - llm_token: LLM token streaming
 * - custom: Custom progress signals
 * - error: Error events
 * - done: Stream completion
 * - keepalive: Connection keep-alive ping
 *
 * Returns:
 * - 200: SSE stream with Content-Type: text/event-stream
 * - 404: Thread not found
 * - 500: Server error
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const graph = getGraph();

    console.log(`[SSE] Starting stream for thread ${threadId}`);

    // Verify thread exists by checking state
    const snapshot = await graph.getState({
      configurable: { thread_id: threadId },
    });

    if (!snapshot.values) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Create SSE response stream
    const encoder = new TextEncoder();
    let keepAliveTimer: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const body = new ReadableStream({
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE stream handling requires complex error handling and cleanup logic
      async start(controller) {
        try {
          // Setup keep-alive timer to prevent connection timeout
          keepAliveTimer = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(createKeepAlive()));
            } catch (error) {
              console.error("[SSE] Keep-alive error:", error);
            }
          }, STREAM_KEEP_ALIVE_MS);

          // Setup timeout timer to prevent infinite streams
          timeoutTimer = setTimeout(() => {
            console.log(`[SSE] Stream timeout reached for thread ${threadId}`);
            try {
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
            } catch (error) {
              console.error("[SSE] Timeout cleanup error:", error);
            }
          }, STREAM_TIMEOUT_MS);

          // Start streaming from graph with multiple modes
          const stream = await graph.stream(null, {
            configurable: { thread_id: threadId },
            streamMode: ["updates", "messages", "custom"],
          });

          // Process stream chunks
          for await (const chunk of stream) {
            try {
              // Handle different stream modes
              if (Array.isArray(chunk)) {
                // Multiple modes: [updates, messages, custom]
                for (const item of chunk) {
                  const event = processChunk(item);
                  if (event) {
                    controller.enqueue(encoder.encode(formatSSE(event)));
                  }
                }
              } else {
                // Single mode
                const event = processChunk(chunk);
                if (event) {
                  controller.enqueue(encoder.encode(formatSSE(event)));
                }
              }
            } catch (chunkError) {
              console.error("[SSE] Chunk processing error:", chunkError);
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

          // Stream completed successfully
          console.log(`[SSE] Stream completed for thread ${threadId}`);
          controller.enqueue(
            encoder.encode(formatSSE({ event: "done", data: {} }))
          );
          controller.close();
        } catch (streamError) {
          console.error("[SSE] Stream error:", streamError);
          try {
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
          } catch (closeError) {
            console.error("[SSE] Error during error handling:", closeError);
          }
        } finally {
          // Cleanup timers
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
          }
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
          }
        }
      },
      cancel() {
        console.log(`[SSE] Client disconnected from thread ${threadId}`);
        // Cleanup timers on client disconnect
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
      },
    });

    // Return SSE response with proper headers
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
      status: 200,
    });
  } catch (error) {
    console.error("[SSE] Error starting stream:", error);
    return NextResponse.json(
      {
        error: "Failed to start stream",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Chunk Processing Helper
// ============================================================================

/**
 * Processes individual stream chunks and determines event type
 * Handles updates, messages, and custom modes
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Chunk processing requires branching logic for different stream modes and event types
function processChunk(chunk: unknown): SSEEvent | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }

  const chunkObj = chunk as Record<string, unknown>;

  // Check for updates mode (node executions)
  if (Object.keys(chunkObj).length === 1) {
    const [nodeName, update] = Object.entries(chunkObj)[0];

    // Extract specific state updates
    const updateObj = update as Record<string, unknown>;

    // Emit specialized events for key state changes
    if (updateObj.draft) {
      return {
        event: "draft",
        data: {
          draft: updateObj.draft,
          node: nodeName,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (updateObj.evidence) {
      return {
        event: "evidence",
        data: {
          evidence: updateObj.evidence,
          node: nodeName,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (updateObj.queries) {
      return {
        event: "queries",
        data: {
          queries: updateObj.queries,
          node: nodeName,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (
      updateObj.issues &&
      Array.isArray(updateObj.issues) &&
      updateObj.issues.length > 0
    ) {
      return {
        event: "issues",
        data: {
          issues: updateObj.issues,
          node: nodeName,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Default node update
    return processNodeUpdate(nodeName, updateObj);
  }

  // Check for messages mode (LLM tokens)
  if ("content" in chunkObj || "contentBlocks" in chunkObj) {
    const metadata = (
      "langgraph_node" in chunkObj
        ? { langgraph_node: chunkObj.langgraph_node }
        : {}
    ) as Record<string, unknown>;
    return processLLMToken(chunkObj, metadata);
  }

  // Check for custom mode
  if ("custom" in chunkObj || typeof chunkObj === "string") {
    return processCustomEvent(chunkObj);
  }

  // Unknown chunk format - emit as generic event
  return {
    event: "custom",
    data: chunkObj,
  };
}
