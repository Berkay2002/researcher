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
  currentDraftCitations: Array<{ claim: string; sources: string[] }>;

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
  const [state, setState] = useState<StreamState>({
    status: "idle",
    error: null,
    messages: [],
    sources: [],
    runLog: [],
    queries: [],
    currentDraft: null,
    currentDraftCitations: [],
    activeNode: null,
    completedNodes: [],
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isCompletedRef = useRef(false);

  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY_MS = 2000;

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset completion state
    isCompletedRef.current = false;

    setState((prev) => ({ ...prev, status: "idle" }));
  }, []);

  /**
   * Handle individual SSE events
   */
  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
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

            return {
              ...prev,
              status: "completed",
              messages: finalMessages,
              currentDraft: null,
              currentDraftCitations: [],
              activeNode: null,
            };
          });

          disconnect();
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

          setState((prev) => ({
            ...prev,
            status: "error",
            error: errorMessage,
          }));

          onError?.(errorMessage);
          disconnect();
          break;
        }

        case "keepalive":
          // Ignore keep-alive pings
          break;

        default:
          // Ignore unknown event types
          break;
      }
    },
    [disconnect, onComplete, onError]
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

    // Don't reconnect if already streaming or completed
    if (
      state.status === "streaming" ||
      state.status === "completed" ||
      isCompletedRef.current
    ) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setState((prev) => ({ ...prev, status: "connecting", error: null }));

    const eventSource = new EventSource(`/api/stream/${threadId}`);
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.onopen = () => {
      setState((prev) => ({ ...prev, status: "streaming" }));
      reconnectAttempts.current = 0;
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
    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      // Don't attempt reconnection if stream was completed
      if (isCompletedRef.current) {
        return;
      }

      // Attempt reconnection
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;

        setState((prev) => ({
          ...prev,
          status: "connecting",
          error: `Reconnecting... (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`,
        }));

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS);
      } else {
        const errorMessage = "Connection failed after multiple attempts";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
        onError?.(errorMessage);
      }
    };
  }, [threadId, state.status, onError, handleSSEEvent]);

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
