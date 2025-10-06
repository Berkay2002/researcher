import { END, START, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { planGate } from "./nodes/plan-gate";
import { ParentStateAnnotation } from "./state";
import { buildFactcheckSubgraph } from "./subgraphs/factcheck";
import { buildPlannerSubgraph } from "./subgraphs/planner";
import { buildResearchSubgraph } from "./subgraphs/research";
import { buildWriterSubgraph } from "./subgraphs/write";

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
 * Build the parent orchestration graph
 *
 * Flow: START -> planGate -> planner -> research -> factcheck -> writer -> END
 *
 * - All invocations require a thread_id
 * - PostgresSaver provides persistent checkpointing for HITL, time-travel, and fault-tolerance
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

  // Build subgraphs
  const planner = buildPlannerSubgraph();
  const research = buildResearchSubgraph();
  const factcheck = buildFactcheckSubgraph();
  const writer = buildWriterSubgraph();

  // Build parent graph
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("planGate", planGate)
    .addNode("planner", planner)
    .addNode("research", research)
    .addNode("factcheck", factcheck)
    .addNode("writer", writer)
    .addEdge(START, "planGate")
    .addEdge("planGate", "planner")
    .addEdge("planner", "research")
    .addEdge("research", "factcheck")
    .addEdge("factcheck", "writer")
    .addEdge("writer", END);

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
