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
  const handleCopy = async () => {
    await navigator.clipboard.writeText(source.url);
  };

  const handleTogglePin = () => {
    onTogglePin?.(source.url);
  };

  const description = source.snippet || source.excerpt || "";

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
            className="line-clamp-2 block font-medium text-sm leading-tight hover:text-foreground hover:underline"
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

      {/* Action menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "absolute top-2 right-2 inline-flex size-8 items-center justify-center",
              "rounded-md border border-transparent text-muted-foreground",
              "transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
              source.isPinned && "border-border/60 bg-card"
            )}
            type="button"
          >
            <EllipsisVerticalIcon className="size-4" />
            <span className="sr-only">Source actions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" sideOffset={8}>
          <DropdownMenuItem
            onSelect={async () => {
              await handleCopy();
            }}
          >
            <CopyIcon className="mr-2 size-4" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={source.url} rel="noopener noreferrer" target="_blank">
              <ExternalLinkIcon className="mr-2 size-4" />
              Open in new tab
            </a>
          </DropdownMenuItem>
          {onTogglePin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={cn(source.isPinned && "text-primary")}
                onSelect={() => {
                  handleTogglePin();
                }}
              >
                <PinIcon
                  className={cn(
                    "mr-2 size-4",
                    source.isPinned && "fill-current"
                  )}
                />
                {source.isPinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
