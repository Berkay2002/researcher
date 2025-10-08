/**
 * UI Type Definitions
 *
 * Bridge types between LangGraph state schema and UI components.
 * Maps server-side types to client-friendly formats.
 */

import type { ReactAgentState } from "@/server/agents/react/state";
import type {
  SearchRunMetadata,
  TodoItem,
  ToolCallMetadata,
} from "@/server/types/react-agent";

export type {
  SearchRunMetadata,
  TodoItem,
  ToolCallMetadata,
} from "@/server/types/react-agent";

import type {
  Citation,
  Draft,
  Evidence,
  ResearchState,
  UnifiedSearchDoc,
} from "@/server/workflows/researcher/graph/state";

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * Server-Sent Event types from /api/stream/[threadId]
 */
export type SSEEventType =
  | "node"
  | "draft"
  | "evidence"
  | "queries"
  | "citations"
  | "issues"
  | "messages"
  | "todos"
  | "tool_calls"
  | "search_runs"
  | "llm_token"
  | "custom"
  | "error"
  | "done"
  | "keepalive";

/**
 * Base SSE event structure
 */
export type SSEEvent<T = unknown> = {
  type: SSEEventType;
  data: T;
  timestamp?: string;
};

/**
 * Node execution event
 */
export type NodeEvent = SSEEvent<{
  node: string;
  status: "started" | "completed" | "failed";
  duration?: number;
}>;

/**
 * Draft update event (streaming narrative)
 */
export type DraftEvent = SSEEvent<{
  text: string;
  citations: Citation[];
  confidence?: number;
  delta?: string; // Incremental text chunk
}>;

/**
 * Evidence (source) event
 */
export type EvidenceEvent = SSEEvent<{
  sources: Evidence[];
}>;

/**
 * Search queries event
 */
export type QueriesEvent = SSEEvent<{
  queries: string[];
}>;

/**
 * Citations event
 */
export type CitationsEvent = SSEEvent<{
  citations: Citation[];
}>;

/**
 * Quality issues event
 */
export type IssuesEvent = SSEEvent<{
  issues: string[];
}>;

/**
 * LLM token streaming event
 */
export type LLMTokenEvent = SSEEvent<{
  token: string;
  node: string;
}>;

/**
 * Custom event for arbitrary data
 */
export type CustomEvent = SSEEvent<Record<string, unknown>>;

/**
 * Error event
 */
export type ErrorEvent = SSEEvent<{
  message: string;
  code?: string;
  node?: string;
}>;

/**
 * Done event (stream complete)
 */
export type DoneEvent = SSEEvent<{
  threadId: string;
  status: "completed" | "interrupted" | "failed";
}>;

/**
 * Keep-alive ping event
 */
export type KeepAliveEvent = SSEEvent<null>;

/**
 * ReAct agent message batch event
 */
export type MessagesEvent = SSEEvent<{
  messages: unknown[];
}>;

/**
 * ReAct agent todo list event
 */
export type TodosEvent = SSEEvent<{
  todos: TodoItem[];
}>;

/**
 * ReAct agent tool call metadata event
 */
export type ToolCallsEvent = SSEEvent<{
  toolCalls: ToolCallMetadata[];
}>;

/**
 * ReAct agent search run metadata event
 */
export type SearchRunsEvent = SSEEvent<{
  searchRuns: SearchRunMetadata[];
}>;

// ============================================================================
// UI Data Types
// ============================================================================

/**
 * Source card data for Sources Panel
 */
export type SourceCardData = {
  id: string;
  url: string;
  title: string;
  host: string;
  date: string | null;
  snippet: string;
  excerpt: string; // Supporting excerpt
  whyUsed: string; // Why this source was used
  isPinned: boolean;
  metadata?: {
    type?: string;
    author?: string;
    published?: string;
    stage?: "discovery" | "enriched" | "final" | "evidence";
  };
};

/**
 * Message data for chat interface
 */
export type MessageData = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  citations?: CitationData[];
  metadata?: {
    node?: string;
    confidence?: number;
    streaming?: boolean;
    isInterrupt?: boolean;
    interruptData?: unknown;
  };
};

/**
 * Citation data for inline citations
 */
export type CitationData = {
  id: string;
  text: string; // Cited text span
  sources: string[]; // URLs
  position: {
    start: number;
    end: number;
  };
};

/**
 * Thread history entry for API and storage
 */
