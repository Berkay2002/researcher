# Migration to LangGraph SDK Patterns

## Overview
This document outlines the migration from custom types (`ui.ts`) to LangGraph SDK patterns for all components in `src/app/(components)`.

## Type Mapping

### Deprecated → LangGraph SDK

| Deprecated Type | LangGraph SDK Equivalent | Source |
|----------------|-------------------------|---------|
| `MessageData` | `Message` from `@langchain/langgraph-sdk` | Direct SDK type |
| `SourceCardData` | Derived from `state.sources: SourceMetadata[]` | Graph state schema |
| `ThreadMetadata` | From `useThreads()` hook (SDK threads API) | Provider pattern |
| `CitationData` | Extracted from message content + sources | Derived from state |
| `SSEEvent<T>` | Handled by `useStream` hook internally | SDK streaming |
| `DraftEvent`, `EvidenceEvent`, etc. | Use `state.values` from `useStreamContext` | State-based updates |

## Component Migration Plan

### Phase 1: Source & Citation Components
**Files to migrate:**
- `source-card.tsx` - Display individual source
- `inline-citation-number.tsx` - Citation badges
- `content-with-inline-citations.tsx` - Markdown with citations
- `report-sources-button.tsx` - Sources toggle button

**Changes:**
```typescript
// BEFORE (deprecated)
import type { SourceCardData, CitationData } from "@/types/ui";

export function SourceCard({ source }: { source: SourceCardData }) {
  // ...
}

// AFTER (LangGraph SDK)
import { useStreamContext } from "@/providers/Stream";
import type { SourceMetadata } from "@/server/workflows/deep-research/graph/state";

export function SourceCard({ source }: { source: SourceMetadata }) {
  const stream = useStreamContext();
  // Access state: stream.values.sources
  // ...
}
```

### Phase 2: Message Components
**Files to migrate:**
- `research-message.tsx` - Message wrapper with citations
- `research-report-card.tsx` - Final report card

**Changes:**
```typescript
// BEFORE (deprecated)
import type { MessageData } from "@/types/ui";

export function ResearchMessage({ message }: { message: MessageData }) {
  // ...
}

// AFTER (LangGraph SDK)
import type { Message } from "@langchain/langgraph-sdk";
import { useStreamContext } from "@/providers/Stream";

export function ResearchMessage({ message }: { message: Message }) {
  const stream = useStreamContext();
  const sources = stream.values.sources; // Access graph state
  // ...
}
```

### Phase 3: Thread Management
**Files to migrate:**
- `thread-card.tsx` - Individual thread item
- `thread-list.tsx` - Thread list container
- `thread-history-panel.tsx` - Thread history sidebar

**Changes:**
```typescript
// BEFORE (deprecated)
import type { ThreadMetadata } from "@/types/ui";

export function ThreadCard({ thread }: { thread: ThreadMetadata }) {
  // ...
}

// AFTER (LangGraph SDK)
import { useThreads } from "@/providers/Thread";

export function ThreadCard({ threadId }: { threadId: string }) {
  const { threads } = useThreads(); // SDK-provided hook
  const thread = threads.find(t => t.thread_id === threadId);
  // ...
}
```

### Phase 4: Panel Components
**Files to migrate:**
- `sources-panel.tsx` - Right sidebar with sources
- `app-shell.tsx` - Layout wrapper (if using deprecated types)

**Changes:**
```typescript
// BEFORE (deprecated)
import type { SourceCardData } from "@/types/ui";

export function SourcesPanel({ sources }: { sources: SourceCardData[] }) {
  // ...
}

// AFTER (LangGraph SDK)
import { useStreamContext } from "@/providers/Stream";

export function SourcesPanel() {
  const stream = useStreamContext();
  const sources = stream.values.sources ?? []; // From graph state
  const researchBrief = stream.values.research_brief;
  const finalReport = stream.values.final_report;
  // ...
}
```

## New Folder Structure

