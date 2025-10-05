"use client";

import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import type { CitationData, MessageData, SourceCardData } from "@/types/ui";
import { InlineCitationNumber } from "./inline-citation-number";
import { ResearchReportCard } from "./research-report-card";

/**
 * Research Message Props
 */
export type ResearchMessageProps = {
  message: MessageData;
  sources?: SourceCardData[];
  isSourcesPanelVisible?: boolean;
  onToggleSourcesPanel?: () => void;
  className?: string;
};

const MIN_REPORT_LENGTH = 1000;

/**
 * Research Message Component
 *
 * Displays a chat message with optional inline citations.
 * Wraps the ai-elements Message component with LangGraph types.
 */
export function ResearchMessage({
  message,
  sources,
  isSourcesPanelVisible,
  onToggleSourcesPanel,
  className,
}: ResearchMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Check if this is a final report (heuristic: has citations, content > 1000 chars)
  const isReport =
    message.citations &&
    message.citations.length > 0 &&
    message.content.length > MIN_REPORT_LENGTH;

  // Define a no-op function for the toggle handler if not provided
  const handleToggleSources =
    onToggleSourcesPanel ||
    (() => {
      // No-op when handler is not provided
    });

  return (
    <Message className={className} from={message.role}>
      <MessageContent variant="flat">
        {/* User message (simple) */}
        {isUser && <p className="text-sm">{message.content}</p>}

        {/* Assistant message - render as report card or regular message */}
        {isAssistant &&
          (isReport ? (
            <ResearchReportCard
              content={message.content}
              isSourcesPanelVisible={Boolean(isSourcesPanelVisible)}
              onToggleSourcesPanel={handleToggleSources}
              sources={sources || []}
            />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {message.citations && message.citations.length > 0 ? (
                <MessageWithCitations
                  citations={message.citations}
                  content={message.content}
                />
              ) : (
                <Response>{message.content}</Response>
              )}
            </div>
          ))}

        {/* System message (if any) */}
        {message.role === "system" && (
          <p className="text-muted-foreground text-xs italic">
            {message.content}
          </p>
        )}

        {/* Metadata (optional) */}
        {message.metadata?.streaming && (
          <div className="mt-2 flex items-center gap-1">
            <div className="size-2 animate-pulse rounded-full bg-primary" />
            <span className="text-muted-foreground text-xs">Streaming...</span>
          </div>
        )}
      </MessageContent>

      {/* Avatar */}
      <MessageAvatar
        name={isUser ? "You" : "AI"}
        src={isUser ? "/user-avatar.png" : "/assistant-avatar.png"}
      />
    </Message>
  );
}

/**
 * Message With Citations Component
 *
 * Renders message content with inline citation hover cards.
 */
type MessageWithCitationsProps = {
  content: string;
  citations: CitationData[];
};

function MessageWithCitations({
  content,
  citations,
}: MessageWithCitationsProps) {
  return (
    <div className="space-y-4">
      <Response>{content}</Response>

      {/* Citations Section */}
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-x-1 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Citations:</span>
          {citations.map((citation, idx) => (
            <span key={citation.id}>
              <InlineCitationNumber
                number={idx + 1}
                sources={citation.sources}
                text={citation.text}
              />
              {idx < citations.length - 1 && (
                <span className="text-muted-foreground">,</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
