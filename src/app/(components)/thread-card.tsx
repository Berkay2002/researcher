"use client";

import { MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";

export type ThreadCardProps = {
  thread: ThreadMetadata;
  onDelete?: (threadId: string) => void;
  isActive?: boolean;
  className?: string;
};

export function ThreadCard({
  thread,
  onDelete,
  isActive = false,
  className,
}: ThreadCardProps) {
  const titleRef = useRef<HTMLSpanElement | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);

  const updateTruncation = useCallback(() => {
    const element = titleRef.current;
    if (!element) return setIsTitleTruncated(false);
    setIsTitleTruncated(element.scrollWidth > element.clientWidth + 1);
  }, []);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return setIsTitleTruncated(false);

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
    onDelete?.(thread.threadId);
  };

  return (
    <Link
      className="block"
      href={`/research/${thread.threadId}`}
      aria-current={isActive ? "page" : undefined}
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
            : "border border-transparent bg-card/40 hover:bg-card/60 hover:border-border/60",
          className
        )}
      >
        <span
          className="truncate font-medium text-foreground text-sm"
          ref={titleRef}
          title={isTitleTruncated ? thread.title : undefined}
        >
          {thread.title}
        </span>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Thread actions"
                className={cn(
                  "flex h-8 w-8 items-center justify-center",
                  "rounded-lg text-muted-foreground",
                  "transition-colors border border-transparent",
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
