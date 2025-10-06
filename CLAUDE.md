# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A research assistant built with Next.js 15 (App Router) and LangGraph that transforms broad prompts into grounded, cited reports. The system supports two operation modes: Auto (immediate execution) and Plan (human-in-the-loop planning).

**Key Technologies:**
- Next.js 15.5 with App Router (React 19)
- LangGraph 1.0-alpha for stateful multi-agent orchestration
- TypeScript with strict type safety
- Biome for formatting/linting (via Ultracite)
- Tailwind CSS 4 with Radix UI components
- Google Gemini models via OpenAI SDK (Gemini 2.5 Pro for agentic, Gemini 2.5 Flash for defined tasks)

## Development Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000

# Code Quality
npm run lint            # Run Biome linting checks
npm run format          # Format code with Biome
npx ultracite check     # Check for issues without fixing
npx ultracite fix       # Auto-fix code quality issues

# Targeted Code Quality (Recommended)
npx ultracite check src/app/(components)/thread-history-panel.tsx  # Check specific file
npx ultracite fix src/app/(components)/thread-history-panel.tsx    # Fix specific file
npx ultracite check src                                                  # Check specific directory

# Production
npm run build           # Build for production (NEVER run with localhost:3000 active)
npm run start           # Start production server
```

## Architecture Overview

### LangGraph Multi-Agent System

The core architecture uses LangGraph's stateful orchestration with checkpointing for memory, HITL (human-in-the-loop), and fault tolerance:

**Parent Graph** ([src/server/graph/index.ts](src/server/graph/index.ts)):
- Singleton pattern with MemorySaver checkpointer (see [06-short-term-memory.md](documentation/langgraph/06-short-term-memory.md))
- Flow: START → plan-gate → planner → approvals → research → factcheck → writer → publish-gate → END
- All invocations require a `thread_id` for thread-level memory
- Subgraphs inherit the parent checkpointer automatically
- **Orchestration Gates** for control flow and quality assurance:
  - **plan-gate** - Decides Auto vs Plan mode based on UI override and cheap signals
  - **approvals** - Pre-action HITL gate for expensive/risky operations
  - **publish-gate** - Pre-publish quality gate with deterministic checks and optional HITL

**Subgraphs** (graphs-as-nodes under [src/server/graph/subgraphs/](src/server/graph/subgraphs/)):
1. **Planner** - Auto path (no HITL) or Plan path (with interrupts)
   - Conditional routing based on `userInputs.modeOverride` and plan-gate evaluation
   - **Auto path**: Selects default plan without user interaction
   - **Plan path**: Uses `interrupt()` for dynamic multi-question HITL flow (see [07-human-in-the-loop.md](documentation/langgraph/07-human-in-the-loop.md))
   - Analyzes prompt completeness, generates 1-4 contextual questions with LLM-generated options
   - Each question has 4 contextual options + "Custom" (5 total), with "All of the above" where appropriate
   - Iterative interrupt/resume cycles until all questions are answered
   - Final plan constructed from collected answers
   - Plan templates and state defined in [planner/state.ts](src/server/graph/subgraphs/planner/state.ts)
2. **Research** - QueryPlan → MetaSearch → Harvest/Normalize → Dedup
3. **Factcheck** - Deterministic claim verification
4. **Writer** - Synthesize → Red-team quality gates

**State Management** ([src/server/graph/state.ts](src/server/graph/state.ts)):
- Shared state keys: `threadId`, `userInputs`, `plan`, `queries`, `searchResults`, `evidence`, `draft`, `issues`
- Gate state extensions: `userInputs.gate`, `userInputs.modeFinal`, `userInputs.approvals[]`, `userInputs.publish`
- Zod schemas for runtime validation with inferred TypeScript types
- Annotation-based reducers for state merging (see [06-short-term-memory.md](documentation/langgraph/06-short-term-memory.md))
- Subgraphs can have their own state files (e.g., [planner/state.ts](src/server/graph/subgraphs/planner/state.ts))

### Next.js App Router Structure

**API Routes** ([src/app/api/](src/app/api/)):
- `POST /api/threads/start` - Start new thread, handle interrupts
- `GET /api/stream/:threadId` - SSE streaming for progress/drafts
- `GET /api/threads/:threadId/state` - Get checkpoint snapshots
- `POST /api/threads/:threadId/resume` - Resume HITL flows with Command
- `PATCH /api/threads/:threadId/mode` - Toggle auto/plan mode

**Pages** ([src/app/](src/app/)):
- `/` - Landing/dashboard
- `/research/new` - New research session
- `/research/:threadId` - Active research thread view

**Client Components** ([src/app/(components)/](src/app/(components)/)):
- ModeSwitch - Toggle between Auto/Plan modes
- InterruptPrompt - Display HITL options and collect responses
- SourcesPanel - Citations and source metadata
- ArtifactsPane - Tables/matrices work surface
- CheckpointTimeline - Time-travel UI
- RunLog - Step-by-step execution log

**UI Components** ([src/components/ui/](src/components/ui/)):
- Radix UI-based components (Accordion, Alert, Avatar, Button, Card, etc.)
- Shadcn/ui pattern with Tailwind CSS styling
- **Note**: `src/components/ui` is excluded from Biome linting (see biome.json)

### Server-Side Structure

**Services** ([src/server/services/](src/server/services/)):
- Search gateway (Tavily + Exa fusion)
- Document harvesting and normalization
- Result deduplication and reranking

**Tools** ([src/server/tools/](src/server/tools/)):
- Tavily search API integration
- Exa semantic search integration

**Utilities** ([src/server/utils/](src/server/utils/)):
- Content hashing
- URL normalization
- Robots.txt compliance

## Key Patterns

### Thread-Based Memory & HITL

All operations use `thread_id` for persistence:
```typescript
// Starting a thread
const result = await graph.invoke(initial, {
  configurable: { thread_id: threadId }
});

