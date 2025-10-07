/** biome-ignore-all lint/suspicious/noConsole: <Development> */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DraftEvent,
  EvidenceEvent,
  MessageData,
  NodeEvent,
  RunLogEntry,
  SourceCardData,
  SSEEvent,
  SSEEventType,
} from "@/types/ui";
import {
  // biome-ignore lint/correctness/noUnusedImports: <>
  draftToMessage,
  evidenceToSourceCard,
  parseSSEMessage,
} from "@/types/ui";

/**
 * SSE Stream State
 */
export type StreamState = {
  // Connection status
  status: "idle" | "connecting" | "streaming" | "completed" | "error";
  error: string | null;

  // Real-time data
  messages: MessageData[];
  sources: SourceCardData[];
  runLog: RunLogEntry[];
  queries: string[];

  // Current draft (streaming)
  currentDraft: string | null;
  currentDraftCitations: { claim: string; sources: string[] }[];

  // Node execution tracking
  activeNode: string | null;
  completedNodes: string[];
};

/**
 * SSE Stream Hook Options
 */
export type UseSSEStreamOptions = {
  threadId: string | null;
  autoConnect?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
};

/**
 * SSE Stream Hook
 *
 * Connects to /api/stream/[threadId] and manages real-time updates.
 * Handles parsing, state updates, and error recovery.
 */
