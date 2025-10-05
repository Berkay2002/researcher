🎯 Agent Handoff Plan: ChatGPT Deep Research UI Implementation
📋 Overview
This handoff document provides complete context for an agent to finish implementing the ChatGPT Deep Research UI/UX matching the provided screenshots. Phases 1 and 3 are complete. The remaining work is Phases 2, 4, 5, and 6.
✅ What's Already Complete
Phase 1: Source Card Redesign ✅
File: src/app/(components)/source-card.tsx
Changes Made:
Replaced Card/CardHeader/CardContent with plain div
Added circular favicons with gradient backgrounds
Integrated Actions component from ai-elements
Action buttons (copy, open, pin) show on hover
Compact spacing: p-3, gap-3, space-y-1
Title: 2-line truncation (line-clamp-2)
Description: 3-line truncation (line-clamp-3)
Phase 3: Panel Toggle Infrastructure ✅
Files Modified:
src/app/research/[threadId]/page.tsx - Added isSourcesPanelVisible state
src/app/(components)/sources-panel.tsx - Reduced spacing to space-y-2
src/app/(components)/app-shell.tsx - Already supports conditional rendering
New Utilities Created ✅
File: src/lib/utils/favicon.ts
getFaviconUrl(domain, size) - Returns Google favicon URL
getDomainColor(domain) - Consistent color hashing for gradients
New Components Created ✅
File: src/app/(components)/report-sources-button.tsx
Overlapping circular favicons (first 3 sources)
"+N" counter for remaining sources
Chevron rotation on panel open/close
Ready to integrate into report cards
🚧 Remaining Work
Phase 2: Research Report Card Component (HIGH PRIORITY)
Phase 4: Citations Tab in Sources Panel
Phase 5: Research Status Bar
Phase 6: Inline Citation Numbers
📁 Phase 2: Research Report Card Component
Goal
Create a dedicated component for rendering completed research reports in a prominent card format (not as chat messages).
Context Files to Read
src/app/(components)/research-message.tsx - Current message rendering
src/components/ai-elements/response.tsx - Markdown rendering component
src/components/ai-elements/actions.tsx - Action button pattern
src/app/research/[threadId]/page.tsx - Integration point
src/types/ui.ts - TypeScript types for MessageData
New File to Create: src/app/(components)/research-report-card.tsx
Component Specification:
"use client";

import { CopyIcon, ShareIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Response } from "@/components/ai-elements/response";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { SourceCardData } from "@/types/ui";
import { ReportSourcesButton } from "./report-sources-button";

export type ResearchReportCardProps = {
  content: string;
  sources: SourceCardData[];
  isSourcesPanelVisible: boolean;
  onToggleSourcesPanel: () => void;
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
  className,
}: ResearchReportCardProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <Card className={cn("mx-auto w-full max-w-4xl shadow-sm", className)}>
      <CardContent className="p-6 md:p-8">
        {/* Markdown Content */}
        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
          <Response>{content}</Response>
        </div>
      </CardContent>

      <Separator />

      <CardFooter className="flex items-center justify-between p-4">
        {/* Left: Action Buttons */}
        <Actions>
          <Action tooltip="Copy" onClick={handleCopy}>
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
          sources={sources}
          isOpen={isSourcesPanelVisible}
          onClick={onToggleSourcesPanel}
        />
      </CardFooter>
    </Card>
  );
}
Changes to Existing File: src/app/(components)/research-message.tsx
Location: Lines 40-88 (the ResearchMessage component) Current Logic:
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
New Logic: Add prop onToggleSourcesPanel and isSourcesPanelVisible to ResearchMessage component, then:
import { ResearchReportCard } from "./research-report-card";

// Add to props
export type ResearchMessageProps = {
  message: MessageData;
  sources?: SourceCardData[];  // NEW
  isSourcesPanelVisible?: boolean;  // NEW
  onToggleSourcesPanel?: () => void;  // NEW
  className?: string;
};

// Update component logic
{isAssistant && (
  // Check if this is a final report (heuristic: has citations, content > 1000 chars)
  message.citations && message.citations.length > 0 && message.content.length > 1000 ? (
    <ResearchReportCard
      content={message.content}
      sources={sources || []}
      isSourcesPanelVisible={isSourcesPanelVisible || false}
      onToggleSourcesPanel={onToggleSourcesPanel || (() => {})}
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
  )
)}
Changes to Existing File: src/app/research/[threadId]/page.tsx
Location: Lines 334-338 (message rendering) Current:
{messagesWithDraft.map((message) => (
  <ResearchMessage key={message.id} message={message} />
))}
New:
{messagesWithDraft.map((message) => (
  <ResearchMessage
    key={message.id}
    message={message}
    sources={sourcesWithPinned}
    isSourcesPanelVisible={isSourcesPanelVisible}
    onToggleSourcesPanel={() => setIsSourcesPanelVisible(!isSourcesPanelVisible)}
  />
))}
📁 Phase 5: Research Status Bar
Goal
Display research metadata (duration, source count, search count) at the top of the thread with action buttons.
Context Files to Read
src/app/research/[threadId]/page.tsx - Integration point
src/lib/hooks/use-sse-stream.ts - To understand SSE stream state
src/components/ai-elements/actions.tsx - Action buttons
New File to Create: src/app/(components)/research-status-bar.tsx
Component Specification:
"use client";