// Resuming after interrupt
const out = await graph.invoke(
  new Command({ resume: body.resume }),
  { configurable: { thread_id: threadId } }
);

// Getting state snapshots
const snap = await graph.getState({
  configurable: { thread_id: threadId }
});
```

### Mode Override (Auto vs Plan)

The planner behavior is controlled by multiple factors:
- **UI Override**: The `userInputs.modeOverride` field is respected first if set
- **Plan-gate Evaluation**: When no UI override, evaluates cheap signals to decide:
  - Clarity scoring (IR-style heuristic) for prompt quality
  - Preview coherence check using single Tavily + Exa search
  - Cost guard with coarse token/time estimates → USD conversion
  - Threshold policy: Auto if clarity ≥ τ₁ AND coherence ≥ τ₂ AND cost ≤ budget; else Plan
  - Defaults to Plan-mode on errors for safety
- **Auto Mode**: Planner runs in auto path (no interrupts), selects default plan
- **Plan Mode**: Planner runs HITL via `interrupt()`, generates 1-4 dynamic clarifying questions

The UI ModeSwitch component writes to `/api/threads/:id/mode` endpoint which uses `updateState()` to modify the thread.

### Orchestration Gates

The system includes three parent-graph nodes for control flow and quality assurance:

**Plan-gate** ([src/server/graph/nodes/plan-gate.ts](src/server/graph/nodes/plan-gate.ts)):
- Decides Auto vs Plan mode based on UI override and cheap signals
- Evaluates prompt clarity, preview coherence, and cost estimates
- Writes decision metrics to `userInputs.gate` and final mode to `userInputs.modeFinal`
- Defaults to Plan-mode on errors for safety

**Approvals Gate** ([src/server/graph/nodes/approvals.ts](src/server/graph/nodes/approvals.ts)):
- Pre-action HITL gate before expensive/risky operations
- Triggers on cost/latency thresholds, new domains, sensitive topics
- Uses `interrupt()` with comprehensive summary payload
- Resume options: approve, edit (constraints), or cancel
- Persists decision records with timestamps and policy snapshots

**Publish-gate** ([src/server/graph/nodes/publish-gate.ts](src/server/graph/nodes/publish-gate.ts)):
- Pre-publish quality gate after red-team checks
- Runs deterministic checks first: citations, recency, completeness
- Conditional HITL only if checks fail or policy requires manual review
- Resume options: approve, fix_auto, edit_then_retry, or reject
- Full audit trail with checkpoint history for compliance

All gates use the `interrupt()` + `Command(resume)` pattern with thread-level checkpointing for fault tolerance.

### Server-Sent Events (SSE)

Streaming responses use SSE with proper headers:
```typescript
return new Response(body, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  }
});
```

### Path Aliases

Use `@/*` for imports from src:
```typescript
import { getGraph } from "@/server/graph";
import { ParentState } from "@/server/graph/state";
```

### Naming Conventions

Follow kebab-case for file names as documented in [naming-conventions.md](naming-conventions.md):

**Files:**
```
✅ Good: user-profile.tsx, data-table.tsx, auth-provider.tsx
❌ Bad: UserProfile.tsx, userProfile.tsx, auth_provider.tsx
```

**Components:**
```typescript
// ✅ Good
export default function UserProfile() { }

// ❌ Bad
export default function userProfile() { }
```

**Project Structure:**
- Files: lowercase kebab-case
- Components: PascalCase
- Hooks: camelCase with "use" prefix (use-auth.ts)
- Utilities: kebab-case (api-helpers.ts)

## Code Quality Standards

This project uses **Ultracite** which enforces Biome rules. Configuration is in [biome.json](biome.json). Full rules are documented in [.claude/CLAUDE.md](.claude/CLAUDE.md).

### Be Proactive: Fix Issues When You See Them

**Agents should be reactive and proactive** - when you encounter code quality issues while working on a task, fix them immediately rather than leaving them for later:

**Common issues to fix immediately:**
- **Naming convention violations** - Rename files/components that don't follow kebab-case/PascalCase
- **Magic numbers** - Extract hardcoded numbers to named constants
- **Lint errors** - Fix any Biome violations you encounter
- **Type safety issues** - Replace `any` types with proper TypeScript types
- **Next.js violations** - Replace `<img>` with `<Image>`, `<head>` with Metadata API
- **Accessibility issues** - Add missing `type` attributes to buttons, add keyboard handlers
- **Performance issues** - Replace `forEach` with `for...of`, move regex to top level
- **Import organization** - Clean up unused imports and organize them properly

**Example proactive fixes:**
```typescript
// If you see this while working on a feature:
if (results.length > 10) { // Magic number!
  // ... existing code
}

// Fix it immediately by extracting the constant:
const MAX_RESULTS_THRESHOLD = 10; // Add at top of file
if (results.length > MAX_RESULTS_THRESHOLD) {
  // ... existing code
}
```

```typescript
// If you encounter a misnamed component:
export default function userProfile() { } // Wrong casing

// Fix it immediately:
export default function UserProfile() { } // Proper PascalCase
// And rename the file from user-profile.tsx to UserProfile.tsx
```

**Why this matters:**
- Prevents technical debt accumulation
- Maintains code quality standards across the entire codebase
- Reduces the need for dedicated "cleanup" tasks
- Ensures consistent code quality regardless of who works on the code
- Makes code reviews more focused on logic rather than style issues

**Biome Configuration Highlights:**
- Extends: `ultracite`
- Ignored paths: `node_modules`, `.next`, `dist`, `build`, `src/components/ui`
- VCS: Git integration enabled
- Formatter: 2-space indentation
- Linter: Recommended rules + Next.js/React domains
- Auto-organize imports enabled

**Key Requirements:**

**Accessibility:**
- Always include `type` attribute on buttons
- No `aria-hidden="true"` on focusable elements
- Pair `onClick` with keyboard handlers

**React/Next.js:**
- Don't use `<img>` elements (use Next.js Image)
- Don't use `<head>` elements (use Next.js Metadata)
- All React hooks must be at component top level
- Include `key` props in iterators

**TypeScript:**
- No `any` types (use `Record<string, unknown>` or `z.record(z.unknown())` for flexible data)
- Use `export type` for types
- Use `import type` for type imports
- No TypeScript enums (use string unions or objects)
- Follow LangGraph patterns from [documentation/langgraph/](documentation/langgraph/) for type safety
  - See [06-short-term-memory.md](documentation/langgraph/06-short-term-memory.md) for state management patterns
  - See [07-human-in-the-loop.md](documentation/langgraph/07-human-in-the-loop.md) for interrupt/resume patterns
  - See [11-multi-agent-systems.md](documentation/langgraph/11-multi-agent-systems.md) for subgraph orchestration

**Style:**
- Use `===` and `!==` (not `==` or `!=`)
- Use arrow functions over function expressions
- Use template literals over string concatenation
- No unused variables or imports
- No `console` statements (use biome-ignore if needed for development)
- **No magic numbers** - Extract all numeric literals to named constants with meaningful names
- **Use `for...of` instead of `forEach`** - Required by Biome for performance
- **Use `Number.isNaN()` instead of `isNaN()`** - `isNaN` is unsafe due to type coercion
- **Move regex literals to top level** - Define regex patterns as constants for performance
- **Avoid `any` types** - Always use proper TypeScript types from state schemas

**Biome Ignore Comments:**
When you need to bypass Biome rules temporarily (e.g., for development console.logs), use:
```typescript
/** biome-ignore-all lint/suspicious/noConsole: <For development> */
console.log("Debug output");

