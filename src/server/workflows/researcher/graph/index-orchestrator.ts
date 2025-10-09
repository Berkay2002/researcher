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

// Iteration limits for termination guarantees
const MAX_TOTAL_ITERATIONS = 3;
const MAX_RESEARCH_ITERATIONS = 1;
const MAX_REVISION_ITERATIONS = 2;

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

  /**
   * Smart router function to handle redteam feedback with multi-layer safeguards
   *
   * Decision tree:
   * 1. Check HARD LIMITS first (guaranteed termination)
   * 2. If no issues or force-approved → END
   * 3. Classify issues: needs_research vs needs_revision
   * 4. Route based on issue type and remaining iteration budget
   * 5. If budget exhausted → Force END
   *
   * Guarantees:
   * - Maximum total iterations: 3
   * - Maximum research iterations: 1
   * - Maximum revision iterations: 2
   * - Force approval on final iteration
   */

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
  function routeRedteam(state: ParentState): string {
    const {
      issues,
      totalIterations,
      researchIterations,
      revisionIterations,
      forceApproved,
    } = state;

    const currentTotal = totalIterations || 0;
    const currentResearch = researchIterations || 0;
    const currentRevision = revisionIterations || 0;

    console.log(
      `[router] Evaluating redteam results (iteration ${currentTotal}/${MAX_TOTAL_ITERATIONS})`
    );
    console.log(
      `[router] Research: ${currentResearch}/${MAX_RESEARCH_ITERATIONS}, Revision: ${currentRevision}/${MAX_REVISION_ITERATIONS}`
    );

    // HARD LIMIT: Force termination (should never reach here due to force approval, but safety check)
    if (currentTotal >= MAX_TOTAL_ITERATIONS) {
      console.warn(
        "[router] MAX_TOTAL_ITERATIONS reached - terminating with current draft"
      );
      return END;
    }

    // No issues or force approved → SUCCESS
    if (!issues || issues.length === 0 || forceApproved) {
      if (forceApproved) {
        console.warn(
          "[router] Draft force-approved on final iteration - proceeding to END"
        );
      } else {
        console.log(
          "[router] Draft passed all quality checks - proceeding to END"
        );
      }
      return END;
    }

    // Classify issues by type
    const researchIssues = issues.filter((i) => i.type === "needs_research");
    const revisionIssues = issues.filter((i) => i.type === "needs_revision");

    console.log(
      `[router] Found ${researchIssues.length} research issues, ${revisionIssues.length} revision issues`
    );

    // Research loop (LIMITED to 1 iteration)
    if (
      researchIssues.length > 0 &&
      currentResearch < MAX_RESEARCH_ITERATIONS
    ) {
      console.log(
        `[router] Needs supplemental research - routing to orchestrator (research iteration ${currentResearch + 1}/${MAX_RESEARCH_ITERATIONS})`
      );
      return "orchestrator";
    }

    // Revision loop (LIMITED to 2 iterations)
    if (
      revisionIssues.length > 0 &&
      currentRevision < MAX_REVISION_ITERATIONS
    ) {
      console.log(
        `[router] Needs text revision - routing to synthesizer (revision iteration ${currentRevision + 1}/${MAX_REVISION_ITERATIONS})`
      );
      return "synthesizer";
    }

    // Budget exhausted but issues remain → Force termination
    console.warn(
      `[router] Iteration budgets exhausted (research: ${currentResearch}/${MAX_RESEARCH_ITERATIONS}, revision: ${currentRevision}/${MAX_REVISION_ITERATIONS})`
    );
    console.warn(
      `[router] Terminating with ${issues.length} remaining issues (${researchIssues.length} research, ${revisionIssues.length} revision)`
    );

    return END;
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

    // Synthesizer → redteam quality gate
    .addEdge("synthesizer", "redteam")

    // Conditional edge: redteam → synthesizer (revision) or orchestrator (research) or END
    .addConditionalEdges("redteam", routeRedteam, {
      synthesizer: "synthesizer",
      orchestrator: "orchestrator",
      [END]: END,
    });

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
