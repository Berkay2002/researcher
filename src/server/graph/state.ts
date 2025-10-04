import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const GateSchema = z.object({
  clarity: z.number().min(0).max(1),
  coherence: z.number().min(0).max(1),
  usd: z.number().min(0),
  auto: z.boolean(),
});

export const UserInputsSchema = z.object({
  goal: z.string(),
  modeOverride: z.enum(["auto", "plan"]).nullable().optional(),
  gate: GateSchema.optional(),
  plannerAnswers: z.record(z.unknown()).optional(),
});

export const PlanSchema = z.object({
  goal: z.string(),
  constraints: z.record(z.unknown()).optional(),
  deliverable: z.string(),
  dag: z.array(z.string()),
});

export const SearchResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
  source: z.enum(["tavily", "exa"]),
});

export const ChunkSchema = z.object({
  content: z.string(),
  chunkIndex: z.number(),
});

export const EvidenceSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  contentHash: z.string(),
  chunks: z.array(ChunkSchema),
  source: z.enum(["tavily", "exa"]),
});

export const CitationSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  excerpt: z.string(),
});

export const DraftSchema = z.object({
  text: z.string(),
  citations: z.array(CitationSchema),
  confidence: z.number().min(0).max(1),
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

export type Gate = z.infer<typeof GateSchema>;
export type UserInputs = z.infer<typeof UserInputsSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Draft = z.infer<typeof DraftSchema>;

// ============================================================================
// Parent State Annotation (LangGraph State)
// ============================================================================

export const ParentStateAnnotation = Annotation.Root({
  // Thread identifier (required on all invocations)
  threadId: Annotation<string>({
    reducer: (_, next) => next,
  }),

  // User inputs: goal, mode override, gate metrics, planner answers
  userInputs: Annotation<UserInputs>({
    reducer: (prev, next) => ({ ...prev, ...next }),
  }),

  // Planned execution strategy (deliverable, DAG, constraints)
  plan: Annotation<Plan | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Search queries generated from the goal
  queries: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Pre-harvest search results (links only)
  searchResults: Annotation<SearchResult[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Post-harvest normalized documents with content hashes and chunks
  evidence: Annotation<Evidence[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Generated draft with inline citations
  draft: Annotation<Draft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Issues flagged by fact-check or red-team gates
  issues: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),
});

export type ParentState = typeof ParentStateAnnotation.State;
