"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import { ThreadList } from "@/app/(components)/thread-list";
import { AgentInput } from "@/app/agent/(components)/agent-input";
import type { ThreadMetadata } from "@/types/ui";

const STORAGE_KEY = "agent-threads";
const HTTP_STATUS_CREATED = 201;
const RANDOM_ID_RADIX = 16;
const RANDOM_ID_SLICE_INDEX = 2;

export default function NewAgentPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    const storedThreads = localStorage.getItem(STORAGE_KEY);
    if (!storedThreads) {
      return;
    }
    try {
      const parsed = JSON.parse(storedThreads) as ThreadMetadata[];
      setThreads(parsed);
    } catch {
      // Ignore parse errors
    }
  }, []);

  const persistThreads = useCallback(
    (
      updater:
        | ThreadMetadata[]
        | ((current: ThreadMetadata[]) => ThreadMetadata[])
    ) => {
      setThreads((existingThreads) => {
        const next =
          typeof updater === "function"
            ? (updater as (list: ThreadMetadata[]) => ThreadMetadata[])(
                existingThreads
              )
            : updater;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore localStorage errors
        }
        return next;
      });
    },
    []
  );

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      persistThreads((current) =>
        current.filter((thread) => thread.threadId !== threadId)
      );
    },
    [persistThreads]
  );

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setIsLeftPanelVisible(open);
  }, []);

  const handleSubmit = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <!-- IGNORE -->
    async (prompt: string) => {
      if (!isMountedRef.current) {
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const threadId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_SLICE_INDEX)}`;

      const now = new Date().toISOString();
      const optimisticThread: ThreadMetadata = {
        threadId,
        title: prompt,
        goal: prompt,
        status: "running",
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        mode: "auto",
      };

      persistThreads((current) => [
        optimisticThread,
        ...current.filter((thread) => thread.threadId !== threadId),
      ]);

      router.push(`/agent/${threadId}?prompt=${encodeURIComponent(prompt)}`);

      try {
        const response = await fetch("/api/agent/threads/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            threadId,
          }),
        });

        if (response.status !== HTTP_STATUS_CREATED) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to start agent thread");
        }
      } catch (err) {
        if (!isMountedRef.current) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Failed to start agent thread";
        setError(message);
        setThreads((current) =>
          current.filter((thread) => thread.threadId !== threadId)
        );
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as ThreadMetadata[];
            const filtered = parsed.filter(
              (thread) => thread.threadId !== threadId
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          }
        } catch {
          // Ignore cleanup errors
        }
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [persistThreads, router]
  );

  return (
    <AppShell
      centerPanel={
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-y-hidden" />
          {error && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-4">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            </div>
          )}
          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl">
              <AgentInput isSubmitting={isSubmitting} onSubmit={handleSubmit} />
            </div>
          </div>
        </div>
      }
      leftPanel={
        <ThreadList
          activeThreadId={null}
          basePath="/agent"
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
