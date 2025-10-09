/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { END, Send, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { orchestrator } from "./nodes/orchestrator";
import { planGate } from "./nodes/plan-gate";
import { researchWorker } from "./nodes/research-worker";
import { synthesizer } from "./nodes/synthesizer";
import { type ParentState, ParentStateAnnotation } from "./state";
import { buildPlannerSubgraph } from "./subgraphs/planner";
import { redteam } from "./subgraphs/write/nodes/redteam";
import type { ResearchTask } from "./worker-state";

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
 * Build the parent orchestration graph with Orchestrator-Worker pattern
 *
 * Flow: START → planGate → planner → orchestrator → (parallel workers via Send) → synthesizer → redteam → END
 *
 * Orchestrator-Worker Pattern:
 * 1. Orchestrator analyzes goal and decomposes into parallel tasks
 * 2. Each task is sent to a worker via Send API
 * 3. Workers execute independently in parallel
 * 4. All worker results accumulate in shared workerResults state key
 * 5. Synthesizer aggregates all worker results into final report
 *
 * Following LangGraph 1.0-alpha patterns:
 * - All invocations require a thread_id
 * - PostgresSaver provides persistent checkpointing
 * - Send API dynamically spawns workers
 * - Workers write to shared state key (workerResults)
 * - Subgraphs inherit the checkpointer automatically
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
  assertNoNameClash("orchestrator");
  assertNoNameClash("researchWorker");
  assertNoNameClash("synthesizer");
  assertNoNameClash("redteam");

  /**
   * Router function to spawn parallel workers via Send API
   *
   * This follows the Orchestrator-Worker pattern from documentation:
   * - Iterates over tasks created by orchestrator
   * - Creates a Send command for each task
   * - Each Send spawns a researchWorker node with task-specific state
   * - Workers execute in parallel
   * - All worker results are written to shared 'workerResults' key
   */
  function spawnWorkers(state: ParentState): Send[] {
    console.log("[router] Spawning parallel research workers...");

    // Get tasks from planning cache (set by orchestrator)
    // biome-ignore lint/suspicious/noExplicitAny: Tasks are dynamically stored
    const tasks = (state.planning as any)?.tasks as ResearchTask[] | undefined;

    if (!tasks || tasks.length === 0) {
      console.warn("[router] No tasks found, skipping worker spawning");
      return [];
    }

    console.log(`[router] Creating ${tasks.length} parallel workers`);

    // Create Send command for each task
    // Each Send creates a new researchWorker node instance with the task
    return tasks.map((task) => {
      console.log(
        `[router] Spawning worker for task ${task.id}: ${task.aspect}`
      );
      return new Send("researchWorker", { task });
    });
  }

  const builder = new StateGraph(ParentStateAnnotation)
    // Add nodes
    .addNode("planGate", planGate)
    .addNode("planner", planner, { ends: ["planner", "synthesizer"] })
    .addNode("orchestrator", orchestrator)
    .addNode("researchWorker", researchWorker)
    .addNode("synthesizer", synthesizer)
    .addNode("redteam", redteam)

    // Linear flow
    .addEdge(START, "planGate")
    .addEdge("planGate", "planner")
    .addEdge("planner", "orchestrator")

    // Conditional edge: orchestrator → spawn parallel workers
    // This uses the Send API to dynamically create worker nodes
    .addConditionalEdges("orchestrator", spawnWorkers, ["researchWorker"])

    // Workers complete → synthesizer aggregates results
    .addEdge("researchWorker", "synthesizer")

    // Final quality gate and completion
    .addEdge("synthesizer", "redteam")
    .addEdge("redteam", END);

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
 * Create the Orchestrator-Worker research workflow
 * 
 * This is the main export function for LangGraph CLI compatibility.
 * It creates a workflow that follows the Orchestrator-Worker pattern:
 * 
 * 1. User provides research goal
 * 2. Planner creates research plan (with optional HITL)
 * 3. Orchestrator decomposes goal into parallel tasks
 * 4. Workers execute tasks in parallel (via Send API)
 * 5. Synthesizer aggregates results into final report
 * 6. Redteam performs quality checks
 * 
 * @returns Compiled graph for LangGraph CLI
 */
export function createResearcherWorkflow() {
  return getGraph();
}
