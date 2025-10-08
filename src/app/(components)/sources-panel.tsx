"use client";

import {
  FilterIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  PinIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getFaviconUrl } from "@/lib/utils/favicon";
import type { CitationData, SourceCardData } from "@/types/ui";
import { PanelContent, PanelHeader } from "./app-shell";
import { SourceCard } from "./source-card";

/**
 * Sources Panel Props
 */
export type SourcesPanelProps = {
  sources: SourceCardData[];
  citations?: CitationData[];
  onTogglePin?: (url: string) => void;
  className?: string;
  onSidebarOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  scrollToSourceIndex?: number;
  planSummary?: ReactNode;
};

/**
 * Sources Panel Component
 *
 * Right panel displaying sources with filtering:
 * - Search by title/host
 * - Filter by domain
 * - Show pinned only
 * - Real-time updates as sources arrive
 */
const FAVICON_SIZE = 16;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <It is fine>
export function SourcesPanel({
  sources,
  citations,
  onTogglePin,
  className,
  onSidebarOpenChange,
  isSidebarOpen = true,
  scrollToSourceIndex,
  planSummary,
}: SourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const sourceRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleToggleSidebar = useCallback(() => {
    onSidebarOpenChange?.(!isSidebarOpen);
  }, [isSidebarOpen, onSidebarOpenChange]);

  // Scroll to specific source when requested
  useEffect(() => {
    const HIGHLIGHT_DURATION_MS = 2000;
    if (scrollToSourceIndex !== undefined && scrollToSourceIndex >= 0) {
      const element = sourceRefs.current.get(scrollToSourceIndex);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        // Add highlight effect
        element.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, HIGHLIGHT_DURATION_MS);
      }
    }
  }, [scrollToSourceIndex]);

  const pinnedCount = sources.filter((s) => s.isPinned).length;
  const clearFilters = () => {
    setSearchQuery("");
    setDomainFilter("all");
    setShowPinnedOnly(false);
  };

  // Extract unique domains from sources
  const uniqueDomains = useMemo(() => {
    const domains = new Set(sources.map((source) => source.host));
    return Array.from(domains).sort();
  }, [sources]);

  // Filter sources based on active filters
  const filteredSources = useMemo(() => {
    let filtered = sources;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (source) =>
          source.title.toLowerCase().includes(query) ||
          source.host.toLowerCase().includes(query) ||
          source.snippet.toLowerCase().includes(query)
      );
    }

    // Domain filter
    if (domainFilter !== "all") {
      filtered = filtered.filter((source) => source.host === domainFilter);
    }

    // Pinned filter
    if (showPinnedOnly) {
      filtered = filtered.filter((source) => source.isPinned);
    }

    return filtered;
  }, [sources, searchQuery, domainFilter, showPinnedOnly]);

  // Count of active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) {
      count++;
    }
    if (domainFilter !== "all") {
      count++;
    }
    if (showPinnedOnly) {
      count++;
    }
    return count;
  }, [searchQuery, domainFilter, showPinnedOnly]);

  if (!isSidebarOpen) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {/* Collapsed Header */}
        <div className="flex h-15 items-center justify-start px-4">
          <Button
            aria-label="Open sources sidebar"
            className="rounded-lg hover:bg-accent/60"
            onClick={() => onSidebarOpenChange?.(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelRightOpenIcon className="size-5" />
          </Button>
        </div>

        {/* Collapsed Filter Area */}
        <div className="flex h-6 items-center justify-start px-4">
          <Button
            aria-label="Toggle filters"
            className={cn(
              "rounded-lg hover:bg-accent/60",
              showFilters && "bg-accent/60 text-foreground"
            )}
            onClick={() => {
              onSidebarOpenChange?.(true);
              setShowFilters(!showFilters);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <FilterIcon className="size-5" />
            {activeFilterCount > 0 && (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <PanelHeader
        actions={
          <div className="flex items-center gap-1">
            <Button
              aria-label="Toggle filters"
              className={cn(
                "rounded-lg transition-colors hover:bg-accent/60",
                showFilters && "bg-accent/60 text-foreground"
              )}
              onClick={() => setShowFilters(!showFilters)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <FilterIcon className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {onSidebarOpenChange && (
              <Button
                aria-label="Hide sources"
                className="size-7 rounded-lg hover:bg-accent/60"
                onClick={handleToggleSidebar}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PanelRightCloseIcon className="size-5" />
              </Button>
            )}
          </div>
        }
        middle={planSummary}
        subtitle={`${sources.length} found`}
        title="Sources"
      />

      {/* Tabs */}
      <Tabs
        className="flex flex-1 flex-col overflow-hidden"
        defaultValue="sources"
      >
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger className="flex-1" value="sources">
            Sources ({sources.length})
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="citations">
            Citations ({citations?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Sources Tab */}
        <TabsContent
          className="flex flex-1 flex-col overflow-hidden"
          value="sources"
        >
          {/* Filters (collapsible) */}
          {showFilters && (
            <div className="space-y-3 border-b px-4 py-3">
              {/* Search */}
              <Input
                className="rounded-lg"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sources..."
                type="search"
                value={searchQuery}
              />

              {/* Domain and Pinned Filters - Side by Side */}
              <div className="flex gap-2">
                {/* Pinned Filter */}
                <Button
                  className={cn(
                    "h-9 flex-1 rounded-md border border-border/60 bg-card/40 transition-colors hover:bg-card/60",
                    showPinnedOnly && "border-border bg-accent/60 text-foreground"
                  )}
                  onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                  type="button"
                  variant="ghost"
                >
                  <PinIcon className="mr-2 size-3" />
                  Pinned only ({pinnedCount})
                </Button>

                {/* Domain Filter */}
                <Select onValueChange={setDomainFilter} value={domainFilter}>
                  <SelectTrigger className="h-10 flex-1 rounded-md" size="default">
                    <SelectValue placeholder="All domains" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All domains</SelectItem>
                    {uniqueDomains.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button
                  className="w-full rounded-md hover:bg-muted/40"
                  onClick={clearFilters}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <XIcon className="mr-2 size-3" />
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {/* Sources List */}
          <PanelContent className="space-y-2 p-2">
            {filteredSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  {sources.length === 0
                    ? "No sources yet"
                    : "No sources match your filters"}
                </p>
                {activeFilterCount > 0 && (
                  <Button
                    className="mt-4 rounded-md hover:bg-muted/40"
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              filteredSources.map((source, index) => (
                <div
                  key={source.id}
                  ref={(el) => {
                    if (el) {
                      sourceRefs.current.set(index, el);
                    } else {
                      sourceRefs.current.delete(index);
                    }
                  }}
                >
                  <SourceCard onTogglePin={onTogglePin} source={source} />
                </div>
              ))
            )}
          </PanelContent>
        </TabsContent>

        {/* Citations Tab */}
        <TabsContent
          className="flex flex-1 flex-col overflow-hidden"
          value="citations"
        >
          <PanelContent className="space-y-2 p-2">
            {citations && citations.length > 0 ? (
              citations.map((citation, index) => (
                <div
                  className="group flex gap-3 rounded-lg border border-transparent bg-card/40 p-3 transition-all duration-200 hover:border-border/60 hover:bg-card/60"
                  key={citation.id}
                >
                  <span className="shrink-0 font-medium font-mono text-xs">
                    [{index + 1}]
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="line-clamp-2 text-sm leading-tight">
                      {citation.text}
                    </p>
                    <div className="flex items-center gap-2">
                      {citation.sources.map((sourceUrl) => {
                        try {
                          const domain = new URL(sourceUrl).hostname;
                          return (
                            <a
                              className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground hover:underline"
                              href={sourceUrl}
                              key={sourceUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <Image
                                alt=""
                                className="size-4 rounded"
                                height={FAVICON_SIZE}
                                src={getFaviconUrl(domain, FAVICON_SIZE)}
                                unoptimized
                                width={FAVICON_SIZE}
                              />
                              <span className="truncate">{domain}</span>
                            </a>
                          );
                        } catch {
                          return null;
                        }
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No citations yet
                </p>
              </div>
            )}
          </PanelContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}
