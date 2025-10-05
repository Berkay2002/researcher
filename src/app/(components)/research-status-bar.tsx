/** biome-ignore-all lint/suspicious/noConsole: <Development> */
"use client";

import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";

export type ResearchStatusBarProps = {
  status: "idle" | "streaming" | "completed" | "error";
  duration?: number; // milliseconds
  sourceCount: number;
  searchCount?: number;
  content?: string; // Report content for copy/download
  className?: string;
};

const MS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;

/**
 * Research Status Bar Component
 *
 * Displays metadata about the research session:
 * - Status indicator (streaming, completed, error)
 * - Duration (e.g., "8m", "2m 30s")
 * - Source count
 * - Search count (optional)
 * - Action buttons (copy, download)
 */
export function ResearchStatusBar({
  status,
  duration,
  sourceCount,
  searchCount,
  content,
  className,
}: ResearchStatusBarProps) {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / MS_IN_SECOND);
    const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
    const remainingSeconds = seconds % SECONDS_IN_MINUTE;

    if (minutes === 0) {
      return `${seconds}s`;
    }
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleCopy = async () => {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Silently fail if clipboard access is denied
    }
  };

  const handleDownload = () => {
    if (!content) {
      return;
    }

    try {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `research-report-${new Date().toISOString().split("T")[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail if download fails
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {/* Status Indicator */}
        {status === "streaming" && (
          <>
            <Loader2Icon className="size-4 animate-spin text-blue-500" />
            <span>Research in progress</span>
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircleIcon className="size-4 text-green-500" />
            <span>Research completed</span>
          </>
        )}

        {/* Duration */}
        {duration !== undefined && duration > 0 && (
          <span>in {formatDuration(duration)}</span>
        )}

        {/* Separator */}
        {(duration !== undefined || status === "completed") && (
          <span className="text-muted-foreground/50">·</span>
        )}

        {/* Source Count */}
        <span>
          {sourceCount} {sourceCount === 1 ? "source" : "sources"}
        </span>

        {/* Search Count (optional) */}
        {searchCount !== undefined && searchCount > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              {searchCount} {searchCount === 1 ? "search" : "searches"}
            </span>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <Actions>
        <Action onClick={handleCopy} tooltip="Copy">
          <CopyIcon className="size-4" />
        </Action>
        <Action onClick={handleDownload} tooltip="Download">
          <DownloadIcon className="size-4" />
        </Action>
      </Actions>
    </div>
  );
}
