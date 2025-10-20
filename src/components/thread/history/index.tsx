/** biome-ignore-all lint/suspicious/noConsole: <Ignore> */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: <Ignore> */
/** biome-ignore-all lint/style/useBlockStatements: <Ignore> */

import type { Thread } from "@langchain/langgraph-sdk";
// biome-ignore lint/performance/noNamespaceImport: <It is fine>
import * as Icons from "lucide-react";
import {
  ChevronRight,
  FolderPlus,
  MoreVertical,
  MoreVerticalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  Star as StarIcon,
} from "lucide-react";
import Link from "next/link";
import { parseAsBoolean, useQueryState } from "nuqs";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanelContent,
  PanelFooter,
  PanelHeader,
} from "../app-shell";
import ProjectModal, { type Project } from "./project-modal";
import { KbdInputGroup } from "./search-kbd";
import { SearchModal } from "./search-modal";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useThreads } from "@/providers/Thread";
import { getContentString } from "../utils";

type ColorKey =
  | "gray"
  | "emerald"
  | "blue"
  | "violet"
  | "red"
  | "orange"
  | "indigo";

const ICON_COLOR: Record<ColorKey, string> = {
  gray: "text-gray-500",
  emerald: "text-emerald-500",
  blue: "text-blue-500",
  violet: "text-violet-500",
  red: "text-red-500",
  orange: "text-orange-500",
  indigo: "text-indigo-500",
};

function getIconByName(name?: string) {
  const fallback = Icons.Folder;
  // biome-ignore lint/suspicious/noExplicitAny: <It is fine>
  return (Icons as any)[name ?? "Folder"] ?? fallback;
}

/**
 * Convert Thread to a format compatible with SearchModal
 */
function threadToMetadata(thread: Thread) {
  let title = thread.thread_id;
  let goal = "";

  if (
    typeof thread.values === "object" &&
    thread.values &&
    "messages" in thread.values &&
    Array.isArray(thread.values.messages) &&
    thread.values.messages?.length > 0
  ) {
    const firstMessage = thread.values.messages[0];
    title = getContentString(firstMessage.content);
    goal = title;
  }

  return {
    threadId: thread.thread_id,
    title,
    goal,
    status: "completed" as const,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    messageCount: 0,
    mode: "auto" as const,
  };
}

/**
 * Enhanced Thread Card Component
 * Integrates improved styling from (components)/thread-card.tsx with SDK patterns
 */
function ThreadCard({
  thread,
  onDelete,
  isActive = false,
  isFavorite = false,
  onToggleFavorite,
  onThreadClick,
}: {
  thread: Thread;
  onDelete?: (threadId: string) => void;
  isActive?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (threadId: string) => void;
  onThreadClick?: (threadId: string) => void;
}) {
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);

  const updateTruncation = useCallback(() => {
    const element = titleRef.current;
    if (!element) {
      return setIsTitleTruncated(false);
    }
    setIsTitleTruncated(element.scrollWidth > element.clientWidth + 1);
  }, []);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) {
      return setIsTitleTruncated(false);
    }

    updateTruncation();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => updateTruncation());
      ro.observe(element);
      return () => ro.disconnect();
    }

    const onResize = () => updateTruncation();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateTruncation]);

  const handleDelete = (event: Event | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete?.(thread.thread_id);
  };

  // Extract title from thread
  let itemText = thread.thread_id;
  if (
    typeof thread.values === "object" &&
    thread.values &&
    "messages" in thread.values &&
    Array.isArray(thread.values.messages) &&
    thread.values.messages?.length > 0
  ) {
    const firstMessage = thread.values.messages[0];
    itemText = getContentString(firstMessage.content);
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className="block"
      href={`/research/${thread.thread_id}`}
      onClick={(e) => {
        if (onThreadClick) {
          e.preventDefault();
          onThreadClick(thread.thread_id);
        }
      }}
    >
      <div
        className={cn(
          // Softer card surface + hover affordances
          "group flex items-center justify-between gap-2",
          "rounded-lg px-3 py-2",
          "transition-all duration-200",
          // Better focus ring
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          // Surface states
          isActive
            ? "border border-border bg-accent/60 hover:bg-accent/70"
            : "border border-transparent bg-card/40 hover:border-border/60 hover:bg-card/60"
        )}
      >
        <span
          className="truncate font-medium text-foreground text-sm"
          ref={titleRef}
          title={isTitleTruncated ? itemText : undefined}
        >
          {itemText}
        </span>
        {onToggleFavorite && (
          <button
            aria-label={isFavorite ? "Unfavorite" : "Favorite"}
            className={cn(
              "flex h-8 w-8 items-center justify-center",
              "rounded-lg border border-transparent text-muted-foreground transition-colors",
              "hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite?.(thread.thread_id);
            }}
            type="button"
          >
            <StarIcon
              className={cn(
                "size-4",
                isFavorite && "fill-yellow-400 text-yellow-400"
              )}
            />
          </button>
        )}
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Thread actions"
                className={cn(
                  "flex h-8 w-8 items-center justify-center",
                  "rounded-lg text-muted-foreground",
                  "border border-transparent transition-colors",
                  "hover:bg-muted/50 hover:text-foreground"
                )}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                type="button"
              >
                <MoreVerticalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={(event) => handleDelete(event)}>
                Delete thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Link>
  );
}

