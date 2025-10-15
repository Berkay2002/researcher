/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// Commented out: Parallel orchestration pattern (not currently used)
// import { analyzeComplexity } from "./nodes/analyze-complexity";
// import { orchestrator } from "./nodes/orchestrator";
// import { researchWorker } from "./nodes/research-worker";
// import type { ResearchTask } from "./worker-state";
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
 * - PostgresSaver provides persistent checkpointing
 * - Subgraphs inherit the checkpointer automatically
 * - Sequential execution with thought streaming via config.writer
 *
 * Note: Parallel orchestration pattern is available but commented out.
 * See commit history to restore orchestrator + workers for multi-aspect research.
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

  // ============================================================================
  // COMMENTED OUT: Parallel Orchestration Pattern
  // ============================================================================
  // The following code implements parallel research with orchestrator + workers.
  // Currently disabled to focus on iterative research pattern.
  // To restore parallel mode:
  // 1. Uncomment imports at top (analyzeComplexity, orchestrator, researchWorker)
  // 2. Uncomment the functions below
  // 3. Uncomment the nodes and routing in the graph builder
  // 4. Add Send back to imports from @langchain/langgraph

  /*
  assertNoNameClash("analyzeComplexity");
  assertNoNameClash("orchestrator");
  assertNoNameClash("researchWorker");

  function routeResearch(
    state: ParentState
  ): "iterativeResearch" | "orchestrator" {
    const decision = state.orchestrationDecision;

    if (!decision) {
      console.warn(
        "[router] No orchestration decision found, defaulting to iterative"
      );
      return "iterativeResearch";
    }

    console.log(
      `[router] Routing to ${decision.mode} mode (confidence: ${decision.confidence})`
    );
    console.log(`[router] Reasoning: ${decision.reasoning}`);

    return decision.mode === "iterative" ? "iterativeResearch" : "orchestrator";
  }

  function spawnWorkers(state: ParentState): Send[] {
    console.log("[router] Spawning parallel research workers...");

    const tasks = (state.planning as any)?.tasks as ResearchTask[] | undefined;

    if (!tasks || tasks.length === 0) {
      console.warn("[router] No tasks found, skipping worker spawning");
      return [];
    }

    console.log(`[router] Creating ${tasks.length} parallel workers`);

    return tasks.map((task) => {
      console.log(
        `[router] Spawning worker for task ${task.id}: ${task.aspect}`
      );
      return new Send("researchWorker", { task });
    });
  }
  */

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

  // ============================================================================
  // COMMENTED OUT: Parallel Orchestration Nodes & Routing
  // ============================================================================
  // To restore parallel mode, uncomment the following and add imports:

  /*
    .addNode("analyzeComplexity", analyzeComplexity)
    .addNode("orchestrator", orchestrator)
    .addNode("researchWorker", researchWorker)
    
    // Replace the direct edge from planner to iterativeResearch with:
    // .addEdge("planner", "analyzeComplexity")
    // .addConditionalEdges("analyzeComplexity", routeResearch, {
    //   iterativeResearch: "iterativeResearch",
    //   orchestrator: "orchestrator",
    // })
    // .addConditionalEdges("orchestrator", spawnWorkers, ["researchWorker"])
    // .addEdge("researchWorker", "synthesizer")
  */

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
 * Note: This replaces the previous Orchestrator-Worker parallel pattern.
 * The parallel pattern is preserved in comments for future restoration if needed.
 *
 * @returns Compiled graph for LangGraph CLI
 */
export function createResearcherWorkflow() {
  return getGraph();
}
