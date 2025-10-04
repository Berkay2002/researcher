/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { type ParentState, ParentStateAnnotation } from "../../state";
import { autoPlanner } from "./nodes/autoPlanner";
import { hitlPlanner } from "./nodes/hitlPlanner";

/**
 * Planner Subgraph
 *
 * Conditional routing based on mode:
 * - Auto mode: Generate default plan immediately
 * - Plan mode: Two-stage HITL (template selection → constraints)
 */
function routePlanner(state: ParentState): string {
  const mode = state.userInputs.modeOverride ?? "auto";
  console.log(`[planner] Routing to ${mode} mode...`);
  return mode === "plan" ? "hitlPlanner" : "autoPlanner";
}

export function buildPlannerSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    .addNode("autoPlanner", autoPlanner)
    .addNode("hitlPlanner", hitlPlanner)
    .addConditionalEdges(START, routePlanner, {
      autoPlanner: "autoPlanner",
      hitlPlanner: "hitlPlanner",
    })
    .addEdge("autoPlanner", END)
    .addEdge("hitlPlanner", END);

  return builder.compile();
}
