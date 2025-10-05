"use client";

import { ExternalLinkIcon } from "lucide-react";
import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getFaviconUrl } from "@/lib/utils/favicon";

export type InlineCitationNumberProps = {
  number: number;
  text: string;
  sources: string[];
};

const FAVICON_SIZE = 16;

/**
 * Inline Citation Number Component
 *
 * Renders citation as superscript number with hover popover.
 * Matches ChatGPT's design with source preview.
 */
export function InlineCitationNumber({
  number,
  text,
  sources,
}: InlineCitationNumberProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <sup className="cursor-pointer text-primary text-xs hover:underline">
          [{number}]
        </sup>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="space-y-2">
          {/* Citation Text */}
          <p className="text-sm leading-relaxed">{text}</p>

          {/* Source Links */}
          <div className="space-y-1 border-t pt-2">
            {sources.map((sourceUrl) => {
              try {
                const url = new URL(sourceUrl);
                const domain = url.hostname;
                return (
                  <a
                    className="flex items-center gap-2 rounded p-1 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                    href={sourceUrl}
                    key={sourceUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Image
                      alt=""
                      className="size-4 shrink-0 rounded"
                      height={FAVICON_SIZE}
                      src={getFaviconUrl(domain, FAVICON_SIZE)}
                      unoptimized
                      width={FAVICON_SIZE}
                    />
                    <span className="min-w-0 flex-1 truncate">{domain}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                );
              } catch {
                return null;
              }
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