```
src/components/thread/
├── index.tsx                          # Main thread component (existing)
├── artifact.tsx                       # Artifact handling (existing)
├── messages/
│   ├── ai.tsx                        # AI messages (existing)
│   ├── human.tsx                     # Human messages (existing)
│   ├── research-message.tsx          # MIGRATED: Research-specific message
│   ├── research-report-card.tsx      # MIGRATED: Final report display
│   └── tool-calls.tsx                # Tool calls (existing)
├── sources/
│   ├── source-card.tsx               # MIGRATED: Individual source card
│   ├── sources-panel.tsx             # MIGRATED: Sources sidebar
│   ├── inline-citation-number.tsx    # MIGRATED: Citation badge
│   ├── content-with-inline-citations.tsx  # MIGRATED: Markdown with citations
│   └── report-sources-button.tsx     # MIGRATED: Toggle button
├── history/
│   ├── thread-card.tsx               # MIGRATED: Thread item
│   ├── thread-list.tsx               # MIGRATED: Thread list
│   └── thread-history-panel.tsx      # MIGRATED: History sidebar (merge with existing)
└── shared/
    ├── markdown-text.tsx             # Shared markdown renderer (existing)
    └── syntax-highlighter.tsx        # Code highlighting (existing)
```

## State Access Patterns

### Accessing Graph State
```typescript
import { useStreamContext } from "@/providers/Stream";

function MyComponent() {
  const stream = useStreamContext();
  
  // Access state values from the graph
  const messages = stream.messages;              // Messages
  const sources = stream.values.sources ?? [];   // SourceMetadata[]
  const researchBrief = stream.values.research_brief; // string | null
  const finalReport = stream.values.final_report;     // string | null
  const notes = stream.values.notes ?? [];       // string[]
  
  // Check loading/streaming state
  const isLoading = stream.isLoading;
  const error = stream.error;
  
  // Access UI components from graph (if using react-ui)
  const uiComponents = stream.values.ui ?? [];
  
  return (/* ... */);
}
```

### Deriving Citation Data
```typescript
// Extract citations from message content
function extractCitations(content: string, sources: SourceMetadata[]): Citation[] {
  const citationRegex = /\[(\d+)\]/g;
  const citations: Citation[] = [];
  
  let match;
  while ((match = citationRegex.exec(content)) !== null) {
    const sourceIndex = parseInt(match[1], 10) - 1;
    if (sourceIndex >= 0 && sourceIndex < sources.length) {
      citations.push({
        number: parseInt(match[1], 10),
        source: sources[sourceIndex],
        position: match.index,
      });
    }
  }
  
  return citations;
}
```

## Benefits of Migration

1. **Single Source of Truth** - Graph state is the only state, no duplicate types
2. **Real-time Updates** - Components automatically re-render when state changes
3. **Type Safety** - TypeScript types from SDK are always in sync
4. **Less Code** - No need for custom SSE parsing, type conversions, or state management
5. **Better Streaming** - SDK handles all streaming complexity
6. **Official Patterns** - Following LangGraph 1.0-alpha best practices

## Breaking Changes

### Removed
- `src/types/ui.ts` - All custom types deprecated
- `src/app/(components)/` - Components moved to `src/components/thread/`
- Custom SSE parsing in components
- Type conversion utilities (e.g., `unifiedDocToSourceCard`, `draftToMessage`)

### Added
- Direct access to graph state via `useStreamContext()`
- Derived data patterns for UI-specific transformations
- Organized subfolders in `thread/` for better structure

## Migration Checklist

- [ ] Create new folder structure in `src/components/thread/`
- [ ] Migrate source/citation components
- [ ] Migrate message components
- [ ] Migrate thread management components
- [ ] Migrate panel components
- [ ] Update all imports across the application
- [ ] Test with real LangGraph streaming data
- [ ] Remove deprecated `ui.ts` file
- [ ] Remove old `(components)` folder
- [ ] Update documentation

## References

- **LangGraph SDK Docs**: `documentation/langgraph/09-streaming.md`
- **State Schema**: `src/server/workflows/deep-research/graph/state.ts`
- **Existing Patterns**: `src/components/thread/messages/ai.tsx`
- **Stream Provider**: `src/providers/Stream.tsx`
