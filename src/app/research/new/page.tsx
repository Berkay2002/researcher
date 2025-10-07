/** biome-ignore-all lint/suspicious/noConsole: <Development> */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import { ResearchInput } from "@/app/(components)/research-input";
import { ThreadList } from "@/app/(components)/thread-list";
import type { ThreadMetadata } from "@/types/ui";

// HTTP Status Codes
const HTTP_STATUS_ACCEPTED = 202;
const RANDOM_ID_RADIX = 16;
const RANDOM_ID_SLICE_INDEX = 2;

/**
 * New Research Page
 *
 * Entry point for starting new research sessions.
 * ChatGPT-style layout with input at bottom.
 *
 * Layout:
 * - Left: Thread history
 * - Center: Empty space for future messages, input at bottom
 * - Right: Hidden (no sources until research starts)
 */
export default function NewResearchPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  /**
   * Persist thread list to localStorage to keep the sidebar in sync
   */
  type ThreadsUpdater = (threadList: ThreadMetadata[]) => ThreadMetadata[];

  const persistThreads = useCallback(
    (updater: ThreadsUpdater | ThreadMetadata[]) => {
      setThreads((currentThreadList) => {
        const nextState: ThreadMetadata[] =
          typeof updater === "function" ? updater(currentThreadList) : updater;

        try {
          localStorage.setItem("research-threads", JSON.stringify(nextState));
        } catch {
          // Ignore storage write failures (e.g., private browsing)
        }

        return nextState;
      });
    },
    []
  );

  /**
   * Load threads from localStorage
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

  /**
   * Handle thread deletion
   */
  const handleDeleteThread = useCallback(
    (threadId: string) => {
      persistThreads((existingThreads) =>
        existingThreads.filter((thread) => thread.threadId !== threadId)
      );
    },
    [persistThreads]
  );

  /**
   * Handle research submission
   */

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <>
  const handleSubmit = async (goal: string, mode: "auto" | "plan") => {
    if (!isMountedRef.current) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const threadId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(RANDOM_ID_RADIX)
            .slice(RANDOM_ID_SLICE_INDEX)}`;

    const timestamp = new Date().toISOString();

    const optimisticThread: ThreadMetadata = {
      threadId,
      title: goal,
      goal,
      status: "running",
      createdAt: timestamp,
      updatedAt: timestamp,
      messageCount: 0,
      mode,
    };

    // Optimistically add the thread and navigate immediately so the user sees progress right away
    persistThreads((existingThreads) => [
      optimisticThread,
      ...existingThreads.filter((thread) => thread.threadId !== threadId),
    ]);

    router.push(`/research/${threadId}`);

    try {
      const response = await fetch("/api/threads/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal,
          modeOverride: mode,
          threadId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start research: ${errorText}`);
      }

      const data = (await response.json()) as {
        threadId: string;
        interrupt?: unknown;
      };

      // Handle both immediate start (201) and interrupt (202)
      if (response.status === HTTP_STATUS_ACCEPTED && data.interrupt) {
        console.log(
          "[NewResearch] Thread interrupted, redirecting to handle HITL"
        );
      }
    } catch (err) {
      try {
        const storedThreads = localStorage.getItem("research-threads");
        if (storedThreads) {
          const parsed = JSON.parse(storedThreads) as ThreadMetadata[];
          const filtered = parsed.filter(
            (thread) => thread.threadId !== threadId
          );
          localStorage.setItem("research-threads", JSON.stringify(filtered));
        }
      } catch {
        // Ignore storage cleanup failures
      }

      if (isMountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setThreads((existingThreads) =>
          existingThreads.filter((thread) => thread.threadId !== threadId)
        );
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <AppShell
      centerPanel={
        <div className="flex h-full flex-col overflow-hidden">
          {/* Empty space - messages will appear here */}
          <div className="flex-1 overflow-y-auto" />

          {/* Error Display */}
          {error && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-4">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Research Input at bottom - fixed position */}
          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl">
              <ResearchInput
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      }
      leftPanel={
        <ThreadList
          activeThreadId={null}
          onDeleteThread={handleDeleteThread}
          threads={threads}
        />
      }
      // No right panel - sources appear only after research starts
    />
  );
}
