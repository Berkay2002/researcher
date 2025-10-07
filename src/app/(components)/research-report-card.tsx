"use client";

import {
  CopyIcon,
  ShareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SourceCardData } from "@/types/ui";
import { ContentWithInlineCitations } from "./content-with-inline-citations";
import { ReportSourcesButton } from "./report-sources-button";

export type ResearchReportCardProps = {
  content: string;
  sources: SourceCardData[];
  isSourcesPanelVisible: boolean;
  onToggleSourcesPanel: () => void;
  onCitationClick?: (sourceIndex: number) => void;
  className?: string;
};

/**
 * Research Report Card Component
 *
 * Large, centered card for displaying completed research reports.
 * Matches ChatGPT's design with:
 * - Title/header section
 * - Markdown content with proper typography
 * - Bottom action bar with Sources button
 */
export function ResearchReportCard({
  content,
  sources,
  isSourcesPanelVisible,
  onToggleSourcesPanel,
  onCitationClick,
  className,
}: ResearchReportCardProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <Card className={cn("mx-auto w-full max-w-4xl shadow-sm", className)}>
      <CardContent className="p-6 md:p-8">
        {/* Markdown Content */}
        <div className="dark:prose-invert lg:prose-lg prose prose-base max-w-none [&>h1]:mb-4 [&>h1]:font-bold [&>h1]:text-2xl [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:font-semibold [&>h2]:text-xl [&>h3]:mt-4 [&>h3]:mb-2 [&>h3]:font-medium [&>h3]:text-lg [&>ol]:my-3 [&>p]:mb-4 [&>p]:leading-relaxed [&>ul]:my-3">
          <ContentWithInlineCitations
            content={content}
            onCitationClick={onCitationClick}
            sources={sources}
          />
        </div>
      </CardContent>

      <Separator />

      <CardFooter className="flex items-center justify-between p-4">
        {/* Left: Action Buttons */}
        <Actions>
          <Action onClick={handleCopy} tooltip="Copy">
            <CopyIcon className="size-4" />
          </Action>
          <Action tooltip="Good response">
            <ThumbsUpIcon className="size-4" />
          </Action>
          <Action tooltip="Bad response">
            <ThumbsDownIcon className="size-4" />
          </Action>
          <Action tooltip="Share">
            <ShareIcon className="size-4" />
          </Action>
        </Actions>

        {/* Right: Sources Button */}
        <ReportSourcesButton
          isOpen={isSourcesPanelVisible}
          onClick={onToggleSourcesPanel}
          sources={sources}
        />
      </CardFooter>
    </Card>
  );
}