import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  ShareIcon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";

export type ResearchStatusBarProps = {
  status: "idle" | "streaming" | "completed" | "error";
  duration?: number; // milliseconds
  sourceCount: number;
  searchCount?: number;
  className?: string;
};

/**
 * Research Status Bar Component
 *
 * Displays metadata about the research session:
 * - Status indicator (streaming, completed, error)
 * - Duration (e.g., "8m", "2m 30s")
 * - Source count
 * - Search count (optional)
 * - Action buttons (copy, share, download)
 */
export function ResearchStatusBar({
  status,
  duration,
  sourceCount,
  searchCount,
  className,
}: ResearchStatusBarProps) {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleCopy = async () => {
    // Copy report content - implementation depends on how you want to access it
    // Could pass content as prop or get from context
  };

  const handleShare = () => {
    // Share functionality
  };

  const handleDownload = () => {
    // Download functionality
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {/* Status Indicator */}
        {status === "streaming" && (
          <>
            <Loader2Icon className="size-4 animate-spin text-blue-500" />
            <span>Research in progress</span>
          </>
        )}
        {status === "completed" && (
          <>
            <CheckCircleIcon className="size-4 text-green-500" />
            <span>Research completed</span>
          </>
        )}

        {/* Duration */}
        {duration !== undefined && duration > 0 && (
          <>
            <span>in {formatDuration(duration)}</span>
          </>
        )}

        {/* Separator */}
        {(duration !== undefined || status === "completed") && (
          <span className="text-muted-foreground/50">·</span>
        )}

        {/* Source Count */}
        <span>
          {sourceCount} {sourceCount === 1 ? "source" : "sources"}
        </span>

        {/* Search Count (optional) */}
        {searchCount !== undefined && searchCount > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              {searchCount} {searchCount === 1 ? "search" : "searches"}
            </span>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <Actions>
        <Action tooltip="Copy" onClick={handleCopy}>
          <CopyIcon className="size-4" />
        </Action>
        <Action tooltip="Share" onClick={handleShare}>
          <ShareIcon className="size-4" />
        </Action>
        <Action tooltip="Download" onClick={handleDownload}>
          <DownloadIcon className="size-4" />
        </Action>
      </Actions>
    </div>
  );
}
Changes to Existing File: src/app/research/[threadId]/page.tsx
Location: After line 291 (inside the main return statement, above the ModeSwitch) Add Import:
import { ResearchStatusBar } from "@/app/(components)/research-status-bar";
Add State (after line 40, with other state):
const [researchStartTime] = useState(Date.now());
Insert Component (line ~292, before ModeSwitch):
<div className="flex h-full flex-col">
  {/* Research Status Bar */}
  {sseStream.sources.length > 0 && (
    <ResearchStatusBar
      status={sseStream.status}
      duration={sseStream.status === "completed" ? Date.now() - researchStartTime : undefined}
      sourceCount={sseStream.sources.length}
      searchCount={snapshot?.values?.queries?.length}
    />
  )}

  {/* Mode Switch (if no interrupt active) */}
  {!currentInterrupt && (
    // ... rest of existing code
📁 Phase 4: Citations Tab in Sources Panel
Goal
Add a "Citations" tab to the sources panel showing numbered citations from the report.
Context Files to Read
src/app/(components)/sources-panel.tsx - Current panel implementation
src/components/ui/tabs.tsx - Tabs component (already exists)
src/types/ui.ts - CitationData type
Changes to File: src/app/(components)/sources-panel.tsx
Add Imports:
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFaviconUrl } from "@/lib/utils/favicon";
import type { CitationData } from "@/types/ui";
Update Props (line 22):
export type SourcesPanelProps = {
  sources: SourceCardData[];
  citations?: CitationData[];  // NEW
  onTogglePin?: (url: string) => void;
  className?: string;
};
Wrap Content in Tabs (replace lines 113-227):
<div className={cn("flex h-full flex-col", className)}>
  {/* Header */}
  <PanelHeader
    actions={
      <Button
        aria-label="Toggle filters"
        className={cn(showFilters && "bg-accent")}
        onClick={() => setShowFilters(!showFilters)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <FilterIcon className="size-4" />
        {activeFilterCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
            {activeFilterCount}
          </span>
        )}
      </Button>
    }
    subtitle={`${sources.length} found`}
    title="Sources"
  />

  {/* Tabs */}
  <Tabs defaultValue="sources" className="flex flex-1 flex-col overflow-hidden">
    <TabsList className="w-full rounded-none border-b">
      <TabsTrigger value="sources" className="flex-1">
        Sources ({sources.length})
      </TabsTrigger>
      <TabsTrigger value="citations" className="flex-1">
        Citations ({citations?.length || 0})
      </TabsTrigger>
    </TabsList>

    {/* Sources Tab */}
    <TabsContent value="sources" className="flex-1 overflow-hidden">
      {/* Filters (collapsible) */}
      {showFilters && (
        <div className="space-y-3 border-b px-4 py-3">
          {/* ... existing filter code ... */}
        </div>
      )}

      {/* Sources List */}
      <PanelContent className="space-y-2">
        {/* ... existing sources list code ... */}
      </PanelContent>
    </TabsContent>

    {/* Citations Tab */}
    <TabsContent value="citations" className="flex-1 overflow-hidden">
      <PanelContent className="space-y-2">
        {citations && citations.length > 0 ? (
          citations.map((citation, index) => (
            <div
              key={citation.id}
              className="flex gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-accent/30"
            >
              <span className="shrink-0 font-mono text-xs font-medium">
                [{index + 1}]
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-tight line-clamp-2">
                  {citation.text}
                </p>
                <div className="flex items-center gap-2">
                  {citation.sources.map((sourceUrl) => {
                    try {
                      const domain = new URL(sourceUrl).hostname;
                      return (
                        <a
                          key={sourceUrl}
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                        >
                          <img
                            src={getFaviconUrl(domain, 16)}
                            alt=""
                            className="size-4 rounded"
                          />
                          <span className="truncate">{domain}</span>
                        </a>
                      );
                    } catch {
                      return null;
                    }
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground text-sm">No citations yet</p>
          </div>
        )}
      </PanelContent>
    </TabsContent>
  </Tabs>
</div>
Update Component Call in src/app/research/[threadId]/page.tsx (line ~363):
<SourcesPanel
  onTogglePin={handleTogglePin}
  sources={sourcesWithPinned}
  citations={sseStream.currentDraftCitations.length > 0
    ? sseStream.currentDraftCitations.map((cit, idx) => ({
        id: `draft-cit-${idx}`,
        text: cit.claim,
        sources: cit.sources,
        position: { start: 0, end: cit.claim.length },
      }))
    : undefined
  }
/>
📁 Phase 6: Inline Citation Numbers
Goal
Replace citation sections with inline superscript numbers ([1], [2]) with hover popovers showing source previews.
Context Files to Read
src/app/(components)/research-message.tsx - Current citation rendering
src/components/ai-elements/inline-citation.tsx - Existing citation components
src/components/ui/popover.tsx - Popover component
New File to Create: src/app/(components)/inline-citation-number.tsx
Component Specification:
"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFaviconUrl } from "@/lib/utils/favicon";

export type InlineCitationNumberProps = {
  number: number;
  text: string;
  sources: string[];
};

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
                    key={sourceUrl}
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded p-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <img
                      src={getFaviconUrl(domain, 16)}
                      alt=""
                      className="size-4 shrink-0 rounded"
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
Changes to File: src/app/(components)/research-message.tsx
This is complex - requires parsing markdown content and injecting citation numbers inline. Simple Approach (recommended for now): Keep existing citation section but add inline numbers in the text. Add Import:
import { InlineCitationNumber } from "./inline-citation-number";
Update MessageWithCitations (lines 100-155):
function MessageWithCitations({
  content,
  citations,
}: MessageWithCitationsProps) {
  // Parse content and inject citation numbers
  // For now, just append citations at the end with numbers
  const citationMap = new Map<string, number>();
  citations.forEach((cit, idx) => {
    citationMap.set(cit.id, idx + 1);
  });

  return (
    <div className="space-y-4">
      <Response>{content}</Response>

      {/* Inline Citations */}
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-x-1 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Citations:</span>
          {citations.map((citation, idx) => (
            <span key={citation.id}>
              <InlineCitationNumber
                number={idx + 1}
                text={citation.text}
                sources={citation.sources}
              />
              {idx < citations.length - 1 && <span className="text-muted-foreground">,</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
Advanced Approach (optional, more work): Parse the content string and detect citation markers (e.g., {cite:claim}), then replace with InlineCitationNumber components. This requires:
Regex parsing of markdown content
Splitting text into segments
Rendering mix of text and React components
Handling edge cases (citations in headings, lists, etc.)
🎨 Visual Polish (Optional Final Step)
Typography Adjustments
File: src/app/(components)/research-report-card.tsx Adjust prose classes for better hierarchy:
<div className="prose prose-base lg:prose-lg dark:prose-invert max-w-none
  [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4
  [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3
  [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-4 [&>h3]:mb-2
  [&>p]:leading-relaxed [&>p]:mb-4
  [&>ul]:my-3 [&>ol]:my-3
">
  <Response>{content}</Response>
</div>
Center Panel Max Width
File: src/app/(components)/app-shell.tsx Adjust center panel to better accommodate wide report cards:
{/* Center Panel - Main Content */}
<main className="flex min-w-0 flex-1 flex-col overflow-hidden">
  <div className="mx-auto w-full max-w-7xl">
    {centerPanel}
  </div>
</main>
📦 Required Dependencies
All dependencies are already installed. No new packages needed. Key Libraries Used:
lucide-react - Icons
@radix-ui/* - UI primitives (already used throughout)
tailwindcss - Styling
class-variance-authority / clsx - Class utilities (via cn())
🧪 Testing Checklist
After implementation, verify:
Source Cards:
✅ Circular favicons with gradient backgrounds
✅ Action buttons appear on hover
✅ Copy, open, pin buttons work
✅ Cards are compact (match ChatGPT spacing)
Report Card:
 Shows for messages with citations and >1000 chars
 Sources button displays favicon previews
 Clicking Sources button toggles panel
 Action buttons (copy, thumbs, share) work
 Markdown renders properly
Status Bar:
 Shows correct duration formatting
 Source/search counts accurate
 Appears only when sources exist
 Status indicator shows correct state
Citations Tab:
 Tab switching works
 Citations show numbered list
 Favicon icons load correctly
 Links are clickable
Inline Citations (optional):
 Citation numbers appear as superscripts
 Hover shows popover with source preview
 Links in popover work
Panel Toggle:
 Sources panel hides when button clicked
 Layout adjusts (no empty space)
 Chevron rotates correctly
🚀 Implementation Order (Recommended)
Phase 2 - Research Report Card (biggest visual impact)
Phase 5 - Research Status Bar (quick win)
Phase 4 - Citations Tab (moderate complexity)
Phase 6 - Inline Citation Numbers (most complex, optional)
Visual Polish - Typography and spacing tweaks
🔍 Key Files Reference
Files to Modify:
src/app/(components)/research-message.tsx
src/app/(components)/sources-panel.tsx
src/app/research/[threadId]/page.tsx
Files to Create:
src/app/(components)/research-report-card.tsx
src/app/(components)/research-status-bar.tsx
src/app/(components)/inline-citation-number.tsx
Utility Files (Already Created):
src/lib/utils/favicon.ts
src/app/(components)/report-sources-button.tsx
Context Files (Read Only):
src/components/ai-elements/actions.tsx
src/components/ai-elements/response.tsx
src/components/ui/tabs.tsx
src/components/ui/popover.tsx
src/types/ui.ts
💡 Implementation Tips
Start Simple: Implement basic functionality first, then refine styling.
Test Incrementally: After each component, test in the browser before moving to the next.
Use Existing Patterns: Follow the existing code style (e.g., using cn() for classes, proper TypeScript types).
Biome/Ultracite: Run npx ultracite fix after each change to catch issues early.
Citation Parsing (Phase 6): Start with the simple approach (citations list at end). Only implement advanced inline parsing if time permits.
Responsive Design: The designs shown work well on desktop. Mobile responsiveness is already handled by the existing AppShell responsive breakpoints.
Dark Mode: All components should automatically support dark mode via Tailwind's dark: variants. The existing prose-invert class handles markdown content.
✅ Definition of Done
The implementation is complete when:
✅ Source cards match ChatGPT screenshot (circular favicons, compact layout, hover actions)
✅ Research reports render in prominent cards (not chat messages)
✅ Sources button shows favicon previews and toggles panel
✅ Research status bar displays metadata (duration, counts)
✅ Citations tab shows numbered citations with favicons
✅ (Optional) Inline citation numbers work with hover popovers
✅ Panel toggle works smoothly with layout adjustment
✅ All existing functionality preserved (streaming, filtering, SSE)
✅ No Biome/Ultracite errors
✅ Components are properly typed with TypeScript
📞 Questions or Issues?
If you encounter any issues:
Type Errors: Check src/types/ui.ts for correct type definitions
Component Not Rendering: Verify imports and prop passing
Styling Issues: Use browser DevTools to inspect classes, ensure Tailwind classes are applied
State Not Updating: Check React hooks, ensure state setters are called correctly
Good luck! 🚀