// Or for single line:
// biome-ignore lint/suspicious/noConsole: debugging
console.log("Debug");
```

### Targeted Linting with Ultracite

For efficient development, it's recommended to run Ultracite checks on specific files or directories rather than the entire codebase:

```bash
# Check a specific file
npx ultracite check src/app/(components)/thread-history-panel.tsx

# Fix issues in a specific file
npx ultracite fix src/app/(components)/thread-history-panel.tsx

# Check an entire directory
npx ultracite check src

# Check multiple specific files
npx ultracite check src/app/(components)/thread-history-panel.tsx src/app/(components)/thread-list.tsx
```

**Benefits of targeted linting:**
- Faster feedback loop when working on specific components
- Reduced cognitive load by focusing on relevant files
- Easier to fix issues incrementally
- Better integration with iterative development workflows

**Best practices:**
- Run `npx ultracite check <file>` before committing changes to a specific file
- Use `npx ultracite fix <file>` to automatically fix issues in the file you're working on
- Run full project checks (`npx ultracite check`) before creating pull requests

## Common Linting Issues and Solutions

### 1. Magic Numbers
**Issue**: Hard-coded numeric literals in code
**Solution**: Extract to meaningful constants

```typescript
// ❌ Bad
if (draft.citations.length < 3) {
  issues.push(`Low confidence score: ${draft.confidence < 0.5}`);
}
const density = (count / words) * 1000;

