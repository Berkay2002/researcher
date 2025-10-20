/** biome-ignore-all lint/style/useBlockStatements: Early returns improve readability */
/** biome-ignore-all lint/style/noMagicNumbers: Time constants are self-explanatory */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Time sectioning requires branching */
/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Div acts as button */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: Mouse events sufficient for modal */

"use client";

import type { Thread } from "@langchain/langgraph-sdk";
import { Archive, MessageCircleIcon, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* -------------------------------- Types ---------------------------------- */

export type HistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: Thread[];
  onSelectThread?: (threadId: string) => void;
  onDeleteThreads?: (threadIds: string[]) => void;
  onArchiveThreads?: (threadIds: string[]) => void;
  getThreadTitle?: (thread: Thread) => string;
  className?: string;
};

/* ---------------------------- Helpers ------------------------------------ */

function getDefaultThreadTitle(thread: Thread): string {
  if (
    typeof thread.values === "object" &&
    thread.values &&
    "messages" in thread.values &&
    Array.isArray(thread.values.messages) &&
    thread.values.messages?.length > 0
  ) {
    const firstMessage = thread.values.messages[0];
    if (typeof firstMessage.content === "string") {
      return firstMessage.content.slice(0, 100);
    }
  }
  return thread.thread_id;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString();
}

/* ------------------------------ Component -------------------------------- */

export function HistoryModal({
  open,
  onOpenChange,
  threads,
  onSelectThread,
  onDeleteThreads,
  onArchiveThreads,
  getThreadTitle = getDefaultThreadTitle,
  className,
}: HistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(
    new Set()
  );

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSearchQuery("");
        setSelectionMode(false);
        setSelectedThreadIds(new Set());
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Sort threads by updated_at (most recent first)
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      }),
    [threads]
  );

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return sortedThreads;

    const query = searchQuery.toLowerCase();
    return sortedThreads.filter((thread) => {
      const title = getThreadTitle(thread).toLowerCase();
      return (
        title.includes(query) || thread.thread_id.toLowerCase().includes(query)
      );
    });
  }, [sortedThreads, searchQuery, getThreadTitle]);

  // Section threads by time
  const sectionedThreads = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const today: Thread[] = [];
    const yesterday: Thread[] = [];
    const thisWeek: Thread[] = [];
    const earlier: Thread[] = [];

    for (const thread of filteredThreads) {
      const updatedAt = thread.updated_at
        ? new Date(thread.updated_at)
        : new Date();

      if (updatedAt >= startOfToday) {
        today.push(thread);
      } else if (updatedAt >= startOfYesterday) {
        yesterday.push(thread);
      } else if (updatedAt >= startOfWeek) {
        thisWeek.push(thread);
      } else {
        earlier.push(thread);
      }
    }

    const sections: { label: string; threads: Thread[] }[] = [];

    if (today.length > 0) sections.push({ label: "Today", threads: today });
    if (yesterday.length > 0)
      sections.push({ label: "Yesterday", threads: yesterday });
    if (thisWeek.length > 0)
      sections.push({ label: "This week", threads: thisWeek });
    if (earlier.length > 0)
      sections.push({ label: "Earlier", threads: earlier });

    return sections;
  }, [filteredThreads]);

  // Selection handlers
  const toggleThreadSelection = useCallback((threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedThreadIds(new Set(filteredThreads.map((t) => t.thread_id)));
  }, [filteredThreads]);

  const clearSelection = useCallback(() => {
    setSelectedThreadIds(new Set());
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedThreadIds.size === 0) return;
    onDeleteThreads?.(Array.from(selectedThreadIds));
    setSelectedThreadIds(new Set());
    setSelectionMode(false);
  }, [selectedThreadIds, onDeleteThreads]);

  const handleArchive = useCallback(() => {
    if (selectedThreadIds.size === 0) return;
    onArchiveThreads?.(Array.from(selectedThreadIds));
    setSelectedThreadIds(new Set());
    setSelectionMode(false);
  }, [selectedThreadIds, onArchiveThreads]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className={cn(
          "flex h-[80vh] max-h-[800px] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl",
          className
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle>Your chat history</DialogTitle>
              <DialogDescription>
                {threads.length} chat{threads.length !== 1 ? "s" : ""} total
              </DialogDescription>
            </div>
            <Button
              className="shrink-0"
              onClick={() => setSelectionMode(!selectionMode)}
              size="sm"
              variant={selectionMode ? "secondary" : "outline"}
            >
              {selectionMode ? "Cancel" : "Select"}
            </Button>
          </div>
        </DialogHeader>

        {/* Search bar */}
        <div className="shrink-0 px-6 pt-4 pb-3">
          <div className="relative">
            <Input
              className="pl-9"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your chats..."
              value={searchQuery}
            />
            <MessageCircleIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          </div>
        </div>

        {/* Selection toolbar */}
        {selectionMode && (
          <>
            <div className="shrink-0 px-6 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-muted-foreground text-sm">
                    {selectedThreadIds.size} selected
                  </span>
                  <Button
                    className="h-7 text-xs"
                    onClick={selectAll}
                    size="sm"
                    variant="ghost"
                  >
                    Select all
                  </Button>
                  {selectedThreadIds.size > 0 && (
                    <Button
                      className="h-7 text-xs"
                      onClick={clearSelection}
                      size="sm"
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onArchiveThreads && (
                    <Button
                      className="h-8"
                      disabled={selectedThreadIds.size === 0}
                      onClick={handleArchive}
                      size="sm"
                      variant="ghost"
                    >
                      <Archive className="mr-2 size-4" />
                      Archive
                    </Button>
                  )}
                  {onDeleteThreads && (
                    <Button
                      className="h-8 text-destructive hover:text-destructive"
                      disabled={selectedThreadIds.size === 0}
                      onClick={handleDelete}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <Separator className="shrink-0" />
          </>
        )}

        {/* Thread list */}
        <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden">
          <div className="min-w-0 space-y-6 px-6 pb-6">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircleIcon className="mb-4 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No chats found" : "No chat history yet"}
                </p>
                {searchQuery && (
                  <p className="mt-2 text-muted-foreground text-sm">
                    Try adjusting your search
                  </p>
                )}
              </div>
            ) : (
              sectionedThreads.map((section) => (
                <div key={section.label}>
                  <h3 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {section.label}
                  </h3>
                  <div className="min-w-0 space-y-1">
                    {section.threads.map((thread) => {
                      const isSelected = selectedThreadIds.has(
                        thread.thread_id
                      );
                      const title = getThreadTitle(thread);
                      const updatedAt = thread.updated_at
                        ? new Date(thread.updated_at)
                        : new Date();

                      return (
                        <button
                          className={cn(
                            "group relative flex w-full min-w-0 max-w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                            selectionMode
                              ? "cursor-pointer hover:bg-muted/50"
                              : "cursor-pointer hover:border-border/60 hover:bg-card/60",
                            isSelected && "border-ring bg-accent/50"
                          )}
                          key={thread.thread_id}
                          onClick={() => {
                            if (selectionMode) {
                              toggleThreadSelection(thread.thread_id);
                            } else {
                              onSelectThread?.(thread.thread_id);
                              handleOpenChange(false);
                            }
                          }}
                          type="button"
                        >
                          {selectionMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleThreadSelection(thread.thread_id)
                              }
                            />
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                              <MessageCircleIcon className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground text-sm">
                                {title}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Last message {formatRelativeTime(updatedAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
