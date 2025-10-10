import { END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { planGate } from "./nodes/plan-gate";
import { synthesizer } from "./nodes/synthesizer";
import { ParentStateAnnotation } from "./state";
import { buildPlannerSubgraph } from "./subgraphs/planner";
import { buildIterativeResearchSubgraph } from "./subgraphs/research-iterative";

/**
 * Compiled parent graph (singleton)
 * Cached after first call to avoid recompilation
 */
let compiled: ReturnType<typeof buildParentGraph> | null = null;

/**
 * Postgres checkpointer (singleton)
 * Cached after first call to avoid recreating connections
 */
let checkpointerSingleton: PostgresSaver | null = null;

/**
 * Build the parent orchestration graph with Iterative Research pattern
 *
 * Flow: START → planGate → planner → iterativeResearch → synthesizer → END
 *
 * Iterative Research Pattern:
 * 1. Planner creates research plan (with optional HITL)
 * 2. Iterative research executes 3-round sequential deep dive:
 *    - Round 1: Broad orientation (2-3 queries)
 *    - Round 2: Targeted deep dive (3-4 queries)
 *    - Round 3: Validation (2-3 queries)
 * 3. All rounds execute sequentially with adaptive query generation
 * 4. Synthesizer generates final report from accumulated sources
 *
 * Following LangGraph 1.0-alpha patterns:
 * - All invocations require a thread_id
 * - PostgresSaver provides persistent checkpointing for HITL, time-travel, and fault-tolerance
 * - Subgraphs inherit the checkpointer automatically
 * - Sequential execution with thought streaming via config.writer
 */
function buildParentGraph() {
  // Get or create the Postgres checkpointer
  if (!checkpointerSingleton) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for persistence"
      );
    }
    checkpointerSingleton = PostgresSaver.fromConnString(databaseUrl);
  }

  // Build planner subgraph (HITL for plan mode)
  const planner = buildPlannerSubgraph();

  // Build parent graph with namespace collision protection
  const CHANNELS = new Set(Object.keys(ParentStateAnnotation.spec));

  function assertNoNameClash(name: string) {
    if (CHANNELS.has(name)) {
      throw new Error(`Node name "${name}" clashes with state channel`);
    }
  }

  // Verify node names don't clash with state channels
  assertNoNameClash("planGate");
  assertNoNameClash("planner");
  assertNoNameClash("iterativeResearch");
  assertNoNameClash("synthesizer");

  const builder = new StateGraph(ParentStateAnnotation)
    // Add nodes
    .addNode("planGate", planGate)
    .addNode("planner", planner, { ends: ["planner", "synthesizer"] })
    .addNode("iterativeResearch", buildIterativeResearchSubgraph())
    .addNode("synthesizer", synthesizer)

    // Iterative research flow: planGate → planner → iterativeResearch → synthesizer
    .addEdge(START, "planGate")
    .addEdge("planGate", "planner")
    .addEdge("planner", "iterativeResearch")
    .addEdge("iterativeResearch", "synthesizer")
    .addEdge("synthesizer", END);

  // Compile with Postgres checkpointer for persistent thread-level memory
  return builder.compile({ checkpointer: checkpointerSingleton });
}

/**
 * Get the compiled parent graph (singleton pattern)
 *
 * @returns Compiled parent graph with Postgres checkpointer
 */
export function getGraph() {
  if (!compiled) {
    compiled = buildParentGraph();
  }
  return compiled;
}

/**
 * Create the Iterative Research workflow
 *
 * This is the main export function for LangGraph CLI compatibility.
 * It creates a workflow that follows the Iterative Research pattern:
 *
 * 1. User provides research goal
 * 2. Planner creates research plan (with optional HITL)
 * 3. Iterative research executes 3-round sequential deep dive:
 *    - Round 1: Broad orientation queries
 *    - Round 2: Targeted deep dive based on Round 1 gaps
 *    - Round 3: Validation queries based on Round 2 gaps
 * 4. Synthesizer generates final comprehensive report
 *
 * @returns Compiled graph for LangGraph CLI
 */
export function createResearcherWorkflow() {
  return getGraph();
}