/**
 * Enhanced Thread List Component
 * Uses Thread[] from LangGraph SDK with improved UI from (components)
 */
function ThreadList({
  threads,
  onThreadClick,
  onDelete,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
  onDelete?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from localStorage
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

  // Sort threads: favorites first, then by updated time
  const sortedThreads = [...threads].sort((a, b) => {
    const aFav = favorites.has(a.thread_id);
    const bFav = favorites.has(b.thread_id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const favoriteThreads = sortedThreads.filter((t) =>
    favorites.has(t.thread_id)
  );
  const otherThreads = sortedThreads.filter((t) => !favorites.has(t.thread_id));

  return (
    <div className="space-y-2">
      {favoriteThreads.length > 0 && (
        <div className="space-y-1">
          <div className="px-2 pt-2 text-muted-foreground text-xs uppercase tracking-wide">
            Favorites
          </div>
          {favoriteThreads.map((t) => (
            <ThreadCard
              isActive={t.thread_id === threadId}
              isFavorite
              key={t.thread_id}
              onDelete={onDelete}
              onThreadClick={(id) => {
                onThreadClick?.(id);
                if (id === threadId) return;
                setThreadId(id);
              }}
              onToggleFavorite={toggleFavorite}
              thread={t}
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
        {otherThreads.map((t) => (
          <ThreadCard
            isActive={t.thread_id === threadId}
            isFavorite={favorites.has(t.thread_id)}
            key={t.thread_id}
            onDelete={onDelete}
            onThreadClick={(id) => {
              onThreadClick?.(id);
              if (id === threadId) return;
              setThreadId(id);
            }}
            onToggleFavorite={toggleFavorite}
            thread={t}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 15 }).map((_, i) => (
        <Skeleton className="h-12 w-full" key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(true)
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  // Thread ID state for navigation (setting to null starts a new chat)
  const [_threadId, setThreadId] = useQueryState("threadId");

  // Search and modal states
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  // Load projects from localStorage
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

  // Keyboard shortcut for search modal
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

  // Handle thread deletion
  const handleDeleteThread = useCallback(
    (threadId: string) => {
      try {
        // Call API to delete thread (you may need to implement this)
        // For now, just remove from local state
        setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
      } catch (err) {
        console.error("Error deleting thread:", err);
      }
    },
    [setThreads]
  );

  const handleFocusSearch = useCallback(() => {
    if (!chatHistoryOpen) {
      setChatHistoryOpen(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }
    searchInputRef.current?.focus();
  }, [chatHistoryOpen, setChatHistoryOpen]);

  const handleStartNewChat = useCallback(() => {
    if (!chatHistoryOpen) {
      setChatHistoryOpen(true);
    }
    // Clear thread ID to start a new chat while preserving apiUrl and assistantId
    setThreadId(null);
  }, [chatHistoryOpen, setChatHistoryOpen, setThreadId]);

  const handleCreateThread = useCallback(() => {
    handleStartNewChat();
  }, [handleStartNewChat]);

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
    (thread: { threadId: string }) => {
      if (!chatHistoryOpen) {
        setChatHistoryOpen(true);
      }
      setSearchQuery("");
      setIsSearchModalOpen(false);
      // Update threadId query parameter to switch to the selected thread
      setThreadId(thread.threadId);
    },
    [chatHistoryOpen, setChatHistoryOpen, setThreadId]
  );

  const handleOpenSearchModal = useCallback(() => {
    setIsSearchModalOpen(true);
  }, []);

  const handleSearchModalOpenChange = useCallback((open: boolean) => {
    setIsSearchModalOpen(open);
  }, []);

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return threads;
    }
    const query = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      let itemText = thread.thread_id;
      if (
        typeof thread.values === "object" &&
        thread.values &&
        "messages" in thread.values &&
        Array.isArray(thread.values.messages) &&
        thread.values.messages?.length > 0
      ) {
        const firstMessage = thread.values.messages[0];
        itemText = getContentString(firstMessage.content);
      }
      return itemText.toLowerCase().includes(query);
    });
  }, [threads, searchQuery]);

  // Convert threads for SearchModal
  const threadsForModal = useMemo(
    () => threads.map(threadToMetadata),
    [threads]
  );

  const searchModal = (
    <SearchModal
      onCreateThread={handleCreateThread}
      onOpenChange={handleSearchModalOpenChange}
      onSelectThread={handleSelectThreadFromModal}
      open={isSearchModalOpen}
      threads={threadsForModal}
    />
  );

  // Collapsed sidebar
  if (!chatHistoryOpen) {
    return (
      <>
        <div className="flex h-full flex-1 flex-col items-center gap-4">
          <Button
            aria-label="Show threads"
            className="size-9 rounded-lg hover:bg-accent/60"
            onClick={() => setChatHistoryOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftOpenIcon className="size-5" />
          </Button>

          {/* Collapsed Search */}
          <Button
            aria-label="Search threads"
            className="size-9 rounded-lg hover:bg-accent/60"
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

          {/* Collapsed New Chat */}
          <Button
            aria-label="New chat"
            className="size-9 rounded-lg hover:bg-accent/60"
            onClick={handleStartNewChat}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PlusIcon className="size-5" />
          </Button>

          <ThemeToggle className="mt-auto mb-4" collapsed />
        </div>
        {searchModal}
      </>
    );
  }

  return (
    <>
      <PanelHeader
        actions={
          <Button
            aria-label="Hide threads"
            className="size-7 rounded-lg hover:bg-accent/60"
            onClick={() => setChatHistoryOpen((p) => !p)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftCloseIcon className="size-5" />
          </Button>
        }
        subtitle={`${threads.length} total`}
        title="Threads"
      />

      {/* Search Section */}
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
            className="h-9 w-full justify-start rounded-md bg-transparent px-3 transition hover:bg-muted/40"
            onClick={handleStartNewChat}
            type="button"
            variant="ghost"
          >
            <PlusIcon className="size-4" />
            New Chat
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
                {projects.map((project) => {
                  const Icon = getIconByName(project.icon);
                  const colorClass =
                    ICON_COLOR[(project.color as ColorKey) ?? "gray"];

                  return (
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
                          className="flex size-6 items-center justify-center rounded-md bg-muted"
                        >
                          <Icon className={cn("h-4 w-4", colorClass)} />
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
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Thread List */}
      <PanelContent className="space-y-2 p-2">
        {threadsLoading && <ThreadHistoryLoading />}
        {!threadsLoading && filteredThreads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {searchQuery ? "No threads match your search" : "No threads yet"}
            </p>
            {!searchQuery && (
              <Button
                className="mt-4 rounded-md"
                onClick={handleStartNewChat}
                size="sm"
                type="button"
              >
                Start Research
              </Button>
            )}
          </div>
        )}
        {!threadsLoading && filteredThreads.length > 0 && (
          <ThreadList onDelete={handleDeleteThread} threads={filteredThreads} />
        )}
      </PanelContent>

      <PanelFooter className="border-t text-center">
        <p className="text-muted-foreground text-xs">
          {threads.length} thread{threads.length !== 1 ? "s" : ""}
        </p>
      </PanelFooter>

      {/* Modals */}
      <ProjectModal
        onCreate={handleCreateProject}
        onOpenChange={setIsProjectModalOpen}
        open={isProjectModalOpen}
      />
      {searchModal}

      {/* Mobile Sheet */}
      <div className="lg:hidden">
        <Sheet
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
          open={!!chatHistoryOpen && !isLargeScreen}
        >
          <SheetContent className="flex lg:hidden" side="left">
            <SheetHeader>
              <SheetTitle>Threads</SheetTitle>
            </SheetHeader>
            {threadsLoading ? (
              <ThreadHistoryLoading />
            ) : (
              <ThreadList
                onDelete={handleDeleteThread}
                onThreadClick={() => setChatHistoryOpen((o) => !o)}
                threads={filteredThreads}
              />
            )}
            <SheetFooter className="flex-row justify-center">
              <ThemeToggle />
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