// ✅ Good
const MIN_CITATIONS_REQUIRED = 3;
const MIN_CONFIDENCE_THRESHOLD = 0.5;
const WORDS_PER_THOUSAND = 1000;

if (draft.citations.length < MIN_CITATIONS_REQUIRED) {
  issues.push(`Low confidence score: ${draft.confidence < MIN_CONFIDENCE_THRESHOLD}`);
}
const density = (count / words) * WORDS_PER_THOUSAND;
```

### 2. forEach Loops
**Issue**: Using `forEach` instead of `for...of`
**Solution**: Use `for...of` loops

```typescript
// ❌ Bad
items.forEach((item) => {
  console.log(item);
});

// ✅ Good
for (const item of items) {
  console.log(item);
}
```

### 3. Regex Performance
**Issue**: Inline regex literals in functions
**Solution**: Move to top-level constants

```typescript
// ❌ Bad
function processText(text: string) {
  const words = text.split(/\s+/);
  const hasPlaceholder = /todo|placeholder/gi.test(text);
}

// ✅ Good
const WORD_SPLIT_REGEX = /\s+/;
const PLACEHOLDER_REGEX = /todo|placeholder/gi;

function processText(text: string) {
  const words = text.split(WORD_SPLIT_REGEX);
  const hasPlaceholder = PLACEHOLDER_REGEX.test(text);
}
```

### 4. Type Safety (any types)
**Issue**: Using `any` instead of proper types
**Solution**: Import and use defined types from state schemas or use LangGraph patterns

```typescript
// ❌ Bad
function processData(draft: { text: string; citations: any[] }, evidence: any[]) {
  // ...
}

// ✅ Good - Use defined types from state schemas
import type { Draft, Evidence } from "../../../state";

function processData(draft: Draft, evidence: Evidence[]) {
  // ...
}

// ✅ Good - Use LangGraph patterns for flexible data
function handleUnknownData(data: Record<string, unknown>): void {
  // Process flexible data structures
}

// ✅ Good - Use Zod schemas for validation
import { z } from "zod";

const flexibleSchema = z.record(z.unknown());
type FlexibleData = z.infer<typeof flexibleSchema>;

function processFlexibleData(data: FlexibleData): void {
  // Process validated flexible data
}
```

**When `any` is Acceptable (with biome-ignore):**
Only use `any` when absolutely necessary and always document why:

```typescript
// biome-ignore lint/suspicious/noAnyType: External API response with unknown structure
async function fetchExternalData(): Promise<any> {
  const response = await fetch('/api/external');
  return response.json(); // Structure unknown at compile time
}

// biome-ignore lint/suspicious/noAnyType: Legacy integration with untyped library
function legacyLibraryIntegration(data: any): void {
  // Working with untyped third-party library
}
```

### 5. isNaN vs Number.isNaN
**Issue**: Using global `isNaN` which does type coercion
**Solution**: Use `Number.isNaN()`

```typescript
// ❌ Bad
if (!isNaN(score) && score >= 0) {
  // ...
}

