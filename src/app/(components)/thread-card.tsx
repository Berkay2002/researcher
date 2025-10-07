"use client";

import { MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";

/**
 * Thread Card Props
 */
export type ThreadCardProps = {
  thread: ThreadMetadata;
  onDelete?: (threadId: string) => void;
  isActive?: boolean;
  className?: string;
};

/**
 * Thread Card Component
 *
 * Minimal thread row for the history sidebar.
 */
export function ThreadCard({
  thread,
  onDelete,
  isActive = false,
  className,
}: ThreadCardProps) {
  const handleDelete = (event: Event | MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete?.(thread.threadId);
  };

  return (
    <Link className="block" href={`/research/${thread.threadId}`}>
      <div
        className={cn(
          "group flex items-center justify-between gap-2 rounded-md px-3 py-2",
          "text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isActive && "bg-accent/60",
          className
        )}
      >
        <span className="truncate font-medium text-foreground text-sm">
          {thread.title}
        </span>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Thread actions"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
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
              <DropdownMenuItem
                onSelect={(event) => {
                  handleDelete(event);
                }}
              >
                Delete thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Link>
  );
}
