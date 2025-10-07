/** biome-ignore-all lint/suspicious/noConsole: <Development> */
/** biome-ignore-all lint/complexity/useSimplifiedLogicExpression: <Need Complexity> */
"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import {
  InterruptPrompt,
  type InterruptResponse,
} from "@/app/(components)/InterruptPrompt";
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
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
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
  const RESUME_CONNECT_DELAY_MS = 100; // Delay after resume before reconnecting SSE
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [pinnedSources, setPinnedSources] = useState<Set<string>>(new Set());
  const [currentInterrupt, setCurrentInterrupt] =
    useState<InterruptPayload | null>(null);
  const [researchStartTime] = useState(Date.now());
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasActiveInterrupt, setHasActiveInterrupt] = useState(false);

  const isDev = process.env.NODE_ENV !== "production";

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

  // Connect to SSE stream (don't auto-connect, will manage manually based on thread state)
  const sseStream = useSSEStream({
    threadId: threadId || null,
    autoConnect: false,
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

  // Combine all messages: initial + SSE (interrupts are handled separately)
  let allMessages: MessageData[] = initialMessage ? [initialMessage] : [];
  allMessages = [...allMessages, ...sseStream.messages];

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
  useEffect(() => {
    if (snapshot?.interrupt) {
      // Interrupt data is now directly in snapshot.interrupt
      setCurrentInterrupt(snapshot.interrupt as InterruptPayload);
      setHasActiveInterrupt(true);
    } else {
      // Clear interrupt if none present
      setCurrentInterrupt(null);
      setHasActiveInterrupt(false);
    }

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log("[ThreadView] Snapshot updated", {
        hasInterrupt: Boolean(snapshot?.interrupt),
        hasDraft: Boolean(snapshot?.values?.draft),
        issues: snapshot?.values?.issues?.length ?? 0,
      });
    }
  }, [snapshot, isDev]);

  /**
   * Manage SSE connection based on thread state
   * Only connect when thread is actively running (not interrupted, not completed)
   */
  useEffect(() => {
    if (!threadId || !snapshot) {
      return;
    }

    const hasInterrupt = Boolean(snapshot.interrupt);
    const isCompleted = Boolean(snapshot.next && snapshot.next.length === 0);
    const shouldStream = !hasInterrupt && !isCompleted;

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log("[ThreadView] Stream state", {
        threadId,
        snapshotHasDraft: Boolean(snapshot.values?.draft),
        sseStatus: sseStream.status,
        shouldStream,
        hasInterrupt,
        isCompleted,
      });
    }

    if (shouldStream && sseStream.status === "idle") {
      // Connect only when thread is running and SSE is idle
      sseStream.connect();
    } else if (!shouldStream) {
      // Disconnect when interrupted or completed
      sseStream.disconnect();
    }
  }, [
    threadId,
    snapshot,
    sseStream.status,
    sseStream.connect,
    sseStream.disconnect,
    isDev,
  ]);

  /**
   * Handle interrupt response submission
   */
  const handleInterruptSubmit = useCallback(
    async (response: InterruptResponse) => {
      if (!threadId) {
        return;
      }

      setIsSubmitting(true);
      setHasActiveInterrupt(false);

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
          setHasActiveInterrupt(true);
        } else {
          setCurrentInterrupt(null);
          setHasActiveInterrupt(false);

          // If no new interrupt, the graph can continue running - start SSE
          setTimeout(() => {
            sseStream.connect();
          }, RESUME_CONNECT_DELAY_MS);
        }

        // Refetch thread state to get updated data
        await refetch();
      } catch (err) {
        console.error("Failed to resume interrupt:", err);
        setHasActiveInterrupt(true); // Restore interrupt on error
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, refetch, sseStream.connect]
  );

  /**
   * Handle prompt submission (for regular chat only, interrupts are handled by InterruptPrompt)
   */
  const handlePromptSubmit = useCallback(
    (message: { text?: string }) => {
      if (!(threadId && message.text?.trim())) {
        return;
      }

      if (hasActiveInterrupt) {
        return;
      }

      setIsSubmitting(true);
      setInputValue("");

      try {
        // Submit as a regular message (for future chat functionality)
        // This could be extended to handle additional user inputs during research
        console.log("Regular message submitted:", message.text);
      } catch (err) {
        console.error("Failed to submit message:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, hasActiveInterrupt]
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
   * Get empty state description based on current state
   */
  const getEmptyStateDescription = () => {
    if (currentInterrupt) {
      return "Please respond to the question above to continue planning your research.";
    }
    if (sseStream.status === "connecting") {
      return "Your research session is starting...";
    }
    return "Waiting for research to begin...";
  };

  /**
   * Get empty state title based on current state
   */
  const getEmptyStateTitle = () => {
    if (currentInterrupt) {
      return "Planning Your Research";
    }
    if (sseStream.queries.length > 0) {
      return `Analyzing ${sseStream.queries.length} ${sseStream.queries.length === 1 ? "query" : "queries"}...`;
    }
    return "Research Starting";
  };

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
        <div className="flex h-full min-h-0 flex-1 flex-col">
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
          <Conversation className="min-h-0 flex-1">
            <ConversationContent>
              {messagesWithDraft.length === 0 && !hasActiveInterrupt ? (
                <ConversationEmptyState
                  description={getEmptyStateDescription()}
                  icon={
                    sseStream.status === "connecting" ? (
                      <Loader2Icon className="size-8 animate-spin" />
                    ) : undefined
                  }
                  title={getEmptyStateTitle()}
                />
              ) : (
                <>
                  {messagesWithDraft.map((message) => (
                    <Message from={message.role} key={message.id}>
                      <MessageAvatar
                        name={message.role === "user" ? "You" : "AI"}
                        src={message.role === "user" ? "/user.png" : "/ai.png"}
                      />
                      <MessageContent variant="flat">
                        {message.content}
                      </MessageContent>
                    </Message>
                  ))}

                  {/* Render interrupt as part of the conversation */}
                  {hasActiveInterrupt && currentInterrupt && (
                    <Message
                      from="assistant"
                      key={`interrupt-${currentInterrupt.questionId}`}
                    >
                      <MessageAvatar name="AI" src="/ai.png" />
                      <MessageContent variant="flat">
                        <InterruptPrompt
                          className="mt-2"
                          interrupt={currentInterrupt}
                          isSubmitting={isSubmitting}
                          onSubmit={handleInterruptSubmit}
                        />
                      </MessageContent>
                    </Message>
                  )}
                </>
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
          <div className="flex-shrink-0">
            <RunLog entries={sseStream.runLog} />
          </div>

          {/* Prompt Input - Hide when there's an active interrupt */}
          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl space-y-2">
              {hasActiveInterrupt && (
                <Alert variant="default">
                  <AlertDescription>
                    Respond to the question above to continue the research flow.
                  </AlertDescription>
                </Alert>
              )}
              <PromptInput onSubmit={handlePromptSubmit}>
                <PromptInputBody>
                  <PromptInputTextarea
                    disabled={isSubmitting || hasActiveInterrupt}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="What would you like to know?"
                    value={inputValue}
                  />
                </PromptInputBody>
                <PromptInputToolbar>
                  <PromptInputSubmit
                    disabled={
                      isSubmitting || hasActiveInterrupt || !inputValue.trim()
                    }
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
