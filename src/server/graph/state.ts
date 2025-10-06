import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { PromptAnalysis } from "./subgraphs/planner/state";

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Gate evaluation metrics for plan mode decisions
 */
export const GateSchema = z.object({
  clarity: z.number().min(0).max(1),
  coherence: z.number().min(0).max(1),
  usd: z.number().min(0),
  auto: z.boolean(),
});

/**
 * Human approval records for audit trail
 */
export const ApprovalSchema = z.object({
  timestamp: z.string(),
  signer: z.string(),
  step: z.string(),
  decision: z.enum(["approve", "edit", "cancel"]),
  policySnapshot: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

/**
 * Publication approval metadata
 */
export const PublishSchema = z.object({
  approved: z.boolean(),
  timestamp: z.string().optional(),
  signer: z.string().optional(),
  policySnapshot: z.record(z.string(), z.unknown()).optional(),
  checkpointId: z.string().optional(),
});

// ============================================================================
// User Input Types
// ============================================================================

/**
 * Dynamic question for planner Q&A flow
 */
export const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })
  ),
});

/**
 * User's answer to a planner question
 */
export const QuestionAnswerSchema = z.object({
  questionId: z.string(),
  selectedOption: z.string().optional(),
  customAnswer: z.string().optional(),
});

/**
 * User-provided inputs and configuration
 */
export const UserInputsSchema = z.object({
  goal: z.string(),
  modeOverride: z.enum(["auto", "plan"]).nullable().optional(),
  gate: GateSchema.optional(),
  modeFinal: z.enum(["auto", "plan"]).optional(),
  approvals: z.array(ApprovalSchema).optional(),
  publish: PublishSchema.optional(),
  plannerAnswers: z.array(QuestionAnswerSchema).optional(),
});

// ============================================================================
// Research Execution Types
// ============================================================================

/**
 * Research plan with constraints and execution graph
 */
export const PlanSchema = z.object({
  goal: z.string(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  deliverable: z.string(),
  dag: z.array(z.string()),
});

/**
 * Provider-agnostic canonical record for two-pass search
 */
export const UnifiedSearchDocSchema = z.object({
  id: z.string(),
  provider: z.enum(["tavily", "exa"]),
  query: z.string(),
  url: z.string(),
  hostname: z.string(),
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(), // snippet / highlights joined
  content: z.string().nullable().optional(), // filled only after enrichment
  highlights: z.array(z.string()).optional(),
  author: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(), // ISO
  providerScore: z.number().nullable().optional(),
  score: z.number().nullable().optional(), // normalized 0–1 after batch norm
  favicon: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
  rank: z.number().optional(),
  fetchedAt: z.string(),
  sourceMeta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Search result from external APIs (legacy, for backward compatibility)
 */
export const SearchResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
  source: z.enum(["tavily", "exa"]),
});

/**
 * Content chunk for processing
 */
export const ChunkSchema = z.object({
  content: z.string(),
  chunkIndex: z.number(),
});

/**
  Processed evidence with content hashes
  */
export const EvidenceSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  contentHash: z.string(),
  chunks: z.array(ChunkSchema),
  source: z.enum(["tavily", "exa"]),
});

/**
 * Citation reference in generated content
 */
export const CitationSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  excerpt: z.string(),
});

/**
 * Generated research draft with confidence scoring
 */