// ✅ Good
if (!Number.isNaN(score) && score >= 0) {
  // ...
}
```

### 6. Excessive Cognitive Complexity
**Issue**: Functions with high complexity (>15)
**Solution**: Extract helper functions or use targeted biome-ignore

```typescript
// ❌ Bad - Complex function
function complexFunction(data: any): any {
  // 20+ lines of complex logic
}

// ✅ Good - Split into smaller functions
function validateData(data: any): string[] {
  // Validation logic
}

function processData(data: any): any {
  // Processing logic
}

function complexFunction(data: any): any {
  const issues = validateData(data);
  const processed = processData(data);
  return { issues, processed };
}

// Or if complexity is unavoidable:
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex validation logic required
function complexValidation(data: any): any {
  // Complex logic that can't be easily split
}
```

## LangChain 1.0-alpha Environment

This project uses **LangChain 1.0-alpha** (next) packages:

```bash
# Core LangChain packages
@langchain/langgraph@next     # LangGraph for multi-agent orchestration
@langchain/core@next          # Core abstractions
langchain@next                # Main LangChain package

# Model providers
@langchain/openai@next        # OpenAI integration (Anthropic & OpenAI only supported)
```

**Model Usage Guidelines:**
- **Gemini 2.5 Pro** - Use for agentic tasks (planning, reasoning, decision-making)
- **Gemini 2.5 Flash** - Use for well-defined tasks (formatting, extraction, simple transforms)
- Uses OpenAI SDK compatibility layer (see [google-openai-compatibility.md](google-openai-compatibility.md))

**Documentation:**
- Updated LangChain docs are in [documentation/langgraph/](documentation/langgraph/)
- Follow 1.0-alpha patterns, not legacy documentation

## Environment Variables

Required environment variables (add to `.env.local`):

```bash
# LLM Provider - Using Gemini via OpenAI SDK compatibility
GEMINI_API_KEY=...       # Required for Gemini 2.5 Pro/Flash
OPENAI_API_KEY=...       # Optional, keeping for potential fallback

# Search APIs
TAVILY_API_KEY=...
EXA_API_KEY=...

# Optional
REDIS_URL=...            # For production caching
NODE_ENV=development
```

**Note:** Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

**Setup:**
- Copy `.env.example` to `.env.local` and fill in values
- Never commit `.env.local` to version control

## Important Files

**Project Documentation:**
- [brief.md](brief.md) - Product requirements and system design
- [plan.md](plan.md) - Technical architecture with Mermaid diagrams
- [implementation-plan.md](implementation-plan.md) - Phase-by-phase implementation checklist (**UPDATE THIS**)
- [naming-conventions.md](naming-conventions.md) - File and component naming standards
- [documentation/](documentation/) - LangGraph concepts and examples

**Core Configuration:**
- [src/server/graph/state.ts](src/server/graph/state.ts) - Shared state schema (single source of truth)
- [src/server/graph/index.ts](src/server/graph/index.ts) - Parent graph orchestration
- [biome.json](biome.json) - Biome/Ultracite configuration
- [tsconfig.json](tsconfig.json) - TypeScript configuration with path aliases
- [.claude/CLAUDE.md](.claude/CLAUDE.md) - Full Ultracite/Biome rules reference

**Custom Hooks** ([src/lib/hooks/](src/lib/hooks/)):
- `useThread.ts` - Thread creation and management
- `useResume.ts` - HITL resume operations
- `use-mobile.ts` - Responsive design utilities

## Implementation Status

**Phase 1 (Runtime Backbone)**: ✅ Complete
- Parent graph with checkpointer
- State management with Zod schemas
- API routes for start/state/resume/mode

**Phase 2 (Planner)**: ✅ Complete
- Auto and Plan HITL paths with conditional routing
- Mode override handling with UI switch integration
- Dynamic multi-question flow in Plan mode:
  - Prompt analysis for missing aspects (scope, timeframe, depth, use case)
  - LLM-generated contextual questions with 4 options + "Custom" each
  - Iterative interrupt/resume cycles until all questions answered
  - Final plan construction from collected answers
- Template selection and constraints
- Plan state management with QuestionAnswer persistence

**Phase 2.5 (Orchestration Gates)**: ✅ Complete
- plan-gate: Planner Mode Decider with UI override and signal-based evaluation
- approvals: Pre-Action HITL Gate for expensive/risky operations
- publish-gate: Pre-Publish Release Gate with deterministic checks
- Full interrupt/resume semantics with thread-level checkpointing

**Phase 3 (Research)**: ✅ Complete
- QueryPlan expands goal with domain scoping
- Tavily and Exa parallel search with normalization and deduplication
- Harvest/Normalize with respectful timeouts and robots compliance
- Content hashing, chunking, and light reranking (recency/authority)

**Phase 4 (Factcheck & Writer)**: ✅ Complete
- Deterministic fact-checks for claim verification
- Writer produces sections with inline citations
- Red-team quality gates for groundedness and compliance

**Phase 5 (API & Streaming)**: ✅ Complete
- All route handlers implemented (start, state, resume, mode)
- SSE streaming endpoint with multi-mode support
- Proper error handling and graceful stream termination

**Phase 6 (UI)**: 🚧 Partial (core components only)
**Phase 7 (Ops)**: ⏳ Not Started
**Phase 8 (Tests)**: ⏳ Not Started

## Task Completion Protocol

**When you complete a task, subtask, or phase:**

1. **Update the checklist** in [implementation-plan.md](implementation-plan.md):
   - Change `[ ]` to `[x]` for completed items
   - Add implementation notes with file paths
   - Update status emojis (⏳ → 🚧 → ✅)

2. **Update the "Signed by" section** in [implementation-plan.md](implementation-plan.md):
   - Fill in Owner, Signature (✅), Date (YYYY-MM-DD)
   - Add relevant notes about implementation details

3. **Example update:**
```markdown
### Phase 3 — Research Subgraph ✅ COMPLETE

