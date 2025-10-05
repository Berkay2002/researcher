"use client";

import { ExternalLinkIcon, PinIcon } from "lucide-react";
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
 * Displays source metadata in the sources panel:
 * - Title, host, date
 * - Snippet
 * - Supporting excerpt
 * - "Why used" explanation
 * - Pin/unpin action
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

  return (
    <Card className={cn("transition-colors hover:bg-accent/30", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-2 text-sm">
              <a
                className="hover:underline"
                href={source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {source.title}
              </a>
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2 text-xs">
              <span className="truncate">{source.host}</span>
              {source.date && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{new Date(source.date).toLocaleDateString()}</span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {onTogglePin && (
              <Button
                aria-label={source.isPinned ? "Unpin source" : "Pin source"}
                className={cn("h-6 w-6", source.isPinned && "text-primary")}
                onClick={handleTogglePin}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PinIcon
                  className={cn("h-3 w-3", source.isPinned && "fill-current")}
                />
              </Button>
            )}
            <a
              aria-label="Open source in new tab"
              href={source.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Button
                className="h-6 w-6"
                size="icon"
                type="button"
                variant="ghost"
              >
                <ExternalLinkIcon className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {/* Snippet */}
        {source.snippet && (
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {source.snippet}
          </p>
        )}

        {/* Supporting Excerpt */}
        {source.excerpt && (
          <blockquote className="border-muted border-l-2 pl-3 text-xs italic">
            {source.excerpt}
          </blockquote>
        )}

        {/* Why Used */}
        {source.whyUsed && (
          <div className="flex items-start gap-2">
            <Badge className="shrink-0 text-xs" variant="secondary">
              Why used
            </Badge>
            <p className="text-muted-foreground text-xs">{source.whyUsed}</p>
          </div>
        )}

        {/* Metadata Tags */}
        {source.metadata && (
          <div className="flex flex-wrap gap-1">
            {source.metadata.type && (
              <Badge className="text-xs" variant="outline">
                {source.metadata.type}
              </Badge>
            )}
            {source.metadata.author && (
              <Badge className="text-xs" variant="outline">
                {source.metadata.author}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
