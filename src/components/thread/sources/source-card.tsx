"use client";

import {
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  PinIcon,
} from "lucide-react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getDomainColor, getFaviconUrl } from "@/lib/utils/favicon";
import type { SourceMetadata } from "@/server/workflows/deep-research/graph/state";

/**
 * Source Card Props (migrated to use LangGraph SDK types)
 */
export type SourceCardProps = {
  source: SourceMetadata;
  onTogglePin?: (url: string) => void;
  className?: string;
  isPinned?: boolean;
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
 *
 * MIGRATED: Now uses SourceMetadata from LangGraph state schema
 * instead of deprecated SourceCardData from ui.ts
 */
export function SourceCard({
  source,
  onTogglePin,
  className,
  isPinned = false,
}: SourceCardProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(source.url);
  };

  const handleTogglePin = () => {
    onTogglePin?.(source.url);
  };

  // Extract domain from URL
  const url = new URL(source.url);
  const domain = url.hostname;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-transparent bg-card/40 p-3",
        "transition-all duration-200 hover:border-border/60 hover:bg-card/60",
        className
      )}
    >
      <div className="flex gap-3">
        {/* Circular Favicon with colored background */}
        <div className="relative size-8 shrink-0">
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-linear-to-br",
              getDomainColor(domain)
            )}
          />
          <Image
            alt={`Favicon for ${domain}`}
            className="relative size-8 rounded-full object-cover"
            height={32}
            src={getFaviconUrl(domain)}
            unoptimized
            width={32}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {/* Title - clickable, truncate to 2 lines */}
          <a
            className="line-clamp-2 block font-medium text-sm leading-tight hover:text-foreground hover:underline"
            href={source.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {source.title}
          </a>

          {/* Query/description if available */}
          {source.query && (
            <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
              {source.query}
            </p>
          )}

          {/* Domain URL */}
          <p className="truncate text-muted-foreground/60 text-xs">{domain}</p>
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Pin button */}
          {onTogglePin && (
            <button
              aria-label={isPinned ? "Unpin source" : "Pin source"}
              className={cn(
                "rounded p-1.5 hover:bg-accent",
                isPinned && "text-primary"
              )}
              onClick={handleTogglePin}
              type="button"
            >
              <PinIcon className="size-3.5" />
            </button>
          )}

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More actions"
                className="rounded p-1.5 hover:bg-accent"
                type="button"
              >
                <EllipsisVerticalIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy}>
                <CopyIcon className="mr-2 size-4" />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={source.url} rel="noopener noreferrer" target="_blank">
                  <ExternalLinkIcon className="mr-2 size-4" />
                  Open in new tab
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
