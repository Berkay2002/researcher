/**
 * Provider Types for LangGraph Integration
 *
 * Simplified types that work with the LangGraph SDK
 */

import type { Message } from "@langchain/langgraph-sdk";
import type { UIMessage } from "@langchain/langgraph-sdk/react-ui";
import type { MessageData, RunLogEntry, SourceCardData } from "@/types/ui";

/**
 * Unified stream state that works with the LangGraph SDK
 */
export type UnifiedStreamState = {
  // Common state
  messages: MessageData[];
  status: "idle" | "connecting" | "streaming" | "completed" | "error";
  error: string | null;
  threadId: string | null;

  // Custom SSE specific state (kept for backward compatibility)
  sources?: SourceCardData[];
  runLog?: RunLogEntry[];
  currentDraft?: string | null;
  currentDraftCitations?: { claim: string; sources: string[] }[];
  activeNode?: string | null;
  completedNodes?: string[];

  // SDK specific state
  ui?: UIMessage[];

  // Raw SDK messages for compatibility
  sdkMessages?: Message[];
};

/**
 * Stream provider configuration
 */
export type StreamProviderConfig = {
  apiUrl: string;
  assistantId: string;
  apiKey?: string | null;
  threadId?: string | null;
  autoConnect?: boolean;
  customHeaders?: Record<string, string>;
};

/**
 * Thread provider configuration
 */
export type ThreadProviderConfig = {
  apiUrl: string;
  assistantId: string;
  apiKey?: string | null;
};

/**
 * Provider context value
 */
export type StreamContextValue = {
  // State
  state: UnifiedStreamState;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: { text: string }) => Promise<void>;

  // Computed values
  isConnected: boolean;
  isLoading: boolean;

  // Configuration
  config: StreamProviderConfig;
};

/**
 * Thread context value
 */
export type ThreadContextValue = {
  // State
  threads: Array<{
    id: string;
    threadId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  }>;
  isLoading: boolean;

  // Actions
  getThreads: () => Promise<
    Array<{
      id: string;
      threadId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      metadata?: Record<string, unknown>;
    }>
  >;
  setThreads: (
    threads: Array<{
      id: string;
      threadId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      metadata?: Record<string, unknown>;
    }>
  ) => void;
  createThread: (title?: string) => Promise<string>;
  deleteThread: (threadId: string) => Promise<void>;

  // Configuration
  config: ThreadProviderConfig;
};

/**
 * Message adapter types
 */
export type MessageAdapter = {
  toMessageData: (message: Message) => MessageData;
  fromMessageData: (messageData: MessageData) => Message;
};