export type ThreadHistoryEntry = {
  id: string;
  title: string;
  goal: string;
  mode: "auto" | "plan";
  status: "started" | "running" | "completed" | "interrupted" | "error";
  createdAt: string;
  updatedAt: string;
  lastActivity?: string;
  checkpointId?: string;
  metadata?: {
    step?: string;
    progress?: number;
    citations?: number;
    sources?: number;
  };
};

/**
 * Thread metadata for thread list
 */
export type ThreadMetadata = {
  threadId: string;
  title: string; // Auto-generated from goal
  goal: string;
  status: "running" | "completed" | "interrupted" | "failed";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  mode: "auto" | "plan";
  preview?: string; // First few words of result
};

/**
 * Run log entry for execution timeline
 */
export type RunLogEntry = {
  id: string;
  timestamp: string;
  node: string;
  status: "started" | "completed" | "failed";
  duration?: number;
  details?: string;
  toolCalls?: {
    tool: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
  }[];
  cost?: {
    tokens: number;
    usd: number;
  };
};

/**
 * Filter state for sources panel
 */
export type SourcesFilter = {
  domain: string | null;
  dateRange: {
    start: string | null;
    end: string | null;
  } | null;
  showPinnedOnly: boolean;
  searchQuery: string;
};

/**
 * Supported agent types rendered by the dashboard.
 */
export type ThreadAgentType = "workflow" | "react";

/**
 * Workflow (two-pass research pipeline) state exposed to the UI.
 */
export type WorkflowThreadValues = {
  userInputs?: {
    goal: string;
    modeOverride?: "auto" | "plan";
    modeFinal?: "auto" | "plan";
  };
  plan?: {
    goal: string;
    deliverable: string;
    dag?: string[];
    constraints?: Record<string, unknown>;
  };
  queries?: string[];
  research?: ResearchState | null;
  evidence?: Evidence[];
  draft?: Draft;
  issues?: string[];
};

/**
 * React agent runtime context shared with tools.
 */
export type ReactAgentContext = {
  sessionId?: string;
  userId?: string;
  locale?: string;
};

/**
 * ReAct agent state projected for the dashboard.
 */
export type ReactAgentThreadValues = Omit<
  Partial<ReactAgentState>,
  "context"
> & {
  context?: ReactAgentContext | null;
  reactMetadata?: Record<string, unknown>;
};

/**
 * Combined thread state values supporting both workflows and agents.
 */
export type ThreadStateValues = WorkflowThreadValues &
  ReactAgentThreadValues & {
    agentType?: ThreadAgentType;
    [key: string]: unknown;
  };

/**
 * Thread state snapshot
 */
export type ThreadStateSnapshot = {
  threadId: string;
  values: ThreadStateValues;
  next: string[];
  interrupt?: unknown; // Interrupt payload from LangGraph
  checkpointId: string | null;
  metadata?: {
    createdAt: string;
    updatedAt: string;
  } | null;
};

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Type guard for SSE events
 */
export function isSSEEvent(data: unknown): data is SSEEvent {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    "data" in data
  );
}

/**
 * Type guard for specific event types
 */
export function isEventType<T extends SSEEventType>(
  event: SSEEvent,
  type: T
): event is SSEEvent<Extract<SSEEvent, { type: T }>["data"]> {
  return event.type === type;
}

/**
 * Determine if a snapshot belongs to the legacy research workflow.
 */
export function isWorkflowThreadStateSnapshot(
  snapshot: ThreadStateSnapshot | null | undefined
): snapshot is ThreadStateSnapshot & { values: WorkflowThreadValues } {
  const values = snapshot?.values;
  if (!values) {
    return false;
  }
  if (values.agentType === "workflow") {
    return true;
  }
  const userInputs = values.userInputs;
  return (
    typeof userInputs?.goal === "string" && userInputs.goal.trim().length > 0
  );
}

/**
 * Determine if a snapshot belongs to the ReAct agent implementation.
 */
export function isReactAgentThreadStateSnapshot(
  snapshot: ThreadStateSnapshot | null | undefined
): snapshot is ThreadStateSnapshot & { values: ReactAgentThreadValues } {
  const values = snapshot?.values;
  if (!values) {
    return false;
  }
  if (values.agentType === "react") {
    return true;
  }
  return (
    Array.isArray(values.messages) ||
    Array.isArray(values.todos) ||
    Array.isArray(values.recentToolCalls) ||
    Array.isArray(values.searchRuns)
  );
}

/**
 * Infer the thread's agent type using explicit metadata or structural hints.
 */
