"use client";

import {
  AlertCircleIcon,
  CheckCircleIcon,
  Loader2Icon,
  PauseCircleIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ThreadMetadata } from "@/types/ui";
import { formatTimestamp } from "@/types/ui";

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
 * Get status badge variant and icon
 */
function getStatusConfig(status: ThreadMetadata["status"]): {
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
  label: string;
} {
  const ICON_SIZE_CLASS = "mr-1 size-3";

  switch (status) {
    case "running":
      return {
        variant: "default",
        icon: <Loader2Icon className={cn(ICON_SIZE_CLASS, "animate-spin")} />,
        label: "Running",
      };
    case "completed":
      return {
        variant: "secondary",
        icon: <CheckCircleIcon className={ICON_SIZE_CLASS} />,
        label: "Completed",
      };
    case "interrupted":
      return {
        variant: "outline",
        icon: <PauseCircleIcon className={ICON_SIZE_CLASS} />,
        label: "Paused",
      };
    case "failed":
      return {
        variant: "destructive",
        icon: <AlertCircleIcon className={ICON_SIZE_CLASS} />,
        label: "Failed",
      };
    default:
      // This should never be reached since all status values are handled
      // but satisfies the linter requirement for exhaustive switch
      return {
        variant: "outline",
        icon: <AlertCircleIcon className={ICON_SIZE_CLASS} />,
        label: "Unknown",
      };
  }
}

/**
 * Thread Card Component
 *
 * Displays thread metadata in the thread history panel.
 * Clickable to navigate to the thread view.
 */
export function ThreadCard({
  thread,
  onDelete,
  isActive = false,
  className,
}: ThreadCardProps) {
  const statusConfig = getStatusConfig(thread.status);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    onDelete?.(thread.threadId);
  };

  return (
    <Link className="block" href={`/research/${thread.threadId}`}>
      <Card
        className={cn(
          "transition-colors hover:bg-accent/50",
          isActive && "border-primary bg-accent",
          className
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="line-clamp-2 text-sm">
                {thread.title}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {formatTimestamp(thread.createdAt)}
              </CardDescription>
            </div>
            {onDelete && (
              <Button
                aria-label="Delete thread"
                className="h-6 w-6"
                onClick={handleDelete}
                size="icon"
                type="button"
                variant="ghost"
              >
                <TrashIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge className="flex items-center" variant={statusConfig.variant}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            <div className="flex items-center gap-2">
              <Badge className="text-xs" variant="outline">
                {thread.mode}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {thread.messageCount} msg
              </span>
            </div>
          </div>
          {thread.preview && (
            <p className="mt-2 line-clamp-2 text-muted-foreground text-xs">
              {thread.preview}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
