/** biome-ignore-all lint/suspicious/noConsole: <Development> */
"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import { InterruptPrompt } from "@/app/(components)/InterruptPrompt";
import { ResearchStatusBar } from "@/app/(components)/research-status-bar";
import { RunLog } from "@/app/(components)/run-log";
import { SourcesPanel } from "@/app/(components)/sources-panel";
import { ThreadList } from "@/app/(components)/thread-list";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSSEStream } from "@/lib/hooks/use-sse-stream";
import { useThreadState } from "@/lib/hooks/use-thread-state";
import type { InterruptPayload } from "@/server/graph/subgraphs/planner/state";
import type { MessageData, SourceCardData, ThreadMetadata } from "@/types/ui";

/**
 * Thread View Page
 *
 * Main research thread view with three-panel layout:
 * - Left: Thread history
 * - Center: Research conversation with interrupt handling
 * - Right: Sources panel
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Complexity is acceptable for main page component>
export default function ThreadViewPage() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [pinnedSources, setPinnedSources] = useState<Set<string>>(new Set());
  const [currentInterrupt, setCurrentInterrupt] =
    useState<InterruptPayload | null>(null);
  const [isResumingInterrupt, setIsResumingInterrupt] = useState(false);
  const [interruptError, setInterruptError] = useState<string | null>(null);
  const [researchStartTime] = useState(Date.now());

  // Fetch thread state
  const {
    snapshot,
    isLoading,
    error: stateError,
    refetch,
  } = useThreadState({
    threadId: threadId || null,
    autoFetch: true,
  });

  // Connect to SSE stream
  const sseStream = useSSEStream({
    threadId: threadId || null,
    autoConnect: true,
  });

  // Build initial message from goal
  const initialMessage: MessageData | null = snapshot?.values?.userInputs?.goal
    ? {
        id: "initial-goal",
        role: "user",
        content: snapshot.values.userInputs.goal,
        timestamp: snapshot.metadata?.createdAt || new Date().toISOString(),
      }
    : null;

  // Combine SSE messages with initial message
  const allMessages: MessageData[] = initialMessage
    ? [initialMessage, ...sseStream.messages]
    : sseStream.messages;

  // Add current streaming draft as temporary message
  const messagesWithDraft: MessageData[] = sseStream.currentDraft
    ? [
        ...allMessages,
        {
          id: "current-draft",
          role: "assistant",
          content: sseStream.currentDraft,
          timestamp: new Date().toISOString(),
          citations: sseStream.currentDraftCitations.map((cit, idx) => ({
            id: `draft-cit-${idx}`,
            text: cit.claim,
            sources: cit.sources,
            position: { start: 0, end: cit.claim.length },
          })),
          metadata: {
            streaming: true,
          },
        },
      ]
    : allMessages;

  // Enhance sources with pinned state
  const sourcesWithPinned: SourceCardData[] = sseStream.sources.map(
    (source) => ({
      ...source,
      isPinned: pinnedSources.has(source.url),
    })
  );

  /**
   * Detect interrupts from thread state
   */

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Complexity is acceptable for main page component>
  useEffect(() => {
    if (snapshot?.next && snapshot.next.length > 0) {
      // Check if we're at an interrupt point
      // LangGraph sets next to [] when interrupted
      const hasInterrupt = snapshot.next.includes("__interrupt__");

      if (hasInterrupt && snapshot.values) {
        // Extract interrupt from state (assuming it's in a specific location)
        // This depends on how your planner stores interrupts
        const interruptData = (snapshot.values as Record<string, unknown>)
          .__interrupt__ as InterruptPayload | undefined;

        if (interruptData) {
          setCurrentInterrupt(interruptData);
        }
      }
    } else if (snapshot?.next && snapshot.next.length === 0) {
      // Empty next array typically means we're at an interrupt
      // Try to extract interrupt from values
      const stateValues = snapshot.values as Record<string, unknown>;
      const interrupt = stateValues.__interrupt__ as
        | InterruptPayload
        | undefined;

      if (interrupt) {
        setCurrentInterrupt(interrupt);
      }
    }
  }, [snapshot]);

  /**
   * Handle interrupt response submission
   */
  const handleInterruptSubmit = useCallback(
    async (response: unknown) => {
      if (!threadId) {
        return;
      }

      setIsResumingInterrupt(true);
      setInterruptError(null);

      try {
        const res = await fetch(`/api/threads/${threadId}/resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resume: response }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Resume failed: ${errorText}`);
        }

        const data = (await res.json()) as {
          ok?: boolean;
          interrupt?: InterruptPayload;
        };

        // Check if there's another interrupt (multi-stage HITL)
        if (data.interrupt) {
          setCurrentInterrupt(data.interrupt);
        } else {
          setCurrentInterrupt(null);
        }

        // Refetch thread state to get updated data
        await refetch();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to resume";
        setInterruptError(errorMessage);
      } finally {
        setIsResumingInterrupt(false);
      }
    },
    [threadId, refetch]
  );

  /**
   * Toggle pin handler
   */
  const handleTogglePin = useCallback((url: string) => {
    setPinnedSources((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }, []);

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
    const storedThreads = localStorage.getItem("research-threads");
    if (storedThreads) {
      try {
        const parsed = JSON.parse(storedThreads) as ThreadMetadata[];
        setThreads(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  if (!threadId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No thread ID provided</p>
      </div>
    );
  }

  if (isLoading && !snapshot) {
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
        <div className="flex h-full flex-col">
          {/* Research Status Bar */}
          {sseStream.sources.length > 0 && (
            <ResearchStatusBar
              content={
                messagesWithDraft.find((msg) => msg.role === "assistant")
                  ?.content
              }
              duration={
                sseStream.status === "completed"
                  ? Date.now() - researchStartTime
                  : undefined
              }
              searchCount={snapshot?.values?.queries?.length}
              sourceCount={sseStream.sources.length}
              status={
                sseStream.status === "connecting"
                  ? "streaming"
                  : sseStream.status
              }
            />
          )}

          {/* Conversation Area */}
          <Conversation className="flex-1">
            {/* Interrupt Prompt (Plan Mode) */}
            {currentInterrupt && (
              <div className="mb-4">
                <InterruptPrompt
                  interrupt={currentInterrupt}
                  isSubmitting={isResumingInterrupt}
                  onSubmit={handleInterruptSubmit}
                />
                {interruptError && (
                  <Alert className="mt-4" variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertDescription>{interruptError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <ConversationContent>
              {messagesWithDraft.length === 0 ? (
                <ConversationEmptyState
                  description={
                    sseStream.status === "connecting"
                      ? "Your research session is starting..."
                      : "Waiting for research to begin..."
                  }
                  icon={
                    sseStream.status === "connecting" ? (
                      <Loader2Icon className="size-8 animate-spin" />
                    ) : undefined
                  }
                  title={
                    sseStream.queries.length > 0
                      ? `Analyzing ${sseStream.queries.length} ${sseStream.queries.length === 1 ? "query" : "queries"}...`
                      : "Research Starting"
                  }
                />
              ) : (
                messagesWithDraft.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageAvatar
                      name={message.role === "user" ? "You" : "AI"}
                      src={message.role === "user" ? "/user.png" : "/ai.png"}
                    />
                    <MessageContent variant="flat">
                      {message.content}
                    </MessageContent>
                  </Message>
                ))
              )}
            </ConversationContent>
          </Conversation>

          {/* Error Display */}
          {sseStream.error && (
            <Alert className="mx-4 mb-4" variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{sseStream.error}</AlertDescription>
            </Alert>
          )}

          {/* Run Log */}
          <RunLog entries={sseStream.runLog} />
        </div>
      }
      leftPanel={
        <ThreadList
          activeThreadId={threadId}
          onDeleteThread={handleDeleteThread}
          threads={threads}
        />
      }
      rightPanel={
        sseStream.sources.length > 0 ? (
          <SourcesPanel
            citations={
              sseStream.currentDraftCitations.length > 0
                ? sseStream.currentDraftCitations.map((cit, idx) => ({
                    id: `draft-cit-${idx}`,
                    text: cit.claim,
                    sources: cit.sources,
                    position: { start: 0, end: cit.claim.length },
                  }))
                : undefined
            }
            onTogglePin={handleTogglePin}
            sources={sourcesWithPinned}
          />
        ) : undefined
      }
    />
  );
}
