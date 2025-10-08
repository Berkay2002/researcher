/**
 * Stream Provider
 *
 * Enhanced provider that fully utilizes LangGraph SDK's useStream hook.
 * Replaces custom SSE implementation with SDK-based streaming.
 */

"use client";

import { useStream } from "@langchain/langgraph-sdk/react";
import type React from "react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

type StreamContextType = ReturnType<typeof useStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

// Default values
const DEFAULT_API_URL = "/api/langgraph";
const DEFAULT_ASSISTANT_ID = "agent";

export const StreamProvider: React.FC<{
  children: ReactNode;
  threadId: string | null;
}> = ({ children, threadId }) => {
  // Get environment variables
  const envApiUrl: string | undefined =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL;
  const envAssistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID;

  // Get API key from localStorage
  const apiKey =
    typeof window !== "undefined"
      ? window.localStorage.getItem("lg:chat:apiKey") || ""
      : "";

  // Determine final values to use, prioritizing env vars
  const finalApiUrl = envApiUrl || DEFAULT_API_URL;
  const finalAssistantId = envAssistantId || DEFAULT_ASSISTANT_ID;

  // Callbacks for SDK events
  const handleError = useCallback((error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: <Error logging>
    console.error("Stream error:", error);
  }, []);

  const handleUpdateEvent = useCallback(
    (
      data: Record<string, unknown>,
      options: { namespace: string[] | undefined }
    ) => {
      // Log updates for debugging
      // biome-ignore lint/suspicious/noConsole: <Debug logging>
      console.log("Update event:", data, "namespace:", options.namespace);
    },
    []
  );

  const handleCustomEvent = useCallback(
    (data: unknown, options: { namespace: string[] | undefined }) => {
      // Log custom events for debugging
      // biome-ignore lint/suspicious/noConsole: <Debug logging>
      console.log("Custom event:", data, "namespace:", options.namespace);
    },
    []
  );

  const streamOptions = useMemo(
    () => ({
      apiUrl: finalApiUrl,
      apiKey: apiKey || undefined,
      assistantId: finalAssistantId,
      threadId,
      fetchStateHistory: true,
      messagesKey: "messages",
      onError: handleError,
      onUpdateEvent: handleUpdateEvent,
      onCustomEvent: handleCustomEvent,
    }),
    [
      finalApiUrl,
      apiKey,
      finalAssistantId,
      threadId,
      handleError,
      handleUpdateEvent,
      handleCustomEvent,
    ]
  );

  const streamValue = useStream(streamOptions);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

// Create a custom hook to use the context
export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
