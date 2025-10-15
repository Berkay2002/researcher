/** biome-ignore-all lint/suspicious/noConsole: Development logging for agent thread state transitions and debugging */
"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import { ResearchMessage } from "@/app/(components)/research-message";
import { RunLog } from "@/app/(components)/run-log";
import { ThreadList } from "@/app/(components)/thread-list";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAgentStream } from "@/lib/hooks/use-agent-stream";
import { useAgentThread } from "@/lib/hooks/use-agent-thread";
import {
  agentStateToMessages,
  formatSearchRunForLog,
  formatToolCallForLog,
  isAgentCompleted,
  isAgentExecuting,
} from "@/lib/utils/agent-transforms";
import type { RunLogEntry, ThreadMetadata } from "@/types/ui";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Agent Thread View Page
 *
 * Main React agent thread view with SDK-based hooks.
 * Reuses visual components from researcher workflow.
 *
 * Layout:
 * - Left: Thread history
 * - Center: Agent conversation
 * - Right: (Optional) Execution log / metadata
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex component managing agent state, streaming, UI state, and lifecycle hooks - requires multiple state checks and effect handlers
export default function AgentThreadViewPage() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch thread state via SDK
  const {
    state,
    isLoading,
    error: stateError,
  } = useAgentThread({
    threadId: threadId || null,
    autoFetch: true,
  });

  // Connect to streaming via SDK
  const {
    messages: streamMessages,
    todos: streamTodos,
    recentToolCalls,
    searchRuns,
    isStreaming,
    error: streamError,
    connect,
    disconnect,
  } = useAgentStream({
    threadId: threadId || null,
    autoConnect: false,
  });

  // Combine messages from state and stream
  const allMessages = useMemo(() => {
    // MessagesZodState.shape.messages is typed as unknown but is BaseMessage[] at runtime
    const stateMessagesRaw = state?.values?.messages;
    const stateMessages = Array.isArray(stateMessagesRaw)
      ? stateMessagesRaw
      : [];
    const combinedMessages = [...stateMessages, ...streamMessages];

    // Deduplicate by content
    const seen = new Set<string>();
    return combinedMessages.filter((msg) => {
      const key = `${msg._getType()}-${msg.content}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [state?.values?.messages, streamMessages]);

  // Transform to UI format
  const displayMessages = useMemo(
    () => agentStateToMessages(allMessages),
    [allMessages]
  );

  // Combine todos
  const allTodos = useMemo(() => {
    const stateTodos = state?.values?.todos || [];
    const uniqueTodos = new Map<string, (typeof stateTodos)[number]>();

    for (const todo of stateTodos) {
      uniqueTodos.set(todo.id, todo);
    }
    for (const todo of streamTodos) {
      uniqueTodos.set(todo.id, todo);
    }

    return Array.from(uniqueTodos.values());
  }, [state?.values?.todos, streamTodos]);

  // Build run log from tool calls and search runs
  const runLog = useMemo(() => {
    const entries: RunLogEntry[] = [];

    // Convert tool calls to RunLogEntry format
    for (const toolCall of recentToolCalls) {
      entries.push({
        id: `tool-${toolCall.invokedAt}`,
        timestamp: toolCall.invokedAt,
        node: toolCall.toolName,
        status: "completed" as const,
        details: formatToolCallForLog(toolCall),
      });
    }

    // Convert search runs to RunLogEntry format
    for (const searchRun of searchRuns) {
      const startTime = new Date(searchRun.startedAt).getTime();
      const endTime = searchRun.completedAt
        ? new Date(searchRun.completedAt).getTime()
        : Date.now();
      const duration = endTime - startTime;

      entries.push({
        id: `search-${searchRun.startedAt}`,
        timestamp: searchRun.startedAt,
        node: `search_${searchRun.provider}`,
        status: searchRun.completedAt
          ? ("completed" as const)
          : ("started" as const),
        duration,
        details: formatSearchRunForLog(searchRun),
      });
    }

    // Sort by timestamp
    return entries.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [recentToolCalls, searchRuns]);

  // Determine execution status
  const isExecuting = useMemo(
    () => isStreaming || isAgentExecuting(state?.next),
    [isStreaming, state?.next]
  );

  const isCompleted = useMemo(
    () => !isExecuting && isAgentCompleted(state?.next),
    [isExecuting, state?.next]
  );

  /**
   * Manage streaming connection based on thread state
   */
  useEffect(() => {
    if (!(threadId && state)) {
      return;
    }

    // Start streaming if graph is executing
    if (isAgentExecuting(state.next) && !isStreaming) {
      if (isDev) {
        console.log("[AgentThread] Starting stream");
      }
      connect();
    }

    // Stop streaming if completed
    if (isAgentCompleted(state.next) && isStreaming) {
      if (isDev) {
        console.log("[AgentThread] Stopping stream (completed)");
      }
      disconnect();
    }
  }, [threadId, state, isStreaming, connect, disconnect]);

  /**
   * Handle prompt submission (currently disabled - agent runs on initial input)
   */
  const handlePromptSubmit = useCallback(
    (message: { text?: string }) => {
      if (!(threadId && message.text?.trim())) {
        return;
      }

      setIsSubmitting(true);
      setInputValue("");

      try {
        // TODO: Implement follow-up message handling
        // For now, agent only processes initial input
        console.log("Follow-up message submitted:", message.text);
      } catch (err) {
        console.error("Failed to submit message:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId]
  );

  /**
   * Delete thread handler (placeholder)
   */
  const handleDeleteThread = useCallback((deletedThreadId: string) => {
    setThreads((prev) => prev.filter((t) => t.threadId !== deletedThreadId));
  }, []);

  /**
   * Load threads from localStorage (simple persistence)
   */
  useEffect(() => {
    const storedThreads = localStorage.getItem("agent-threads");
    if (storedThreads) {
      try {
        const parsed = JSON.parse(storedThreads) as ThreadMetadata[];
        setThreads(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setIsLeftPanelVisible(open);
  }, []);

  /**
   * Get empty state description
   */
  const getEmptyStateDescription = () => {
    if (isExecuting) {
      return "The agent is working on your request...";
    }
    if (isCompleted) {
      return "Task completed successfully.";
    }
    return "Waiting for agent to start...";
  };

  /**
   * Get empty state title
   */
  const getEmptyStateTitle = () => {
    if (isExecuting) {
      return "Agent Running";
    }
    if (isCompleted) {
      return "All Done!";
    }
    return "Starting Agent";
  };

  if (!threadId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No thread ID provided</p>
      </div>
    );
  }

  if (isLoading && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stateError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error loading thread</p>
          <p className="mt-2 text-muted-foreground text-sm">{stateError}</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      centerPanel={
        <div className="flex h-full min-h-0 flex-1 flex-col">
          {/* Conversation Area */}
          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              {displayMessages.length === 0 ? (
                <ConversationEmptyState
                  description={getEmptyStateDescription()}
                  icon={
                    isExecuting ? (
                      <Loader2Icon className="size-8 animate-spin" />
                    ) : undefined
                  }
                  title={getEmptyStateTitle()}
                />
              ) : (
                displayMessages.map((message) => (
                  <ResearchMessage key={message.id} message={message} />
                ))
              )}
            </ConversationContent>
          </Conversation>

          {/* Error Display */}
          {streamError && (
            <Alert className="mx-4 mb-4" variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{streamError}</AlertDescription>
            </Alert>
          )}

          {/* Run Log */}
          {runLog.length > 0 && (
            <div className="flex-shrink-0">
              <RunLog entries={runLog} isDev={isDev} />
            </div>
          )}

          {/* Todo List Display */}
          {allTodos.length > 0 && (
            <div className="mx-4 mb-4 rounded-md border bg-muted/50 p-4">
              <h3 className="mb-2 font-medium text-sm">Agent Tasks:</h3>
              <ul className="space-y-1">
                {allTodos.map((todo) => (
                  <li className="flex items-center gap-2 text-sm" key={todo.id}>
                    <span className="text-lg">
                      {todo.status === "completed" ? "" : "⏳"}
                    </span>
                    <span
                      className={
                        todo.status === "completed"
                          ? "text-muted-foreground line-through"
                          : ""
                      }
                    >
                      {todo.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prompt Input */}
          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl space-y-2">
              <PromptInput onSubmit={handlePromptSubmit}>
                <PromptInputBody>
                  <PromptInputTextarea
                    disabled={isSubmitting || isExecuting}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      isExecuting
                        ? "Agent is working..."
                        : "Send a follow-up message..."
                    }
                    value={inputValue}
                  />
                </PromptInputBody>
                <PromptInputToolbar>
                  <PromptInputSubmit
                    disabled={isSubmitting || isExecuting || !inputValue.trim()}
                    status={isSubmitting ? "submitted" : undefined}
                  />
                </PromptInputToolbar>
              </PromptInput>
            </div>
          </div>
        </div>
      }
      leftPanel={
        <ThreadList
          activeThreadId={threadId}
          isSidebarOpen={isLeftPanelVisible}
          onDeleteThread={handleDeleteThread}
          onSidebarOpenChange={handleSidebarOpenChange}
          threads={threads}
        />
      }
      leftPanelCollapsed={!isLeftPanelVisible}
    />
  );
}
