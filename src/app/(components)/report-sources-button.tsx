"use client";

import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDomainColor, getFaviconUrl } from "@/lib/utils/favicon";
import type { SourceCardData } from "@/types/ui";

/**
 * Report Sources Button Props
 */
export type ReportSourcesButtonProps = {
  sources: SourceCardData[];
  isOpen?: boolean;
  onClick?: () => void;
  className?: string;
};

const MAX_VISIBLE_FAVICONS = 3;
const FAVICON_SIZE = 24;
const FAVICON_DISPLAY_SIZE = 32;

/**
 * Report Sources Button Component
 *
 * Button showing source favicons with toggle for sources panel.
 * Matches ChatGPT's design with overlapping circular favicons.
 *
 * Features:
 * - Shows first 3 source favicons as overlapping circles
 * - "+N" indicator for remaining sources
 * - Chevron rotates when panel is open
 * - Colored gradient backgrounds for favicons
 */
export function ReportSourcesButton({
  sources,
  isOpen = false,
  onClick,
  className,
}: ReportSourcesButtonProps) {
  const visibleSources = sources.slice(0, MAX_VISIBLE_FAVICONS);
  const remainingCount = sources.length - MAX_VISIBLE_FAVICONS;

  return (
    <Button
      className={cn(
        "gap-2 rounded-lg border border-border/60 bg-card/40",
        "transition-all duration-200 hover:border-border/80 hover:bg-card/60",
        isOpen && "border-border bg-accent/60 text-foreground",
        className
      )}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {/* Overlapping Favicons */}
      <div className="-space-x-2 flex">
        {visibleSources.map((source) => (
          <div className="relative size-6 shrink-0" key={source.id}>
            {/* Colored background gradient */}
            <div
              className={cn(
                "absolute inset-0 rounded-full border-2 border-background bg-gradient-to-br",
                getDomainColor(source.host)
              )}
            />
            {/* Favicon */}
            <Image
              alt={`Favicon for ${source.host}`}
              className="relative size-6 rounded-full border-2 border-background object-cover"
              height={FAVICON_SIZE}
              src={getFaviconUrl(source.host, FAVICON_DISPLAY_SIZE)}
              unoptimized
              width={FAVICON_SIZE}
            />
          </div>
        ))}

        {/* "+N" Counter for remaining sources */}
        {remainingCount > 0 && (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-background bg-muted font-medium text-xs">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Label */}
      <span>Sources</span>

      {/* Chevron indicator */}
      <ChevronRightIcon
        className={cn("size-4 transition-transform", isOpen && "rotate-90")}
      />
    </Button>
  );
}
