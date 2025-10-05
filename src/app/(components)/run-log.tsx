"use client";

import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { RunLogEntry } from "@/types/ui";

/**
 * Run Log Props
 */
export type RunLogProps = {
  entries: RunLogEntry[];
  className?: string;
};

/**
 * Run Log Component
 *
 * Displays execution timeline for transparency:
 * - Node execution order
 * - Status (started/completed/failed)
 * - Duration
 * - Tool calls (optional)
 * - Cost tracking (optional)
 */
export function RunLog({ entries, className }: RunLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) {
    return null;
  }

  const completedNodes = entries.filter((e) => e.status === "completed").length;
  const failedNodes = entries.filter((e) => e.status === "failed").length;

  return (
    <Collapsible
      className={cn("border-t", className)}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/50">
        <div className="flex items-center gap-2">
          <ClockIcon className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">Run Log</span>
          <Badge className="text-xs" variant="secondary">
            {entries.length} steps
          </Badge>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">
        <div className="space-y-2">
          {entries.map((entry) => (
            <RunLogEntryItem entry={entry} key={entry.id} />
          ))}
        </div>
        {/* Summary */}
        <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="size-3 text-green-500" />
            <span>{completedNodes} completed</span>
          </div>
          {failedNodes > 0 && (
            <div className="flex items-center gap-1">
              <XCircleIcon className="size-3 text-destructive" />
              <span>{failedNodes} failed</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Run Log Entry Item Component
 */
type RunLogEntryItemProps = {
  entry: RunLogEntry;
};

function RunLogEntryItem({ entry }: RunLogEntryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = getStatusConfig(entry.status);
  const hasDetails =
    entry.details || (entry.toolCalls && entry.toolCalls.length > 0);

  const DURATION_MS_THRESHOLD = 1000;
  const COST_DECIMAL_PLACES = 4;

  return (
    <div className="rounded-lg border p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {statusConfig.icon}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-sm">{entry.node}</span>
              <Badge
                className="shrink-0 text-xs"
                variant={statusConfig.variant}
              >
                {statusConfig.label}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              {entry.duration !== undefined && entry.duration > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {entry.duration >= DURATION_MS_THRESHOLD
                      ? `${(entry.duration / DURATION_MS_THRESHOLD).toFixed(1)}s`
                      : `${entry.duration}ms`}
                  </span>
                </>
              )}
              {entry.cost && (
                <>
                  <span>•</span>
                  <span>${entry.cost.usd.toFixed(COST_DECIMAL_PLACES)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {hasDetails && (
          <button
            aria-label={isExpanded ? "Hide details" : "Show details"}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && hasDetails && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {entry.details && (
            <p className="text-muted-foreground text-xs">{entry.details}</p>
          )}
          {entry.toolCalls && entry.toolCalls.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-xs">Tool Calls:</p>
              {entry.toolCalls.map((toolCall, index) => (
                <div
                  className="rounded bg-muted p-2"
                  key={`${toolCall.tool}-${index}`}
                >
                  <p className="font-mono text-xs">{toolCall.tool}</p>
                  {toolCall.error && (
                    <p className="mt-1 text-destructive text-xs">
                      Error: {toolCall.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get status configuration
 */
function getStatusConfig(status: RunLogEntry["status"]): {
  icon: React.ReactNode;
  variant: "default" | "secondary" | "destructive";
  label: string;
} {
  const ICON_SIZE_CLASS = "size-4 shrink-0";

  switch (status) {
    case "started":
      return {
        icon: <ClockIcon className={cn(ICON_SIZE_CLASS, "text-blue-500")} />,
        variant: "default",
        label: "Started",
      };
    case "completed":
      return {
        icon: (
          <CheckCircleIcon className={cn(ICON_SIZE_CLASS, "text-green-500")} />
        ),
        variant: "secondary",
        label: "Completed",
      };
    case "failed":
      return {
        icon: (
          <XCircleIcon className={cn(ICON_SIZE_CLASS, "text-destructive")} />
        ),
        variant: "destructive",
        label: "Failed",
      };
    default:
      // This should never happen with the current type definition
      return {
        icon: <ClockIcon className={cn(ICON_SIZE_CLASS, "text-muted-foreground")} />,
        variant: "default",
        label: "Unknown",
      };
  }
}
