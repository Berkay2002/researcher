/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { ParentState } from "../../../state";
import { PLAN_TEMPLATES } from "../state";

/**
 * Auto Planner Node
 *
 * Generates a default "Deep Technical" plan without user interaction.
 * Used when mode is set to "auto".
 *
 * Default strategy:
 * - Deep technical dossier template
 * - Comprehensive sources
 * - Full verification pipeline
 */
export function autoPlanner(state: ParentState): Partial<ParentState> {
  console.log("[autoPlanner] Generating default plan for auto mode...");

  const template = PLAN_TEMPLATES.deep_technical;

  return {
    plan: {
      goal: state.userInputs.goal,
      deliverable: template.deliverable,
      dag: template.dag,
      constraints: template.defaultConstraints,
    },
  };
}