export function useSSEStream({
  threadId,
  autoConnect = true,
  onComplete,
  onError,
}: UseSSEStreamOptions) {
  const [isDev] = useState(() => process.env.NODE_ENV !== "production");
  
  // Initialize refs first
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventListenersRef = useRef<
    [SSEEventType, (event: MessageEvent<string>) => void][]
  >([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isCompletedRef = useRef(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<StreamState["status"]>("idle");
  
  // Now initialize state
  const [state, setState] = useState<StreamState>(() => {
    const initialState = {
      status: "idle" as const,
      error: null,
      messages: [],
      sources: [],
      runLog: [],
      queries: [],
      currentDraft: null,
      currentDraftCitations: [],
      activeNode: null,
      completedNodes: [],
    };
    statusRef.current = initialState.status;
    return initialState;
  });

  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY_MS = 2000;

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[useSSEStream] Closing EventSource connection");
      }
      for (const [type, listener] of eventListenersRef.current) {
        eventSourceRef.current.removeEventListener(
          type,
          listener as EventListener
        );
      }
      eventListenersRef.current = [];
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset completion state
    isCompletedRef.current = false;

    setState((prev) => {
      statusRef.current = "idle";
      return { ...prev, status: "idle" };
    });
  }, []);

  // Update the ref whenever disconnect changes
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[useSSEStream] Received event", event.type, event.data);
      }
      switch (event.type) {
        case "node": {
          const nodeEvent = event as NodeEvent;
          const { node, status: nodeStatus } = nodeEvent.data;

          setState((prev) => {
            const newRunLog: RunLogEntry[] = [
              ...prev.runLog,
              {
                id: `${node}-${Date.now()}`,
                timestamp: event.timestamp || new Date().toISOString(),
                node,
                status: nodeStatus,
                duration: nodeEvent.data.duration,
              },
            ];

            return {
              ...prev,
              activeNode: nodeStatus === "started" ? node : null,
              completedNodes:
                nodeStatus === "completed"
                  ? [...prev.completedNodes, node]
                  : prev.completedNodes,
              runLog: newRunLog,
            };
          });
          break;
        }

        case "draft": {
          const draftEvent = event as DraftEvent;
          const { text, citations, delta } = draftEvent.data;

          if (process.env.NODE_ENV !== "production") {
            console.log("[useSSEStream] Draft update", {
              node: (draftEvent.data as { node?: string }).node ?? "unknown",
              hasDelta: Boolean(delta),
              length: (delta || text || "").length,
            });
          }

          setState((prev) => ({
            ...prev,
            currentDraft: delta ? (prev.currentDraft || "") + delta : text,
            currentDraftCitations: citations.map((citation) => ({
              claim: citation.excerpt || citation.title,
              sources: [citation.url],
            })),
          }));
          break;
        }

        case "evidence": {
          const evidenceEvent = event as EvidenceEvent;
          const newSources =
            evidenceEvent.data.sources.map(evidenceToSourceCard);

          setState((prev) => ({
            ...prev,
            sources: [...prev.sources, ...newSources],
          }));
          break;
        }

        case "queries": {
          const queriesEvent = event as SSEEvent<{ queries: string[] }>;

          setState((prev) => ({
            ...prev,
            queries: queriesEvent.data.queries,
          }));
          break;
        }

        case "done": {
          // Mark as completed to prevent reconnections
          isCompletedRef.current = true;

          // Finalize current draft as message
          setState((prev) => {
            if (process.env.NODE_ENV !== "production") {
              console.log("[useSSEStream] Stream completed, finalizing draft", {
                currentDraftLength: prev.currentDraft?.length ?? 0,
                messages: prev.messages.length,
              });
            }
            const finalMessages: MessageData[] = [...prev.messages];

            if (prev.currentDraft) {
              const finalMessage: MessageData = {
                id: `message-${Date.now()}`,
                role: "assistant",
                content: prev.currentDraft,
                timestamp: new Date().toISOString(),
                citations: prev.currentDraftCitations.map(
                  (citation, index) => ({
                    id: `citation-${index}`,
                    text: citation.claim,
                    sources: citation.sources,
                    position: { start: 0, end: citation.claim.length },
                  })
                ),
              };
              finalMessages.push(finalMessage);
            }

            statusRef.current = "completed";
            return {
              ...prev,
              status: "completed",
              messages: finalMessages,
              currentDraft: null,
              currentDraftCitations: [],
              activeNode: null,
            };
          });

          // Use the ref to access the latest disconnect function
          disconnectRef.current?.();
          onComplete?.();
          break;
        }

        case "error": {
          const errorEvent = event as SSEEvent<{
            message: string;
            code?: string;
            node?: string;
          }>;

          const errorMessage = errorEvent.data.message;

          if (process.env.NODE_ENV !== "production") {
            console.error("[useSSEStream] Stream error", errorEvent.data);
          }

          setState((prev) => {
            statusRef.current = "error";
            return {
              ...prev,
              status: "error",
              error: errorMessage,
            };
          });

          onError?.(errorMessage);
          // Use the ref to access the latest disconnect function
          disconnectRef.current?.();
          break;
        }

        case "keepalive":
          if (process.env.NODE_ENV !== "production") {
            console.log("[useSSEStream] Keep-alive received");
          }
          // Ignore keep-alive pings
          break;

        default:
          // Ignore unknown event types
          break;
      }
    },
    [onComplete, onError]
  );

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (!threadId) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "No thread ID provided",
      }));
      return;
    }

    if (isDev) {
      console.log("[useSSEStream] Connecting to stream", { threadId });
    }

    // Don't reconnect if already streaming or completed
    if (
      statusRef.current === "streaming" ||
      statusRef.current === "completed" ||
      isCompletedRef.current
    ) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setState((prev) => {
      statusRef.current = "connecting";
      return { ...prev, status: "connecting", error: null };
    });

    const eventSource = new EventSource(`/api/stream/${threadId}`);
    eventSourceRef.current = eventSource;

    const knownEventTypes: SSEEventType[] = [
      "node",
      "draft",
      "evidence",
      "queries",
      "citations",
      "issues",
      "llm_token",
      "custom",
      "error",
      "done",
      "keepalive",
    ];

    eventListenersRef.current = knownEventTypes.map((eventType) => {
      const listener = (event: MessageEvent<string>) => {
        const parsed = parseSSEMessage(event.data, eventType);

        if (!parsed) {
          return;
        }

        handleSSEEvent(parsed);
      };

      eventSource.addEventListener(eventType, listener as EventListener);
      return [eventType, listener];
    });

    // Connection opened
    eventSource.onopen = () => {
      setState((prev) => {
        statusRef.current = "streaming";
        return { ...prev, status: "streaming" };
      });
      reconnectAttempts.current = 0;
      if (isDev) {
        console.log("[useSSEStream] Connection opened", { threadId });
      }
    };

    // Generic message handler
    eventSource.onmessage = (event) => {
      // Skip token metadata messages that cause errors
      if (
        event.data.includes("completion_tokens") ||
        event.data.includes("total_tokens")
      ) {
        return;
      }

      const parsed = parseSSEMessage(event.data);

      if (!parsed) {
        return;
      }

      handleSSEEvent(parsed);
    };

    // Error handler
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Its fine>
    eventSource.onerror = () => {
      for (const [type, listener] of eventListenersRef.current) {
        eventSource.removeEventListener(type, listener as EventListener);
      }
      eventListenersRef.current = [];
      if (isDev) {
        console.error("[useSSEStream] EventSource error", {
          readyState: eventSource.readyState,
          threadId,
        });
      }
      eventSource.close();
      eventSourceRef.current = null;

      // Don't attempt reconnection if stream was completed
      if (isCompletedRef.current) {
        return;
      }

      // Check if this is a 409 (interrupt) response by examining the readyState
      // EventSource doesn't expose HTTP status, but we can detect patterns
      // When server returns 409, EventSource will error with readyState = 2 (CLOSED)
      // and won't attempt reconnection - this is expected behavior for interrupts

      // For interrupt (409) responses, don't attempt reconnection
      // The UI will handle reconnecting when the interrupt is resolved
      if (eventSource.readyState === EventSource.CLOSED) {
        setState((prev) => {
          statusRef.current = "idle";
          return {
            ...prev,
            status: "idle",
            error: null, // Clear error for expected interrupt
          };
        });
        return;
      }

      // Attempt reconnection for other errors
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;

        setState((prev) => {
          statusRef.current = "connecting";
          return {
            ...prev,
            status: "connecting",
            error: `Reconnecting... (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`,
          };
        });

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      } else {
        const errorMessage = "Connection failed after multiple attempts";
        setState((prev) => {
          statusRef.current = "error";
          return {
            ...prev,
            status: "error",
            error: errorMessage,
          };
        });
        onError?.(errorMessage);
      }
    };
  }, [threadId, onError, handleSSEEvent, isDev]);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    // Reset completion state when threadId changes
    if (threadId) {
      isCompletedRef.current = false;
    }

    if (autoConnect && threadId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, threadId, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    isConnected: state.status === "streaming",
  };
}
