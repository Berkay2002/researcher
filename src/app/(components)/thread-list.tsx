/** biome-ignore-all lint/suspicious/noConsole: <Development> */
"use client";

import {
  ChevronRight,
  FolderPlus,
  MoreVertical,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";
import { PanelContent, PanelFooter, PanelHeader } from "./app-shell";
import ProjectModal, { type Project } from "./project-modal";
import { KbdInputGroup } from "./search-kbd";
import { SearchModal } from "./search-modal";
import { ThreadCard } from "./thread-card";

export type ThreadListProps = {
  threads: ThreadMetadata[];
  activeThreadId?: string | null;
  onDeleteThread?: (threadId: string) => void;
  className?: string;
  onSidebarOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
};

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
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("favoriteThreadIds");
    if (raw) {
      try {
        setFavorites(new Set(JSON.parse(raw) as string[]));
      } catch (error) {
        console.error("Failed to parse favoriteThreadIds", error);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("projects") ?? "[]");
      if (Array.isArray(stored)) {
        const hydrated = stored.filter(
          (project): project is Project =>
            typeof project?.id === "string" && typeof project?.name === "string"
        );
        setProjects(hydrated);
        if (hydrated.length > 0) {
          setIsProjectsExpanded(true);
        }
      }
    } catch (error) {
      console.error("Failed to parse projects", error);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    onSidebarOpenChange?.(!isSidebarOpen);
  }, [isSidebarOpen, onSidebarOpenChange]);

  const handleFocusSearch = useCallback(() => {
    if (!isSidebarOpen) {
      onSidebarOpenChange?.(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
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

  const handleCreateProject = useCallback((project: Project) => {
    setProjects((prev) => {
      const next = [...prev, project];
      try {
        localStorage.setItem("projects", JSON.stringify(next));
      } catch (error) {
        console.error("Failed to persist project", error);
      }
      setIsProjectsExpanded(true);
      return next;
    });
  }, []);

  const handleDeleteProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((project) => project.id !== projectId);
      try {
        localStorage.setItem("projects", JSON.stringify(next));
      } catch (error) {
        console.error("Failed to persist project", error);
      }
      return next;
    });
  }, []);

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

  const sortedThreads = useMemo(
    () =>
      [...filteredThreads].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [filteredThreads]
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("favoriteThreadIds", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const favoriteThreads = useMemo(
    () => sortedThreads.filter((thread) => favorites.has(thread.threadId)),
    [sortedThreads, favorites]
  );

  const otherThreads = useMemo(
    () => sortedThreads.filter((thread) => !favorites.has(thread.threadId)),
    [sortedThreads, favorites]
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
        {/* Collapsed Header */}
        <div className="flex h-15 items-center justify-end px-4">
          <Button
            aria-label="Open thread sidebar"
            className="rounded-lg hover:bg-accent/60"
            onClick={() => onSidebarOpenChange?.(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftOpenIcon className="size-5" />
          </Button>
        </div>

        <div className="h-2" />

        {/* Collapsed Search */}
        <div className="flex h-12 items-center justify-start px-4">
          <Button
            aria-label="Search threads"
            className="rounded-lg hover:bg-accent/60"
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

        {/* Collapsed New Chat */}
        <div className="flex h-12 items-center justify-start px-4">
          <Button
            aria-label="New chat"
            asChild
            className="rounded-lg hover:bg-accent/60"
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
              className="size-7 rounded-lg hover:bg-accent/60"
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
          className="rounded-xl"
          inputClassName="bg-transparent"
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
          <Button
            asChild
            className="h-9 w-full justify-start rounded-md bg-transparent px-3 transition hover:bg-muted/40"
            onClick={handleStartNewChat}
            type="button"
            variant="ghost"
          >
            <Link href="/research/new">
              <PlusIcon className="size-4" />
              New Chat
            </Link>
          </Button>
        </div>
        <div className="mt-2">
          {projects.length === 0 ? (
            <Button
              className="h-9 w-full justify-start rounded-md bg-transparent px-3 transition hover:bg-muted/40"
              onClick={() => setIsProjectModalOpen(true)}
              type="button"
              variant="ghost"
            >
              <FolderPlus className="size-4" />
              Projects
            </Button>
          ) : (
            <Collapsible
              className="group/collapsible"
              onOpenChange={setIsProjectsExpanded}
              open={isProjectsExpanded}
            >
              <CollapsibleTrigger asChild>
                <Button
                  className="h-9 w-full justify-start rounded-md bg-transparent px-3 transition hover:bg-muted/40"
                  type="button"
                  variant="ghost"
                >
                  <FolderPlus className="size-4" />
                  Projects
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-2 data-[state=open]:mt-2 data-[state=closed]:hidden">
                <Button
                  className="h-8 w-full justify-start rounded-md bg-transparent px-3 text-sm transition hover:bg-muted/40"
                  onClick={() => setIsProjectModalOpen(true)}
                  type="button"
                  variant="ghost"
                >
                  <FolderPlus className="size-4" />
                  New Project
                </Button>
                {projects.map((project) => (
                  <div
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-muted/40"
                    key={project.id}
                  >
                    <button
                      className="flex flex-1 items-center gap-2 text-left"
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="flex size-6 items-center justify-center rounded-md bg-muted text-base"
                      >
                        {project.emoji ?? "📁"}
                      </span>
                      <span className="truncate">{project.name}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Project actions for ${project.name}`}
                          className="size-7"
                          type="button"
                          variant="ghost"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handleDeleteProject(project.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Thread List */}
      <PanelContent className="space-y-2 p-2">
        {sortedThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No threads match your search" : "No threads yet"}
            </p>
            {!searchQuery && (
              <Button
                asChild
                className="mt-4 rounded-md"
                size="sm"
                type="button"
              >
                <Link href="/research/new">Start Research</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            {favoriteThreads.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 pt-2 text-muted-foreground text-xs uppercase tracking-wide">
                  Favorites
                </div>
                {favoriteThreads.map((thread) => (
                  <ThreadCard
                    isActive={thread.threadId === activeThreadId}
                    isFavorite
                    key={thread.threadId}
                    onDelete={onDeleteThread}
                    onToggleFavorite={toggleFavorite}
                    thread={thread}
                  />
                ))}
                <div className="h-2" />
              </div>
            )}

            <div className="space-y-1">
              {favoriteThreads.length > 0 && (
                <div className="px-2 pt-2 text-muted-foreground text-xs uppercase tracking-wide">
                  All threads
                </div>
              )}
              {otherThreads.map((thread) => (
                <ThreadCard
                  isActive={thread.threadId === activeThreadId}
                  isFavorite={favorites.has(thread.threadId)}
                  key={thread.threadId}
                  onDelete={onDeleteThread}
                  onToggleFavorite={toggleFavorite}
                  thread={thread}
                />
              ))}
            </div>
          </>
        )}
      </PanelContent>

      {/* Footer */}
      <PanelFooter className="border-t text-center">
        <p className="text-muted-foreground text-xs">
          {sortedThreads.length} thread{sortedThreads.length !== 1 ? "s" : ""}
        </p>
      </PanelFooter>
      <ProjectModal
        onCreate={handleCreateProject}
        onOpenChange={setIsProjectModalOpen}
        open={isProjectModalOpen}
      />
      {searchModal}
    </div>
  );
}
