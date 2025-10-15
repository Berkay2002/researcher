import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { UnifiedSearchDoc } from "../../state";

/**
 * Per-round finding with queries, results, reasoning, and gaps
 *
 * Following LangGraph 1.0-alpha patterns for structured state management
 */
export const FindingSchema = z.object({
  round: z.number(),
  queries: z.array(z.string()),
  results: z.array(z.any()), // UnifiedSearchDoc[] - using any() for flexibility
  reasoning: z.string(),
  gaps: z.array(z.string()),
  metadata: z.object({
    queriesGenerated: z.number(),
    sourcesFound: z.number(),
    providersUsed: z.array(z.enum(["tavily", "exa"])),
    startedAt: z.string(),
    completedAt: z.string(),
  }),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Iterative Research State Annotation
 *
 * Uses LangGraph's Annotation API for state management with proper reducers.
 * This state tracks the 3-round iterative research process.
 *
 * Pattern from: documentation/langgraph/04-persistence.md
 * - Annotation.Root for creating state schema
 * - Custom reducers for array accumulation
 * - Default values for initialization
 */
export const IterativeResearchStateAnnotation = Annotation.Root({
  /**
   * Findings from each research round
   * Reducer: Accumulates findings from all rounds
   */
  findings: Annotation<Finding[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  /**
   * Current round number (1, 2, 3, or 4 for synthesis)
   * Reducer: Always use latest value
   */
  currentRound: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 1,
  }),

  /**
   * All discovered sources across all rounds
   * Reducer: Accumulates sources from all rounds
   */
  allSources: Annotation<UnifiedSearchDoc[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  /**
   * Research completion flag
   * Reducer: Always use latest value
   */
  researchComplete: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),

  /**
   * Current queries being executed (set by reasoning nodes)
   * Reducer: Always use latest value
   */
  currentQueries: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  /**
   * Research goal (passed from parent state)
   * Reducer: Always use latest value
   */
  goal: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  /**
   * Constraints from plan (passed from parent state)
   * Reducer: Always use latest value
   */
  constraints: Annotation<Record<string, unknown>>({
    reducer: (x, y) => y ?? x,
    default: () => ({}),
  }),
});

/**
 * TypeScript type for the iterative research state
 */
export type IterativeResearchState =
  typeof IterativeResearchStateAnnotation.State;
