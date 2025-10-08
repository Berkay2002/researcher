/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { ParentState } from "../../../state";
import {
  analyzePromptCompleteness,
  constructDefaultPlan,
  constructPlanFromPrompt,
} from "./llm-helpers";

/**
 * Auto Planner Node
 *
 * Analyzes prompt quality and constructs plan without user interaction.
 * - If prompt is complete: Build plan directly
 * - If prompt is incomplete: Build plan with reasonable default assumptions
 *
 * Used when mode is set to "auto".
 */
export async function autoPlanner(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[autoPlanner] Starting auto planning...");

  const { goal } = state.userInputs;

  if (!goal) {
    throw new Error("No goal provided in userInputs");
  }

  console.log(`[autoPlanner] Analyzing prompt: "${goal}"`);

  // Analyze prompt completeness
  const analysis = await analyzePromptCompleteness(goal);

  if (analysis.isComplete) {
    console.log("[autoPlanner] Prompt is complete - building plan directly");

    // Construct plan from complete prompt
    const plan = await constructPlanFromPrompt(goal);

    return { plan };
  }

  console.log(
    `[autoPlanner] Prompt incomplete (missing: ${analysis.missingAspects.join(", ")}) - using default assumptions`
  );

  // Construct plan with default assumptions (auto mode doesn't interrupt)
  const plan = await constructDefaultPlan(goal);

  return { plan };
}
