"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SourceMetadata } from "@/server/workflows/deep-research/graph/state";

export type ReportSourcesButtonProps = {
  sources: SourceMetadata[];
  isOpen: boolean;
  onClick: () => void;
  className?: string;
};

/**
 * Report Sources Button Component
 *
 * Toggles the sources panel visibility.
 * Shows source count and chevron icon.
 *
 * MIGRATED: Now uses SourceMetadata[] from LangGraph state schema
 * instead of deprecated SourceCardData from ui.ts
 */
export function ReportSourcesButton({
  sources,
  isOpen,
  onClick,
  className,
}: ReportSourcesButtonProps) {
  const sourceCount = sources.length;
  const Icon = isOpen ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Button
      className={cn("gap-2", className)}
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      <span>
        {sourceCount} {sourceCount === 1 ? "Source" : "Sources"}
      </span>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
