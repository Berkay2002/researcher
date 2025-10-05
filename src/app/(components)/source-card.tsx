"use client";

import Image from "next/image";
import { CopyIcon, ExternalLinkIcon, PinIcon } from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";
import { getDomainColor, getFaviconUrl } from "@/lib/utils/favicon";
import type { SourceCardData } from "@/types/ui";

/**
 * Source Card Props
 */
export type SourceCardProps = {
  source: SourceCardData;
  onTogglePin?: (url: string) => void;
  className?: string;
};

/**
 * Source Card Component
 *
 * Compact source card matching ChatGPT's design:
 * - Circular favicon with colored background
 * - Title (clickable, 2 lines max)
 * - Description (3 lines max)
 * - Domain URL
 * - Action buttons on hover (copy, open, pin)
 */
export function SourceCard({
  source,
  onTogglePin,
  className,
}: SourceCardProps) {
  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePin?.(source.url);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(source.url);
  };

  const description = source.snippet || source.excerpt || "";

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border/50 p-3 transition-all hover:border-border hover:bg-accent/30",
        className
      )}
    >
      <div className="flex gap-3">
        {/* Circular Favicon with colored background */}
        <div className="relative size-8 shrink-0">
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-br",
              getDomainColor(source.host)
            )}
          />
          <Image
            alt={`Favicon for ${source.host}`}
            className="relative size-8 rounded-full object-cover"
            height={32}
            src={getFaviconUrl(source.host)}
            unoptimized
            width={32}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {/* Title - clickable, truncate to 2 lines */}
          <a
            className="line-clamp-2 block font-medium text-sm leading-tight hover:underline"
            href={source.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {source.title}
          </a>

          {/* Description - 3 lines max */}
          {description && (
            <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
              {description}
            </p>
          )}

          {/* Domain URL */}
          <p className="truncate text-muted-foreground/60 text-xs">
            {source.host}
          </p>
        </div>
      </div>

      {/* Action buttons - show on hover */}
      <Actions className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Action label="Copy link" onClick={handleCopy} tooltip="Copy link">
          <CopyIcon className="size-4" />
        </Action>
        <Action label="Open in new tab" tooltip="Open in new tab">
          <a href={source.url} rel="noopener noreferrer" target="_blank">
            <ExternalLinkIcon className="size-4" />
          </a>
        </Action>
        {onTogglePin && (
          <Action
            className={cn(source.isPinned && "text-primary")}
            label={source.isPinned ? "Unpin" : "Pin"}
            onClick={handleTogglePin}
            tooltip={source.isPinned ? "Unpin" : "Pin"}
          >
            <PinIcon
              className={cn("size-4", source.isPinned && "fill-current")}
            />
          </Action>
        )}
      </Actions>
    </div>
  );
}