export function inferThreadAgentType(
  snapshot: ThreadStateSnapshot | null | undefined
): ThreadAgentType | null {
  if (!snapshot?.values) {
    return null;
  }
  if (snapshot.values.agentType) {
    return snapshot.values.agentType;
  }
  if (isReactAgentThreadStateSnapshot(snapshot)) {
    return "react";
  }
  if (isWorkflowThreadStateSnapshot(snapshot)) {
    return "workflow";
  }
  return null;
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert UnifiedSearchDoc to SourceCardData
 */
export function unifiedDocToSourceCard(
  doc: UnifiedSearchDoc,
  options: { stage?: "discovery" | "enriched" | "final" } = {}
): SourceCardData {
  const stage = options.stage ?? "discovery";
  const url = new URL(doc.url);
  const snippet =
    doc.excerpt ||
    (Array.isArray(doc.highlights) ? doc.highlights.join(" … ") : "");
  const excerpt = doc.content?.substring(0, MAX_EXCERPT_LENGTH) || snippet;

  const stageLabel: Record<"discovery" | "enriched" | "final", string> = {
    discovery: "Identified during meta-search discovery",
    enriched: "Content fetched during enrichment",
    final: "Curated for final research set",
  };

  return {
    id: doc.id || doc.url,
    url: doc.url,
    title: doc.title || url.hostname,
    host: doc.hostname || url.hostname,
    date: doc.publishedAt || null,
    snippet,
    excerpt,
    whyUsed: stageLabel[stage],
    isPinned: false,
    metadata: {
      type: doc.provider,
      author: doc.author ?? undefined,
      published: doc.publishedAt ?? undefined,
      stage,
    },
  };
}

/**
 * Convert Evidence to SourceCardData
 */
export function evidenceToSourceCard(evidence: Evidence): SourceCardData {
  const url = new URL(evidence.url);

  return {
    id: evidence.url, // Use URL as ID for deduplication
    url: evidence.url,
    title: evidence.title || url.hostname,
    host: url.hostname,
    date: null, // Evidence type doesn't include date information
    snippet: evidence.snippet || "",
    excerpt: evidence.chunks[0]?.content || evidence.snippet || "", // Use first chunk as excerpt
    whyUsed: `Retrieved from ${evidence.source}`, // Default explanation with source info
    isPinned: false, // Default unpinned
    metadata: {
      type: evidence.source, // Use source (tavily/exa) as type
      author: undefined, // Not available in Evidence type
      published: undefined, // Not available in Evidence type
      stage: "evidence",
    },
  };
}

/**
 * Convert Draft to MessageData
 */
export function draftToMessage(draft: Draft, threadId: string): MessageData {
  return {
    id: `draft-${threadId}`,
    role: "assistant",
    content: draft.text,
    timestamp: new Date().toISOString(),
    citations: draft.citations.map((citation, index) => ({
      id: `citation-${index}`,
      text: citation.excerpt,
      sources: [citation.url],
      position: {
        start: 0, // Would need text analysis to find actual positions
        end: citation.excerpt.length,
      },
    })),
    metadata: {
      confidence: draft.confidence,
      streaming: false,
    },
  };
}

/**
 * Generate thread title from goal
 */
const MAX_TITLE_LENGTH = 50;
const MAX_EXCERPT_LENGTH = 480;

export function generateThreadTitle(goal: string): string {
  // Remove extra whitespace
  const cleaned = goal.trim().replace(/\s+/g, " ");

  // Truncate if too long
  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned;
  }

  // Find last complete word within limit
  const truncated = cleaned.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 0
    ? `${truncated.slice(0, lastSpace)}...`
    : `${truncated}...`;
}

/**
 * Parse SSE message from EventSource
 */
const NODE_STATUS_VALUES = new Set(["started", "completed", "failed"]);
const DONE_STATUS_VALUES = new Set(["completed", "interrupted", "failed"]);

function safeJsonParse(rawData: string): unknown {
  if (!rawData) {
    return null;
  }

  try {
    return JSON.parse(rawData) as unknown;
  } catch {
    return rawData;
  }
}

function normalizeDraftPayload(data: unknown): DraftEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const draftPayload =
    typeof record.draft === "object" && record.draft !== null
      ? (record.draft as Record<string, unknown>)
      : record;

  let text = "";
  if (typeof draftPayload.text === "string") {
    text = draftPayload.text;
  } else if (typeof record.text === "string") {
    text = record.text;
  }

  let delta: string | undefined;
  if (typeof draftPayload.delta === "string") {
    delta = draftPayload.delta;
  } else if (typeof record.delta === "string") {
    delta = record.delta;
  }

  let citations: Citation[] = [];
  if (Array.isArray(draftPayload.citations)) {
    citations = draftPayload.citations as Citation[];
  } else if (Array.isArray(record.citations)) {
    citations = record.citations as Citation[];
  }

  let confidence: number | undefined;
  if (typeof draftPayload.confidence === "number") {
    confidence = draftPayload.confidence;
  } else if (typeof record.confidence === "number") {
    confidence = record.confidence;
  }

  return {
    text,
    citations,
    confidence,
    delta,
  };
}

