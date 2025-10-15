import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
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
 * Research plan with constraints and execution guidance
 *
 * Note: The `dag` field is deprecated and no longer used by the iterative research system.
 * It is kept optional for backward compatibility with UI components.
 * The research process follows a fixed 3-round iterative pattern:
 * Round 1 (Broad Orientation) → Round 2 (Deep Dive) → Round 3 (Validation) → Synthesis
 */
export const PlanSchema = z.object({
  goal: z.string(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  deliverable: z.string(),
  dag: z.array(z.string()).optional(), // Deprecated: kept for UI compatibility only
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
  // URL resolution fields for post-fetch deduplication
  resolvedUrl: z.string().nullable().optional(), // URL after redirects
  canonicalUrl: z.string().nullable().optional(), // URL from canonical link tag
  normalizedKey: z.string().nullable().optional(), // Dedupe key for post-fetch collapse
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
  // URL resolution fields for post-fetch deduplication
  resolvedUrl: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
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
 * Claim schema for structured factual assertions with citations
 * Used for academic comparison between ReAct and Orchestrator-Worker patterns
 */
export const ClaimSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      snippet: z.string(),
      score: z.number().optional(),
    })
  ),
  confidence: z.number().min(0).max(1),
});

/**
 * Quality issue with type classification for intelligent routing
 */
export const QualityIssueSchema = z.object({
  type: z.enum(["needs_research", "needs_revision"]),
  description: z.string(),
  severity: z.enum(["error", "warning"]).default("error"),
});

// ============================================================================
// COMMENTED OUT: Orchestration Decision (Parallel Mode Not Used)
// ============================================================================
// The following schema was used for intelligent routing between iterative and parallel modes.
// Since we now use ONLY iterative research, this is no longer needed.
// Preserved for future restoration if parallel mode is needed.

/*
export const OrchestrationDecisionSchema = z.object({
  mode: z.enum(["iterative", "parallel"]),
  reasoning: z.string(),
  aspects: z.array(z.string()),
  hasIntersection: z.boolean(),
  confidence: z.number().min(0).max(1),
});
*/

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
export type Chunk = z.infer<typeof ChunkSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type QualityIssue = z.infer<typeof QualityIssueSchema>;
// export type OrchestrationDecision = z.infer<typeof OrchestrationDecisionSchema>; // Commented out - not using parallel mode
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
  // biome-ignore lint/suspicious/noExplicitAny: Tasks are dynamically added by orchestrator
  tasks?: any[];
};

// ============================================================================
// LangGraph 1.0-alpha State Annotation
// ============================================================================

/**
 * Parent state annotation following LangGraph 1.0-alpha patterns
 *
 * This state is shared across all subgraphs and nodes in the research pipeline.
 * Uses proper reducer patterns for state merging and supports Command-based updates.
 *
 * Extends MessagesAnnotation to provide proper LangSmith Chat support.
 */
export const ParentStateAnnotation = Annotation.Root({
  // Extend MessagesAnnotation for LangSmith Chat compatibility
  // This provides the standard 'messages' channel that LangSmith expects
  ...MessagesAnnotation.spec,

  // Thread identifier (required on all invocations)
  // This enables checkpointing and persistence across interrupts
  threadId: Annotation<string>({
    reducer: (_, next) => next,
  }),

  // User inputs and configuration
  // Merges user inputs with previous state to preserve partial updates
  userInputs: Annotation<UserInputs>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ goal: "" }),
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

  // ============================================================================
  // COMMENTED OUT: Orchestration Decision (Parallel Mode Not Used)
  // ============================================================================
  // This field was used for routing between iterative and parallel research modes.
  // Since we now use ONLY iterative research, this field is not needed.
  /*
  orchestrationDecision: Annotation<OrchestrationDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  */

  // Generated search queries
  // Accumulates queries from planning phases
  queries: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Research state for two-pass search architecture
  // Replaces entire research state when updated
  research: Annotation<ResearchState | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Worker results from parallel research tasks (Orchestrator-Worker pattern)
  // Accumulates results from all workers executing in parallel
  workerResults: Annotation<
    Array<{
      taskId: string;
      aspect: string;
      documents: UnifiedSearchDoc[];
      summary: string;
      confidence: number;
      queriesExecuted: number;
      documentsFound: number;
      documentsSelected: number;
    }>
  >({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
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

  // Structured claims extracted from research for academic comparison
  // Accumulates claims from different sources (synthesizer, workers, etc.)
  claims: Annotation<Claim[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Issues and errors with type classification (kept for backward compatibility with redteam file)
  // Replaces issues (not accumulates) to enable clean evaluation
  issues: Annotation<QualityIssue[]>({
    reducer: (_, next) => next,
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
  step: "plan" | "research" | "write" | "publish"
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
  // Step-specific readiness checks
  switch (currentStep) {
    case "plan":
      return Boolean(state.userInputs.goal);
    case "research":
      return Boolean(state.plan && state.queries.length > 0);
    case "write":
      return Boolean(state.plan && state.evidence.length > 0);
    case "publish":
      return Boolean(state.draft);
    default:
      return true;
  }
};
