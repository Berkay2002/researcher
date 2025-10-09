/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { UnifiedSearchDoc } from "../../state";

// ============================================================================
// Research Task Schema
// ============================================================================

/**
 * Research task assignment for a worker
 * Each task represents a focused aspect of the research goal
 */
export const ResearchTaskSchema = z.object({
  id: z.string().describe("Unique task identifier"),
  aspect: z.string().describe("Research aspect or topic area"),
  queries: z
    .array(z.string())
    .describe("Search queries for this research aspect"),
  priority: z
    .number()
    .min(0)
    .max(1)
    .describe("Priority score for this task (0-1)"),
});

export type ResearchTask = z.infer<typeof ResearchTaskSchema>;

/**
 * Task decomposition output from orchestrator
 */
export const TaskDecompositionSchema = z.object({
  tasks: z
    .array(ResearchTaskSchema)
    .describe("List of research tasks to execute in parallel"),
  reasoning: z
    .string()
    .describe("Explanation of task decomposition strategy"),
});

export type TaskDecomposition = z.infer<typeof TaskDecompositionSchema>;

// ============================================================================
// Worker Result Schema
// ============================================================================

/**
 * Result from a single research worker
 */
export const WorkerResultSchema = z.object({
  taskId: z.string().describe("Task ID this result corresponds to"),
  aspect: z.string().describe("Research aspect covered"),
  documents: z
    .array(z.any())
    .describe("Discovered and assessed documents"),
  summary: z.string().describe("Brief summary of findings"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in result quality (0-1)"),
  queriesExecuted: z.number().describe("Number of queries executed"),
  documentsFound: z.number().describe("Total documents found"),
  documentsSelected: z.number().describe("Documents selected for enrichment"),
});

export type WorkerResult = z.infer<typeof WorkerResultSchema>;

// ============================================================================
// Worker State Annotation (LangGraph 1.0-alpha)
// ============================================================================

/**
 * Worker state annotation for individual research tasks
 *
 * Each worker receives a task and executes it independently:
 * 1. Execute search queries for the assigned aspect
 * 2. Assess and select best candidates
 * 3. Harvest full content for selected documents
 * 4. Return results to shared state key
 *
 * Following the Send API pattern from documentation:
 * - Worker has its own state with task assignment
 * - Results written to shared state key (workerResults)
 * - Parent graph can access all worker outputs for synthesis
 */
export const WorkerStateAnnotation = Annotation.Root({
  // Task assignment (input from orchestrator via Send)
  task: Annotation<ResearchTask>({
    reducer: (_, next) => next,
  }),

  // Discovered documents (accumulates during search phase)
  discoveredDocs: Annotation<UnifiedSearchDoc[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Selected document IDs for enrichment
  selectedDocIds: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Enriched documents with full content
  enrichedDocs: Annotation<UnifiedSearchDoc[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Worker result (output to shared state)
  // This is written to the shared 'workerResults' key in parent state
  workerResults: Annotation<WorkerResult[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  // Worker status tracking
  status: Annotation<"pending" | "running" | "completed" | "failed">({
    reducer: (_, next) => next,
    default: () => "pending",
  }),

  // Error tracking
  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

/**
 * Worker state type inferred from annotation
 */
export type WorkerState = typeof WorkerStateAnnotation.State;

// ============================================================================
// Orchestrator Helper Types
// ============================================================================

/**
 * Orchestrator analysis of research goal
 */
export const OrchestrationAnalysisSchema = z.object({
  complexity: z
    .enum(["simple", "moderate", "complex"])
    .describe("Complexity of the research goal"),
  domains: z
    .array(z.string())
    .describe("Key domains or fields involved"),
  aspects: z
    .array(z.string())
    .describe("Different aspects to research in parallel"),
  estimatedWorkers: z
    .number()
    .min(1)
    .max(10)
    .describe("Estimated number of parallel workers needed"),
  strategy: z
    .string()
    .describe("Overall research strategy and approach"),
});

export type OrchestrationAnalysis = z.infer<
  typeof OrchestrationAnalysisSchema
>;

/**
 * Synthesis configuration for aggregating worker results
 */
export const SynthesisConfigSchema = z.object({
  deduplicationStrategy: z
    .enum(["url", "content-hash", "both"])
    .describe("How to deduplicate documents across workers"),
  rankingCriteria: z
    .array(z.enum(["relevance", "recency", "authority", "diversity"]))
    .describe("Criteria for ranking final document set"),
  maxDocuments: z
    .number()
    .min(5)
    .max(50)
    .describe("Maximum documents to include in final set"),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Minimum confidence threshold for including results"),
});

export type SynthesisConfig = z.infer<typeof SynthesisConfigSchema>;