export const DraftSchema = z.object({
  text: z.string(),
  citations: z.array(CitationSchema),
  confidence: z.number().min(0).max(1),
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

export type Gate = z.infer<typeof GateSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type Publish = z.infer<typeof PublishSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;
export type UserInputs = z.infer<typeof UserInputsSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type UnifiedSearchDoc = z.infer<typeof UnifiedSearchDocSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Draft = z.infer<typeof DraftSchema>;

// ============================================================================
// Research State for Two-Pass Search
// ============================================================================

/**
 * Research state for the two-pass search architecture
 */
export const ResearchStateSchema = z.object({
  // Phase A (discovery)
  queries: z.array(z.string()).optional(),
  discovery: z.array(UnifiedSearchDocSchema).optional(),
  // Phase B (reason/curate)
  selected: z.array(z.string()).optional(), // array of doc ids (chosen for enrichment)
  rationale: z.string().optional(), // why these were chosen (LLM string)
  // Phase C (enrichment)
  enriched: z.array(UnifiedSearchDocSchema).optional(), // same docs but with `content` hydrated
  // Phase D (final)
  final: z.array(UnifiedSearchDocSchema).optional(), // dedup + authority/recency re-rank
});

export type ResearchState = z.infer<typeof ResearchStateSchema>;

// ============================================================================
// Planning Session Types
// ============================================================================

/**
 * Cached planning session for reusing analysis and questions
 */
export type PlanningSession = {
  analysis?: PromptAnalysis;
  questions?: Question[];
  answers?: QuestionAnswer[];
};

// ============================================================================
// LangGraph 1.0-alpha State Annotation
// ============================================================================

/**
 * Parent state annotation following LangGraph 1.0-alpha patterns
 *
 * This state is shared across all subgraphs and nodes in the research pipeline.
 * Uses proper reducer patterns for state merging and supports Command-based updates.
 */
export const ParentStateAnnotation = Annotation.Root({
  // Thread identifier (required on all invocations)
  // This enables checkpointing and persistence across interrupts
  threadId: Annotation<string>({
    reducer: (_, next) => next,
  }),

  // User inputs and configuration
  // Merges user inputs with previous state to preserve partial updates
  userInputs: Annotation<UserInputs>({
    reducer: (prev, next) => ({ ...prev, ...next }),
  }),

  // Planned execution strategy
  // Replaces entire plan when updated (no merging)
  plan: Annotation<Plan | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Persistent planner cache
  // Merges planning session data to preserve analysis and questions
  planning: Annotation<PlanningSession | null>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => null,
  }),

  // Generated search queries
  // Accumulates queries from planning phases
  queries: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Pre-harvest search results (links only)
  // Accumulates raw search results before processing
  searchResults: Annotation<SearchResult[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Research state for two-pass search architecture
  // Replaces entire research state when updated
  research: Annotation<ResearchState | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Processed evidence with content (legacy, for backward compatibility)
  // Accumulates processed documents after harvesting
  evidence: Annotation<Evidence[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Generated research draft
  // Replaces entire draft when updated
  draft: Annotation<Draft | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Issues and errors
  // Accumulates issues from validation and quality gates
  issues: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),
});

/**
 * Parent state type inferred from the annotation
 * This is the primary type used throughout the research graph
 */
export type ParentState = typeof ParentStateAnnotation.State;

// ============================================================================
// Runtime Context Schema (for LangGraph 1.0-alpha runtime support)
// ============================================================================

/**
 * Runtime context configuration for research sessions
 * This follows LangGraph 1.0-alpha patterns for runtime data
 */
export const RuntimeContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export type RuntimeContext = z.infer<typeof RuntimeContextSchema>;

// ============================================================================
// Command Update Types (for structured state updates)
// ============================================================================

/**
 * Plan update command payload
 */
export type PlanUpdateCommand = {
  plan: Plan;
  metadata?: Record<string, unknown>;
};

/**
 * Draft update command payload
 */
export type DraftUpdateCommand = {
  draft: Draft;
  metadata?: Record<string, unknown>;
};

/**
 * Evidence update command payload
 */
export type EvidenceUpdateCommand = {
  evidence: Evidence[];
  replace?: boolean; // Whether to replace or append
  metadata?: Record<string, unknown>;
};

/**
 * Issues update command payload
 */
export type IssuesUpdateCommand = {
  issues: string[];
  replace?: boolean; // Whether to replace or append
  metadata?: Record<string, unknown>;
};

// ============================================================================
// State Validation Helpers
// ============================================================================

/**
 * Validate that a state has the minimum required fields for a given step
 */
export const validateStateForStep = (
  state: ParentState,
  step: "plan" | "research" | "factcheck" | "write" | "publish"
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <It is okay>
): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];

  switch (step) {
    case "plan": {
      if (!state.userInputs.goal) {
        missing.push("userInputs.goal");
      }
      break;
    }
    case "research": {
      if (!state.plan) {
        missing.push("plan");
      }
      if (!state.queries.length) {
        missing.push("queries");
      }
      break;
    }
    case "factcheck": {
      if (!state.draft) {
        missing.push("draft");
      }
      if (!state.evidence.length) {
        missing.push("evidence");
      }
      break;
    }
    case "write": {
      if (!state.plan) {
        missing.push("plan");
      }
      if (!state.evidence.length) {
        missing.push("evidence");
      }
      break;
    }
    case "publish": {
      if (!state.draft) {
        missing.push("draft");
      }
      break;
    }
    default: {
      // Handle unexpected step values
      missing.push("invalid_step");
      break;
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Check if state is ready for the next step
 */
export const isReadyForNextStep = (
  state: ParentState,
  currentStep: string
): boolean => {
  // Check for blocking issues
  if (state.issues.length > 0) {
    return false;
  }

  // Step-specific readiness checks
  switch (currentStep) {
    case "plan":
      return Boolean(state.userInputs.goal);
    case "research":
      return Boolean(state.plan && state.queries.length > 0);
    case "factcheck":
      return Boolean(state.draft && state.evidence.length > 0);
    case "write":
      return Boolean(state.plan && state.evidence.length > 0);
    case "publish":
      return Boolean(state.draft);
    default:
      return true;
  }
};
