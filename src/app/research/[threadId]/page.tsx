/** biome-ignore-all lint/suspicious/noConsole: <Development> */
/** biome-ignore-all lint/complexity/useSimplifiedLogicExpression: <Need Complexity> */
"use client";

import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import {
  InterruptPrompt,
  type InterruptResponse,
} from "@/app/(components)/InterruptPrompt";
import { ResearchMessage } from "@/app/(components)/research-message";
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
import {
  draftToMessage,
  type MessageData,
  type SourceCardData,
  type ThreadMetadata,
  unifiedDocToSourceCard,
} from "@/types/ui";

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
  const searchParams = useSearchParams();
  const threadId = params?.threadId as string | undefined;
  const urlGoal = searchParams?.get("goal");

  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [pinnedSources, setPinnedSources] = useState<Set<string>>(new Set());
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [currentInterrupt, setCurrentInterrupt] =
    useState<InterruptPayload | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasActiveInterrupt, setHasActiveInterrupt] = useState(false);
  const [hasPlannerCompleted, setHasPlannerCompleted] = useState(false);
  const [scrollToSourceIndex, setScrollToSourceIndex] = useState<
    number | undefined
  >(undefined);

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

  // Build initial message from goal (prefer URL goal for immediate display)
  const initialMessage: MessageData | null = (() => {
    // First try to get goal from URL params for immediate display
    if (urlGoal) {
      return {
        id: "initial-goal-url",
        role: "user",
        content: urlGoal,
        timestamp: new Date().toISOString(),
      };
    }

    // Fall back to goal from snapshot once loaded
    if (snapshot?.values?.userInputs?.goal) {
      return {
        id: "initial-goal-snapshot",
        role: "user",
        content: snapshot.values.userInputs.goal,
        timestamp: snapshot.metadata?.createdAt || new Date().toISOString(),
      };
    }

    return null;
  })();

  // Combine all messages: initial + SSE (interrupts are handled separately)
  // Use a Set to track message IDs and avoid duplicates
  const messageIds = new Set<string>();
  const allMessages: MessageData[] = [];

  // Add initial message if available
  if (initialMessage) {
    allMessages.push(initialMessage);
    messageIds.add(initialMessage.id);
  }

  // Add SSE messages, avoiding duplicates with initial message
  for (const message of sseStream.messages) {
    if (!messageIds.has(message.id)) {
      allMessages.push(message);
      messageIds.add(message.id);
    }
  }

  // Fallback to persisted draft when no assistant messages streamed
  if (
    threadId &&
    snapshot?.values?.draft &&
    !allMessages.some((message) => message.role === "assistant")
  ) {
    const fallbackMessage = draftToMessage(snapshot.values.draft, threadId);
    if (!messageIds.has(fallbackMessage.id)) {
      allMessages.push(fallbackMessage);
      messageIds.add(fallbackMessage.id);
    }
  }

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

  const latestAssistantMessage = useMemo(() => {
    for (let index = messagesWithDraft.length - 1; index >= 0; index -= 1) {
      const message = messagesWithDraft[index];
      if (message.role === "assistant") {
        return message;
      }
    }
    return null;
  }, [messagesWithDraft]);

  const researchSources = useMemo(() => {
    const research = snapshot?.values.research;
    if (!research) {
      return [] as SourceCardData[];
    }

    const combined: SourceCardData[] = [];

    const pushDocs = (
      docs: typeof research.discovery,
      stage: "discovery" | "enriched" | "final"
    ) => {
      if (!docs) {
        return;
      }
      for (const doc of docs) {
        combined.push(unifiedDocToSourceCard(doc, { stage }));
      }
    };

    pushDocs(research.discovery, "discovery");
    pushDocs(research.enriched, "enriched");
    pushDocs(research.final, "final");

    const deduped = new Map<string, SourceCardData>();
    for (const card of combined) {
      const existing = deduped.get(card.url);
      if (!existing || card.excerpt.length > existing.excerpt.length) {
        deduped.set(card.url, card);
      }
    }

    return Array.from(deduped.values());
  }, [snapshot?.values.research]);

  const combinedSources = useMemo(() => {
    const deduped = new Map<string, SourceCardData>();

    for (const card of researchSources) {
      deduped.set(card.url, card);
    }

    for (const card of sseStream.sources) {
      const existing = deduped.get(card.url);
      if (!existing || card.excerpt.length > existing.excerpt.length) {
        deduped.set(card.url, card);
      }
    }

    return Array.from(deduped.values());
  }, [researchSources, sseStream.sources]);

  // Enhance sources with pinned state
  const sourcesWithPinned: SourceCardData[] = useMemo(
    () =>
      combinedSources.map((source) => ({
        ...source,
        isPinned: pinnedSources.has(source.url),
      })),
    [combinedSources, pinnedSources]
  );

  /**
   * Detect interrupts from thread state and planner completion
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

    // Check if planner has completed (has plan but no interrupt)
    if (snapshot?.values?.plan && !snapshot?.interrupt) {
      setHasPlannerCompleted(true);
    }

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log("[ThreadView] Snapshot updated", {
        hasInterrupt: Boolean(snapshot?.interrupt),
        hasDraft: Boolean(snapshot?.values?.draft),
        hasPlan: Boolean(snapshot?.values?.plan),
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

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setIsLeftPanelVisible(open);
  }, []);

  const handleRightSidebarOpenChange = useCallback((open: boolean) => {
    setIsRightPanelVisible(open);
  }, []);

  const handleToggleSourcesPanel = useCallback(() => {
    handleRightSidebarOpenChange(!isRightPanelVisible);
  }, [handleRightSidebarOpenChange, isRightPanelVisible]);

  const handleCitationClick = useCallback(
    (sourceIndex: number) => {
      const SCROLL_RESET_DELAY_MS = 100;
      // Open sources panel if closed
      if (!isRightPanelVisible) {
        setIsRightPanelVisible(true);
      }
      // Trigger scroll to source
      setScrollToSourceIndex(sourceIndex);
      // Reset after a delay to allow re-clicking the same citation
      setTimeout(() => {
        setScrollToSourceIndex(undefined);
      }, SCROLL_RESET_DELAY_MS);
    },
    [isRightPanelVisible]
  );

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
                    <ResearchMessage
                      isSourcesPanelVisible={isRightPanelVisible}
                      key={message.id}
                      message={message}
                      onCitationClick={
                        message.role === "assistant"
                          ? handleCitationClick
                          : undefined
                      }
                      onToggleSourcesPanel={
                        message.role === "assistant"
                          ? handleToggleSourcesPanel
                          : undefined
                      }
                      sources={
                        message.role === "assistant"
                          ? sourcesWithPinned
                          : undefined
                      }
                    />
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
            <RunLog entries={sseStream.runLog} isDev={isDev} />
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
          isSidebarOpen={isLeftPanelVisible}
          onDeleteThread={handleDeleteThread}
          onSidebarOpenChange={handleSidebarOpenChange}
          threads={threads}
        />
      }
      leftPanelCollapsed={!isLeftPanelVisible}
      rightPanel={
        combinedSources.length > 0 ? (
          <SourcesPanel
            citations={latestAssistantMessage?.citations}
            isSidebarOpen={isRightPanelVisible}
            onSidebarOpenChange={handleRightSidebarOpenChange}
            onTogglePin={handleTogglePin}
            scrollToSourceIndex={scrollToSourceIndex}
            sources={sourcesWithPinned}
          />
        ) : undefined
      }
      rightPanelCollapsed={!isRightPanelVisible}
      rightPanelVisible={combinedSources.length > 0 || hasPlannerCompleted}
    />
  );
}
