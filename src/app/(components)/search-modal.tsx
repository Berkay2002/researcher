"use client";

import { FilePlus2Icon, MessageCircleIcon } from "lucide-react";
import { useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";

export type SearchModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: ThreadMetadata[];
  onSelectThread?: (thread: ThreadMetadata) => void;
  onCreateThread?: () => void;
  className?: string;
};

export function SearchModal({
  open,
  onOpenChange,
  threads,
  onSelectThread,
  onCreateThread,
  className,
}: SearchModalProps) {
  const sortedThreads = useMemo(
    () =>
      [...threads].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [threads]
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <It is fine>
  const sectionedThreads = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);

    const today: ThreadMetadata[] = [];
    const yesterday: ThreadMetadata[] = [];
    const earlier: ThreadMetadata[] = [];

    for (const thread of sortedThreads) {
      const createdAt = new Date(thread.createdAt ?? thread.updatedAt);
      if (createdAt >= startOfToday) {
        today.push(thread);
        continue;
      }
      if (createdAt >= startOfYesterday) {
        yesterday.push(thread);
        continue;
      }
      earlier.push(thread);
    }

    const sections: { label: string; threads: ThreadMetadata[] }[] = [];

    if (today.length > 0) {
      sections.push({ label: "Today", threads: today });
    }

    if (yesterday.length > 0) {
      sections.push({ label: "Yesterday", threads: yesterday });
    }

    if (earlier.length > 0) {
      sections.push({
        label:
          today.length === 0 && yesterday.length === 0 ? "Latest" : "Earlier",
        threads: earlier,
      });
    }

    if (sections.length === 0 && sortedThreads.length > 0) {
      sections.push({ label: "Latest", threads: sortedThreads });
    }

    return sections;
  }, [sortedThreads]);

  return (
    <CommandDialog
      className={cn(
        "max-w-xl overflow-hidden rounded-2xl border border-border/50 bg-card/95 p-0 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85",
        className
      )}
      description="Switch to an existing research thread or start a new one"
      onOpenChange={onOpenChange}
      open={open}
      title="Search threads"
    >
      <CommandInput placeholder="Search threads..." />
      <CommandList className="max-h-[440px] overflow-y-auto bg-transparent py-3">
        <CommandEmpty className="mx-4 rounded-xl border border-border/50 border-dashed bg-transparent py-10 text-muted-foreground">
          No threads found.
        </CommandEmpty>

        {onCreateThread ? (
          <CommandGroup
            className="mx-2 mb-2 space-y-2 rounded-xl bg-transparent p-0 [&_[cmdk-group-heading]]:sr-only"
            heading="Quick actions"
          >
            <CommandItem
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[selected=true]:bg-foreground/8 data-[selected=true]:text-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-ring/40"
              onSelect={() => {
                onOpenChange(false);
                onCreateThread();
              }}
            >
              <FilePlus2Icon className="size-4" />
              <span className="font-medium text-foreground text-sm">
                Start new research
              </span>
              <CommandShortcut>⇧⌘N</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        ) : null}

        {sectionedThreads.map((section) => (
          <CommandGroup
            className="mx-2 space-y-2 rounded-xl bg-transparent p-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs"
            heading={section.label}
            key={section.label}
          >
            {section.threads.map((thread) => {
              const label = thread.title || thread.goal || "Untitled thread";
              const secondary = thread.goal && thread.goal !== thread.title;
              return (
                <CommandItem
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[selected=true]:bg-foreground/8 data-[selected=true]:text-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-ring/40"
                  key={thread.threadId}
                  onSelect={() => {
                    onOpenChange(false);
                    onSelectThread?.(thread);
                  }}
                  value={`${label} ${thread.goal ?? ""}`}
                >
                  <MessageCircleIcon className="size-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground text-sm">
                      {label}
                    </span>
                    {secondary ? (
                      <span className="truncate text-muted-foreground text-xs">
                        {thread.goal}
                      </span>
                    ) : null}
                  </div>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
