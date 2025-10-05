"use client";

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import type { CitationData, MessageData } from "@/types/ui";

/**
 * Research Message Props
 */
export type ResearchMessageProps = {
  message: MessageData;
  className?: string;
};

/**
 * Research Message Component
 *
 * Displays a chat message with optional inline citations.
 * Wraps the ai-elements Message component with LangGraph types.
 */
export function ResearchMessage({ message, className }: ResearchMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  return (
    <Message className={className} from={message.role}>
      <MessageContent variant="flat">
        {/* User message (simple) */}
        {isUser && <p className="text-sm">{message.content}</p>}

        {/* Assistant message with citations */}
        {isAssistant && (
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
        )}

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
  // Group citations by text span for rendering
  const citationMap = new Map<string, CitationData[]>();

  for (const citation of citations) {
    const existing = citationMap.get(citation.text) || [];
    citationMap.set(citation.text, [...existing, citation]);
  }

  // Simple citation rendering (without complex text splitting)
  // For now, just render content with citations appended
  return (
    <div className="space-y-4">
      <Response>{content}</Response>

      {/* Citations Section */}
      {citations.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          {citations.map((citation) => (
            <InlineCitation key={citation.id}>
              <InlineCitationText>{citation.text}</InlineCitationText>
              <InlineCitationCard>
                <InlineCitationCardTrigger sources={citation.sources} />
                <InlineCitationCardBody>
                  <InlineCitationCarousel>
                    <InlineCitationCarouselHeader>
                      <InlineCitationCarouselPrev />
                      <InlineCitationCarouselIndex />
                      <InlineCitationCarouselNext />
                    </InlineCitationCarouselHeader>
                    <InlineCitationCarouselContent>
                      {citation.sources.map((sourceUrl) => (
                        <InlineCitationCarouselItem key={sourceUrl}>
                          <InlineCitationSource
                            title={new URL(sourceUrl).hostname}
                            url={sourceUrl}
                          />
                          <InlineCitationQuote>
                            {citation.text}
                          </InlineCitationQuote>
                        </InlineCitationCarouselItem>
                      ))}
                    </InlineCitationCarouselContent>
                  </InlineCitationCarousel>
                </InlineCitationCardBody>
              </InlineCitationCard>
            </InlineCitation>
          ))}
        </div>
      )}
    </div>
  );
}
