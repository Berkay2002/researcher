/**
 * UI Type Definitions
 *
 * Bridge types between LangGraph state schema and UI components.
 * Maps server-side types to client-friendly formats.
 */

import type {
  Citation,
  Draft,
  Evidence,
  SearchResult,
} from "@/server/graph/state";

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
 * Thread state snapshot
 */
export type ThreadStateSnapshot = {
  threadId: string;
  values: {
    userInputs: {
      goal: string;
      modeOverride?: "auto" | "plan";
      modeFinal?: "auto" | "plan";
    };
    plan?: {
      goal: string;
      deliverable: string;
      constraints?: Record<string, unknown>;
    };
    queries?: string[];
    searchResults?: SearchResult[];
    evidence?: Evidence[];
    draft?: Draft;
    issues?: string[];
  };
  next: string[];
  checkpointId: string;
  metadata?: {
    createdAt: string;
    updatedAt: string;
  };
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

// ============================================================================
// Conversion Utilities
// ============================================================================

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
export function parseSSEMessage(rawData: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(rawData) as unknown;

    if (isSSEEvent(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
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