function normalizeEvidencePayload(data: unknown): EvidenceEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  let sources: Evidence[] = [];
  if (Array.isArray(record.sources)) {
    sources = record.sources as Evidence[];
  } else if (Array.isArray(record.evidence)) {
    sources = record.evidence as Evidence[];
  }

  return { sources };
}

function normalizeQueriesPayload(data: unknown): QueriesEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const queries = Array.isArray(record.queries)
    ? (record.queries as string[])
    : [];

  return { queries };
}

function normalizeCitationsPayload(data: unknown): CitationsEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const citations = Array.isArray(record.citations)
    ? (record.citations as Citation[])
    : [];

  return { citations };
}

function normalizeIssuesPayload(data: unknown): IssuesEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const issues = Array.isArray(record.issues)
    ? (record.issues as string[])
    : [];

  return { issues };
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const status = record.status;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    (status === "pending" || status === "completed")
  );
}

function isToolCallMetadata(value: unknown): value is ToolCallMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.toolName === "string" && typeof record.invokedAt === "string"
  );
}

function isSearchRunMetadata(value: unknown): value is SearchRunMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const provider = record.provider;
  return (
    typeof record.query === "string" &&
    (provider === "tavily" || provider === "exa") &&
    typeof record.startedAt === "string"
  );
}

function normalizeMessagesPayload(data: unknown): MessagesEvent["data"] {
  if (Array.isArray(data)) {
    return { messages: data };
  }
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.messages)) {
      return { messages: record.messages };
    }
  }
  return { messages: [] };
}

function normalizeTodosPayload(data: unknown): TodosEvent["data"] {
  const candidate: unknown[] = (() => {
    if (Array.isArray(data)) {
      return data;
    }
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.todos)) {
        return record.todos;
      }
      if (Array.isArray(record.todoItems)) {
        return record.todoItems;
      }
    }
    return [] as unknown[];
  })();
  const todos = candidate.filter(isTodoItem);
  return { todos };
}

function normalizeToolCallsPayload(data: unknown): ToolCallsEvent["data"] {
  const candidate: unknown[] = (() => {
    if (Array.isArray(data)) {
      return data;
    }
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.toolCalls)) {
        return record.toolCalls;
      }
      if (Array.isArray(record.tool_calls)) {
        return record.tool_calls;
      }
    }
    return [] as unknown[];
  })();
  const toolCalls = candidate.filter(isToolCallMetadata);
  return { toolCalls };
}

function normalizeSearchRunsPayload(data: unknown): SearchRunsEvent["data"] {
  const candidate: unknown[] = (() => {
    if (Array.isArray(data)) {
      return data;
    }
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.searchRuns)) {
        return record.searchRuns;
      }
      if (Array.isArray(record.search_runs)) {
        return record.search_runs;
      }
    }
    return [] as unknown[];
  })();
  const searchRuns = candidate.filter(isSearchRunMetadata);
  return { searchRuns };
}

function normalizeNodePayload(data: unknown): NodeEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const update =
    typeof record.update === "object" && record.update !== null
      ? (record.update as Record<string, unknown>)
      : {};

  const rawStatus = (() => {
    if (typeof record.status === "string") {
      return record.status;
    }
    if (typeof update.status === "string") {
      return update.status;
    }
    return;
  })();

  const status = NODE_STATUS_VALUES.has(rawStatus as string)
    ? (rawStatus as NodeEvent["data"]["status"])
    : "completed";

  let durationCandidate: number | undefined;
  if (typeof record.duration === "number") {
    durationCandidate = record.duration;
  } else if (typeof update.duration === "number") {
    durationCandidate = update.duration;
  } else if (typeof update.elapsed_ms === "number") {
    durationCandidate = update.elapsed_ms;
  }

  let node = "unknown";
  if (typeof record.node === "string") {
    node = record.node;
  } else if (typeof update.node === "string") {
    node = update.node;
  }

  return {
    node,
    status,
    duration: durationCandidate,
  };
}

