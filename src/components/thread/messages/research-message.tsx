/** biome-ignore-all lint/style/noNestedTernary: <Ignore> */
/** biome-ignore-all lint/style/useBlockStatements: <Ignore> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Ignore> */
"use client";

import type { Message } from "@langchain/langgraph-sdk";
import {
  MessageContent,
  Message as UIMessage,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import type { SourceMetadata } from "@/server/workflows/deep-research/graph/state";
import { ContentWithInlineCitations } from "../sources/content-with-inline-citations";
import { InlineCitationNumber } from "../sources/inline-citation-number";
import { ResearchReportCard } from "./research-report-card";

/**
 * Research Message Props (migrated to use LangGraph SDK types)
 */
export type ResearchMessageProps = {
  message: Message;
  isSourcesPanelVisible?: boolean;
  onToggleSourcesPanel?: () => void;
  onCitationClick?: (sourceIndex: number) => void;
  className?: string;
};

const MIN_REPORT_LENGTH = 1000;

/**
 * Extract citations from message content
 */
function extractCitations(content: string): number[] {
  const citationRegex = /\[(?:Source\s+)?(\d+)\]/gi;
  const citations: number[] = [];

  const matches = content.matchAll(citationRegex);
  for (const match of matches) {
    const sourceNum = Number.parseInt(match[1], 10);
    if (!citations.includes(sourceNum)) {
      citations.push(sourceNum);
    }
  }

  return citations.sort((a, b) => a - b);
}

/**
 * Message with citations component
 */
function MessageWithCitations({
  content,
  sources,
  onCitationClick,
}: {
  content: string;
  sources: SourceMetadata[];
  onCitationClick?: (sourceIndex: number) => void;
}) {
  const citations = extractCitations(content);

  return (
    <div className="space-y-3">
      <ContentWithInlineCitations
        content={content}
        onCitationClick={onCitationClick}
        sources={sources}
      />

      {/* Citation numbers for reference */}
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t pt-3">
          <span className="text-muted-foreground text-xs">Citations:</span>
          {citations.map((num) => (
            <InlineCitationNumber
              key={num}
              number={num}
              onClick={() => onCitationClick?.(num - 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Get message content as string
 */
function getContentString(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((block) => {
        if (typeof block === "string") return block;
        if ("text" in block && typeof block.text === "string")
          return block.text;
        return "";
      })
      .join("\n");
  }
  return "";
}

/**
 * Research Message Component
 *
 * Displays a chat message with optional inline citations.
 * Wraps the ai-elements Message component with LangGraph types.
 *
 * MIGRATED: Now uses Message from @langchain/langgraph-sdk
 * and derives sources from useStreamContext instead of props
 */
export function ResearchMessage({
  message,
  isSourcesPanelVisible,
  onToggleSourcesPanel,
  onCitationClick,
  className,
}: ResearchMessageProps) {
  const stream = useStreamContext();
  const sources = stream.values.sources ?? [];

  const isAssistant = message.type === "ai";
  const isSystem = message.type === "system";

  const contentString = getContentString(message);
  const citations = extractCitations(contentString);

  // Check if this is a final report (heuristic: has citations, content > 1000 chars)
  const isReport =
    citations.length > 0 && contentString.length > MIN_REPORT_LENGTH;

  // Define a no-op function for the toggle handler if not provided
  const handleToggleSources =
    onToggleSourcesPanel ||
    (() => {
      // No-op when handler is not provided
    });

  if (isAssistant || isSystem) {
    return (
      <div className={cn("flex w-full justify-center py-4", className)}>
        <div className="flex w-full max-w-3xl flex-col gap-3">
          {isSystem ? (
            <p className="text-muted-foreground text-xs italic">
              {contentString}
            </p>
          ) : isReport ? (
            <ResearchReportCard
              content={contentString}
              isSourcesPanelVisible={Boolean(isSourcesPanelVisible)}
              onCitationClick={onCitationClick}
              onToggleSourcesPanel={handleToggleSources}
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {citations.length > 0 ? (
                <MessageWithCitations
                  content={contentString}
                  onCitationClick={onCitationClick}
                  sources={sources}
                />
              ) : (
                <Response>{contentString}</Response>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Map message type to UI message role
  const role = message.type === "human" ? "user" : "assistant";

  return (
    <UIMessage className={className} from={role}>
      <MessageContent>{contentString}</MessageContent>
    </UIMessage>
  );
}
