"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";
import { PanelContent, PanelFooter, PanelHeader } from "./app-shell";
import { ThreadCard } from "./thread-card";

/**
 * Thread List Props
 */
export type ThreadListProps = {
  threads: ThreadMetadata[];
  activeThreadId?: string | null;
  onDeleteThread?: (threadId: string) => void;
  className?: string;
};

/**
 * Thread List Component
 *
 * Displays list of research threads with search and filtering.
 * Shows in left panel of app shell.
 */
export function ThreadList({
  threads,
  activeThreadId,
  onDeleteThread,
  className,
}: ThreadListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Filter threads by search query
   */
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }

    const query = searchQuery.toLowerCase();

    return threads.filter(
      (thread) =>
        thread.title.toLowerCase().includes(query) ||
        thread.goal.toLowerCase().includes(query) ||
        thread.preview?.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  /**
   * Sort threads by most recent first
   */
  const sortedThreads = useMemo(
    () =>
      [...filteredThreads].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [filteredThreads]
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <PanelHeader
        actions={
          <Link href="/research/new">
            <Button
              aria-label="New research"
              size="icon"
              type="button"
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </Button>
          </Link>
        }
        subtitle={`${threads.length} total`}
        title="Threads"
      />

      {/* Search */}
      <div className="border-b px-4 py-3">
        <div className="relative">
          <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threads..."
            type="search"
            value={searchQuery}
          />
        </div>
      </div>

      {/* Thread List */}
      <PanelContent className="space-y-2">
        {sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No threads match your search" : "No threads yet"}
            </p>
            {!searchQuery && (
              <Link href="/research/new">
                <Button className="mt-4" size="sm" type="button">
                  Start Research
                </Button>
              </Link>
            )}
          </div>
        ) : (
          sortedThreads.map((thread) => (
            <ThreadCard
              isActive={thread.threadId === activeThreadId}
              key={thread.threadId}
              onDelete={onDeleteThread}
              thread={thread}
            />
          ))
        )}
      </PanelContent>

      {/* Footer (optional) */}
      <PanelFooter className="text-center">
        <p className="text-muted-foreground text-xs">
          {sortedThreads.length} thread{sortedThreads.length !== 1 ? "s" : ""}
        </p>
      </PanelFooter>
    </div>
  );
}