* [x] QueryPlan expands goal (+ domain scoping).
  - ✅ Implemented in [src/server/graph/subgraphs/research/nodes/queryPlan.ts](...)
* [x] **Tavily /search** and **Exa /search** in parallel; normalize; dedupe.
  - ✅ [metasearch node](src/server/graph/subgraphs/research/nodes/metasearch.ts)

## Signed by…
| **Research (Query→Search→Harvest)** | Claude Code | ✅ | 2025-01-04 | Tavily + Exa fusion; dedupe & rerank. |
```

## Common Pitfalls

1. **Never run `npm run build` with localhost:3000 active** - Will cause build failures
2. **Always use `thread_id` in graph invocations** - Required for checkpointing
3. **Don't bypass Ultracite checks** - Code quality is enforced
4. **Server-only code must stay in `src/server/`** - Client can't import server code
5. **SSE routes need `export const runtime = "nodejs"`** - Edge runtime doesn't support streaming properly
6. **Update implementation-plan.md after completing tasks** - Keep progress tracking current
7. **Follow naming conventions** - Use kebab-case for files, PascalCase for components
8. **UI components in src/components/ui are linter-exempt** - Don't manually edit generated shadcn components
9. **Subgraph state files are optional** - Only create if subgraph needs isolated types (like planner/state.ts)
10. **Use LangChain 1.0-alpha (@next) packages** - Don't reference legacy documentation
11. **Choose appropriate models** - Gemini 2.5 Pro for agentic tasks, Gemini 2.5 Flash for defined tasks
12. **Using Gemini via OpenAI SDK** - Use `@langchain/openai@next` with Gemini base URL for compatibility
13. **Check internal docs first** - Always reference [documentation/langgraph/](documentation/langgraph/) before searching externally
14. **Be proactive about code quality** - Fix issues immediately when you encounter them (see [Be Proactive section](#be-proactive-fix-issues-when-you-see-them))

## References

**LangChain 1.0-alpha Documentation:**
- [documentation/langgraph/](documentation/langgraph/) - Local LangGraph docs (1.0-alpha compatible)
- Use local docs first - they match the @next packages used in this project

**External Documentation:**
- [Next.js App Router](https://nextjs.org/docs/app) - Route handlers and SSE
- [Tavily API](https://docs.tavily.com/documentation/api-reference/introduction) - Search endpoint
- [Exa API](https://docs.exa.ai/reference/search) - Semantic search
- [Google AI Gemini API](https://ai.google.dev/gemini-api/docs) - Gemini 2.5 Pro and Flash reference
- [Gemini OpenAI Compatibility](google-openai-compatibility.md) - Using Gemini with OpenAI SDK

**Important:**
- **Always reference local [documentation/langgraph/](documentation/langgraph/) for LangGraph patterns**
- Legacy LangChain docs may not apply to 1.0-alpha (@next) packages
