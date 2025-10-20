"use client";

import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import type { SourceMetadata } from "@/server/workflows/deep-research/graph/state";

export type ContentWithInlineCitationsProps = {
  content: string;
  sources: SourceMetadata[];
  onCitationClick?: (sourceIndex: number) => void;
  className?: string;
};

/**
 * Content With Inline Citations Component
 *
 * Renders markdown content with [Source X] or [X] citations converted to clickable badges.
 * Uses Streamdown for proper markdown rendering while injecting inline citation badges.
 *
 * MIGRATED: Now uses SourceMetadata[] from LangGraph state schema
 * instead of deprecated SourceCardData from ui.ts
 */
export function ContentWithInlineCitations({
  content,
  sources,
  onCitationClick,
  className,
}: ContentWithInlineCitationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert [Source X] or [X] patterns to clickable badges after render
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <DOM manipulation requires complexity>
  // biome-ignore lint/correctness/useExhaustiveDependencies: <DOM manipulation requires complexity>
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const citationRegex = /\[(?:Source\s+)?(\d+)\]/gi;

    // Find all text nodes containing citation patterns
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToProcess: Array<{
      node: Text;
      matches: RegExpMatchArray[];
    }> = [];

    let currentNode = walker.nextNode() as Text | null;
    while (currentNode) {
      const text = currentNode.textContent || "";
      const matches = Array.from(text.matchAll(citationRegex));
      if (matches.length > 0) {
        nodesToProcess.push({ node: currentNode, matches });
      }
      currentNode = walker.nextNode() as Text | null;
    }

    // Process nodes in reverse to avoid position issues
    for (const { node, matches } of nodesToProcess.reverse()) {
      const text = node.textContent || "";
      const parent = node.parentNode;
      if (!parent) {
        continue;
      }

      let lastIndex = 0;
      const fragment = document.createDocumentFragment();

      for (const match of matches) {
        const matchIndex = match.index ?? 0;
        const sourceNum = match[1];
        const sourceIndex = Number.parseInt(sourceNum, 10) - 1;

        // Add text before citation
        if (matchIndex > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, matchIndex))
          );
        }

        // Create badge for citation
        const badge = document.createElement("span");
        badge.className =
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ml-1 cursor-pointer";
        badge.textContent = sourceNum;
        badge.setAttribute("data-source-index", sourceIndex.toString());

        // Add click handler
        if (onCitationClick) {
          badge.addEventListener("click", () => {
            onCitationClick(sourceIndex);
          });
        }

        fragment.appendChild(badge);
        lastIndex = matchIndex + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      parent.replaceChild(fragment, node);
    }
  }, [content, onCitationClick, sources.length]);

  return (
    <div className={className} ref={containerRef}>
      <Streamdown
        className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0")}
      >
        {content}
      </Streamdown>
    </div>
  );
}
