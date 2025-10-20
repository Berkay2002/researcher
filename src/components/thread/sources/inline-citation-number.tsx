"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Inline Citation Number Props (migrated to LangGraph SDK patterns)
 */
export type InlineCitationNumberProps = {
  number: number;
  onClick?: () => void;
  className?: string;
};

/**
 * Inline Citation Number Component
 *
 * Renders a clickable citation badge (e.g., [1], [2], [3])
 * Used within markdown content to reference sources.
 *
 * MIGRATED: No longer uses CitationData type, just displays number
 * and delegates click handling to parent. Parent component
 * derives citation data from graph state.
 */
export function InlineCitationNumber({
  number,
  onClick,
  className,
}: InlineCitationNumberProps) {
  return (
    <Badge
      className={cn(
        "ml-1 cursor-pointer transition-colors hover:bg-secondary/80",
        className
      )}
      onClick={onClick}
      variant="secondary"
    >
      {number}
    </Badge>
  );
}
