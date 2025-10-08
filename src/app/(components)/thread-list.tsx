"use client";

import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";
import { PanelContent, PanelFooter, PanelHeader } from "./app-shell";
import { ThreadCard } from "./thread-card";
import { KbdInputGroup } from "./search-kbd";
import { SearchModal } from "./search-modal";

/**
 * Thread List Props
 */
export type ThreadListProps = {
  threads: ThreadMetadata[];
  activeThreadId?: string | null;
  onDeleteThread?: (threadId: string) => void;
  className?: string;
  onSidebarOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
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
  onSidebarOpenChange,
  isSidebarOpen = true,
  className,
}: ThreadListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleSidebar = useCallback(() => {
    onSidebarOpenChange?.(!isSidebarOpen);
  }, [isSidebarOpen, onSidebarOpenChange]);

  const handleFocusSearch = useCallback(() => {
    if (!isSidebarOpen) {
      onSidebarOpenChange?.(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return;
    }
    searchInputRef.current?.focus();
  }, [isSidebarOpen, onSidebarOpenChange]);

  const handleStartNewChat = useCallback(() => {
    if (!isSidebarOpen) {
      onSidebarOpenChange?.(true);
    }
  }, [isSidebarOpen, onSidebarOpenChange]);

  const handleCreateThread = useCallback(() => {
    handleStartNewChat();
    router.push("/research/new");
  }, [handleStartNewChat, router]);

  const handleSelectThreadFromModal = useCallback(
    (thread: ThreadMetadata) => {
      if (!isSidebarOpen) {
        onSidebarOpenChange?.(true);
      }
      setSearchQuery("");
      setIsSearchModalOpen(false);
      router.push(`/research/${thread.threadId}`);
    },
    [isSidebarOpen, onSidebarOpenChange, router]
  );

  const handleOpenSearchModal = useCallback(() => {
    setIsSearchModalOpen(true);
  }, []);

  const handleSearchModalOpenChange = useCallback((open: boolean) => {
    setIsSearchModalOpen(open);
  }, []);

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

  const searchModal = (
    <SearchModal
      onCreateThread={handleCreateThread}
      onOpenChange={handleSearchModalOpenChange}
      onSelectThread={handleSelectThreadFromModal}
      open={isSearchModalOpen}
      threads={threads}
    />
  );

  if (!isSidebarOpen) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {/* Collapsed Header - matches expanded header height and icon position */}
        <div className="flex h-15 items-center justify-end px-4">
          <Button
            aria-label="Open thread sidebar"
            onClick={() => onSidebarOpenChange?.(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftOpenIcon className="size-5" />
          </Button>
        </div>

        {/* Spacing between collapse icon and search icon - matches expanded state */}
        <div className="h-2" />

        {/* Collapsed Search Area - matches expanded search area and icon position */}
        <div className="flex h-12 items-center justify-start px-4">
          <Button
            aria-label="Search threads"
            onClick={() => {
              handleFocusSearch();
              handleOpenSearchModal();
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <SearchIcon className="size-5" />
          </Button>
        </div>

        {/* Collapsed New Chat Area - matches expanded new chat area and icon position */}
        <div className="flex h-12 items-center justify-start px-4">
          <Button
            aria-label="New chat"
            asChild
            onClick={handleStartNewChat}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Link href="/research/new">
              <PlusIcon className="size-5" />
              <span className="sr-only">New chat</span>
            </Link>
          </Button>
        </div>
        {searchModal}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <PanelHeader
        actions={
          onSidebarOpenChange ? (
            <Button
              aria-label="Hide threads"
              className="size-7"
              onClick={handleToggleSidebar}
              size="icon"
              type="button"
              variant="ghost"
            >
              <PanelLeftCloseIcon className="size-5" />
            </Button>
          ) : null
        }
        subtitle={`${threads.length} total`}
        title="Threads"
      />

      {/* Search */}
      <div className="border-b px-4 py-3">
        <KbdInputGroup
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key.toLowerCase() === "k"
            ) {
              event.preventDefault();
              handleOpenSearchModal();
            }
          }}
          placeholder="Search..."
          ref={searchInputRef}
          value={searchQuery}
        />
        <div className="mt-3">
          <Link href="/research/new">
            <Button
              className="h-9 w-full justify-start px-3"
              onClick={handleStartNewChat}
              type="button"
              variant="secondary"
            >
              <PlusIcon className="size-4" />
              New Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* Thread List */}
      <PanelContent className="space-y-1">
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
      {searchModal}
    </div>
  );
}
