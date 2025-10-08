/**
 * Stream Adapter
 *
 * Converts between LangGraph SDK format and custom SSE format.
 * Used primarily by the Researcher workflow for backward compatibility.
 * 
 * Note: The React Agent uses the SDK directly without this adapter.
 */

import type { Message } from "@langchain/langgraph-sdk";
import type { UIMessage } from "@langchain/langgraph-sdk/react-ui";
import type { UnifiedStreamState } from "@/lib/providers/types";
import type {
  MessageData,
  RunLogEntry,
  SearchRunMetadata,
  SourceCardData,
  TodoItem,
  ToolCallMetadata,
} from "@/types/ui";

/**
 * Convert SDK Message to MessageData
 */
export function sdkMessageToMessageData(message: Message): MessageData {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  return {
    id: message.id || `sdk-message-${Date.now()}`,
    role: message.type === "human" ? "user" : "assistant",
    content,
    timestamp: new Date().toISOString(),
    metadata: {
      node: message.additional_kwargs?.langgraph_node as string,
    },
  };
}

/**
 * Convert MessageData to SDK Message
 */
export function messageDataToSdkMessage(messageData: MessageData): Message {
  return {
    id: messageData.id,
    type: messageData.role === "user" ? "human" : "ai",
    content: messageData.content,
    additional_kwargs: messageData.metadata?.node
      ? { langgraph_node: messageData.metadata.node }
      : {},
  } as Message;
}

/**
 * Convert SDK state to UnifiedStreamState
 */
export function sdkStateToUnifiedState(
  sdkState: {
    messages?: Message[];
    values?: Record<string, unknown>;
    status?: string;
  },
  currentThreadId?: string | null
): UnifiedStreamState {
  const messages = (sdkState.messages || []).map(sdkMessageToMessageData);

  // Note: Agent-specific data extraction is commented out for now
  // but can be re-enabled if needed in the future
  // const values = sdkState.values || {};
  // const todos = (values.todos as TodoItem[]) || [];
  // const toolCalls = (values.recentToolCalls as ToolCallMetadata[]) || [];
  // const searchRuns = (values.searchRuns as SearchRunMetadata[]) || [];

  return {
    messages,
    sdkMessages: sdkState.messages || [],
    status: mapSdkStatusToUnified(sdkState.status),
    error: null,
    threadId: currentThreadId || null,
    sources: [],
    runLog: [],
    currentDraft: null,
    currentDraftCitations: [],
    activeNode: null,
    completedNodes: [],
    ui: [],
  };
}

/**
 * Convert SSE state to UnifiedStreamState
 */
export function sseStateToUnifiedState(
  sseState: {
    messages: MessageData[];
    agentMessages: unknown[];
    todos: TodoItem[];
    toolCalls: ToolCallMetadata[];
    searchRuns: SearchRunMetadata[];
    sources: unknown[];
    runLog: unknown[];
    currentDraft: string | null;
    currentDraftCitations: { claim: string; sources: string[] }[];
    activeNode: string | null;
    completedNodes: string[];
    status: "idle" | "connecting" | "streaming" | "completed" | "error";
    error: string | null;
  },
  currentThreadId?: string | null
): UnifiedStreamState {
  return {
    messages: sseState.messages,
    sdkMessages: sseState.agentMessages as Message[],
    status: sseState.status,
    error: sseState.error,
    threadId: currentThreadId || null,
    sources: sseState.sources as SourceCardData[],
    runLog: sseState.runLog as RunLogEntry[],
    currentDraft: sseState.currentDraft,
    currentDraftCitations: sseState.currentDraftCitations,
    activeNode: sseState.activeNode,
    completedNodes: sseState.completedNodes,
    ui: [],
  };
}

/**
 * Map SDK status to unified status
 */
function mapSdkStatusToUnified(
  sdkStatus?: string
): UnifiedStreamState["status"] {
  switch (sdkStatus) {
    case "pending":
    case "starting":
      return "connecting";
    case "streaming":
      return "streaming";
    case "done":
      return "completed";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

/**
 * Convert UI messages to custom events
 */
export function uiMessageToCustomEvent(uiMessage: UIMessage): unknown {
  return {
    type: "custom",
    data: {
      ui: uiMessage,
    },
  };
}

/**
 * Check if a value is a TodoItem
 */
export function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    (record.status === "pending" || record.status === "completed")
  );
}

/**
 * Check if a value is a ToolCallMetadata
 */
export function isToolCallMetadata(value: unknown): value is ToolCallMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.toolName === "string" && typeof record.invokedAt === "string"
  );
}

/**
 * Check if a value is a SearchRunMetadata
 */
export function isSearchRunMetadata(
  value: unknown
): value is SearchRunMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.query === "string" &&
    (record.provider === "tavily" || record.provider === "exa") &&
    typeof record.startedAt === "string"
  );
}