function normalizeErrorPayload(data: unknown): ErrorEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  let message = "Unknown error";
  if (typeof record.message === "string") {
    message = record.message;
  }
  if (message === "Unknown error" && typeof record.error === "string") {
    message = record.error;
  }

  const code = typeof record.code === "string" ? record.code : undefined;

  const node = typeof record.node === "string" ? record.node : undefined;

  return { message, code, node };
}

function normalizeDonePayload(data: unknown): DoneEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  const statusCandidate =
    typeof record.status === "string" ? record.status : undefined;

  const status = DONE_STATUS_VALUES.has(statusCandidate as string)
    ? (statusCandidate as DoneEvent["data"]["status"])
    : "completed";

  const threadId = typeof record.threadId === "string" ? record.threadId : "";

  return { threadId, status };
}

function normalizeLLMTokenPayload(data: unknown): LLMTokenEvent["data"] {
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  let token = "";
  if (typeof record.token === "string") {
    token = record.token;
  } else if (typeof record.delta === "string") {
    token = record.delta;
  }

  let node = "unknown";
  if (typeof record.node === "string") {
    node = record.node;
  } else if (
    typeof record.metadata === "object" &&
    record.metadata !== null &&
    typeof (record.metadata as Record<string, unknown>).langgraph_node ===
      "string"
  ) {
    node = (record.metadata as Record<string, unknown>)
      .langgraph_node as string;
  }

  return { token, node };
}

function normalizeCustomPayload(data: unknown): CustomEvent["data"] {
  return typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)
    : { value: data };
}

function normalizeEventData(
  eventType: SSEEventType,
  data: unknown
): SSEEvent["data"] {
  switch (eventType) {
    case "draft":
      return normalizeDraftPayload(data);
    case "evidence":
      return normalizeEvidencePayload(data);
    case "queries":
      return normalizeQueriesPayload(data);
    case "citations":
      return normalizeCitationsPayload(data);
    case "issues":
      return normalizeIssuesPayload(data);
    case "messages":
      return normalizeMessagesPayload(data);
    case "todos":
      return normalizeTodosPayload(data);
    case "tool_calls":
      return normalizeToolCallsPayload(data);
    case "search_runs":
      return normalizeSearchRunsPayload(data);
    case "node":
      return normalizeNodePayload(data);
    case "error":
      return normalizeErrorPayload(data);
    case "done":
      return normalizeDonePayload(data);
    case "llm_token":
      return normalizeLLMTokenPayload(data);
    case "custom":
      return normalizeCustomPayload(data);
    case "keepalive":
      return null;
    default:
      return typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)
        : {};
  }
}

export function parseSSEMessage(
  rawData: string,
  eventType?: SSEEventType
): SSEEvent | null {
  const parsed = safeJsonParse(rawData);

  if (isSSEEvent(parsed)) {
    return parsed;
  }

  if (!eventType) {
    return null;
  }

  const timestamp =
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as Record<string, unknown>).timestamp === "string"
      ? ((parsed as Record<string, unknown>).timestamp as string)
      : undefined;

  return {
    type: eventType,
    data: normalizeEventData(eventType, parsed),
    timestamp,
  };
}

/**
 * Time constants
 */
const SECONDS_IN_MINUTE = 60;
const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;
const MS_IN_SECOND = 1000;

const MINUTE_MS = SECONDS_IN_MINUTE * MS_IN_SECOND;
const HOUR_MS = SECONDS_IN_MINUTE * MINUTE_MS;
const DAY_MS = HOURS_IN_DAY * HOUR_MS;
const WEEK_MS = DAYS_IN_WEEK * DAY_MS;

// ============================================================================
// Chat and Prompt Input Types (LangGraph compatible)
// ============================================================================

/**
 * Chat status for UI components (replaces Vercel AI SDK ChatStatus)
 */
export type ChatStatus = "idle" | "submitted" | "streaming" | "error";

/**
 * File attachment for prompt input (replaces Vercel AI SDK FileUIPart)
 */
export type FileAttachment = {
  id: string;
  type: "file";
  url: string;
  mediaType?: string;
  filename?: string;
};

// ============================================================================
// Timestamp Formatting
// ============================================================================

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  // Validate input
  if (!timestamp) {
    return "Invalid timestamp";
  }

  const date = new Date(timestamp);

  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return "Invalid timestamp";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future timestamps
  if (diffMs < 0) {
    return "Just now";
  }

  if (diffMs < MINUTE_MS) {
    return "Just now";
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes}m ago`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours}h ago`;
  }

  if (diffMs < WEEK_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    return `${days}d ago`;
  }

  // Format as date for older entries
  return date.toLocaleDateString();
}
