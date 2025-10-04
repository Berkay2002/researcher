/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { interrupt } from "@langchain/langgraph";
import type { ParentState } from "../../../state";
import {
  type Constraints,
  type InterruptPayload,
  PLAN_TEMPLATES,
  type PlanTemplate,
} from "../state";

/**
 * HITL Planner Node
 *
 * Two-stage human-in-the-loop planning:
 * 1. First interrupt: Ask user to select a plan template
 * 2. Second interrupt: Ask for constraints (deadline, budget, depth, etc.)
 * 3. Construct final plan from both answers
 */
export async function hitlPlanner(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[hitlPlanner] Starting HITL planning flow...");

  // Check if we have a template selection from first resume
  const templateChoice = state.userInputs.plannerAnswers?.template as
    | PlanTemplate
    | undefined;

  // Stage 1: Template Selection
  if (!templateChoice) {
    console.log("[hitlPlanner] Stage 1: Presenting template options...");

    const payload: InterruptPayload = {
      stage: "template_selection",
      question: "Choose a research strategy for your goal:",
      options: [
        {
          value: "quick_scan",
          label: PLAN_TEMPLATES.quick_scan.name,
          description: PLAN_TEMPLATES.quick_scan.description,
        },
        {
          value: "systematic_review",
          label: PLAN_TEMPLATES.systematic_review.name,
          description: PLAN_TEMPLATES.systematic_review.description,
        },
        {
          value: "competitive_landscape",
          label: PLAN_TEMPLATES.competitive_landscape.name,
          description: PLAN_TEMPLATES.competitive_landscape.description,
        },
        {
          value: "deep_technical",
          label: PLAN_TEMPLATES.deep_technical.name,
          description: PLAN_TEMPLATES.deep_technical.description,
        },
        {
          value: "custom",
          label: PLAN_TEMPLATES.custom.name,
          description: PLAN_TEMPLATES.custom.description,
        },
      ],
      metadata: {
        goal: state.userInputs.goal,
      },
    };

    // First interrupt - wait for user to select template
    const resumeValue = interrupt(payload);

    // When resumed, save template choice to state
    return {
      userInputs: {
        ...state.userInputs,
        plannerAnswers: {
          ...state.userInputs.plannerAnswers,
          template: resumeValue.template,
        },
      },
    };
  }

  // Check if we have constraints from second resume
  const constraintsChoice = state.userInputs.plannerAnswers
    ?.constraints as Constraints;

  // Stage 2: Constraints Collection
  if (!constraintsChoice) {
    console.log("[hitlPlanner] Stage 2: Collecting constraints...");

    const template = PLAN_TEMPLATES[templateChoice];

    const payload: InterruptPayload = {
      stage: "constraints",
      question: "Specify constraints for your research:",
      metadata: {
        goal: state.userInputs.goal,
        template: templateChoice,
        templateName: template.name,
        suggestedConstraints: template.defaultConstraints,
      },
    };

    // Second interrupt - wait for user to specify constraints
    const resumeValue = interrupt(payload);

    // When resumed, save constraints and build final plan
    const constraints: Constraints = {
      ...template.defaultConstraints,
      ...resumeValue.constraints,
    };

    return {
      userInputs: {
        ...state.userInputs,
        plannerAnswers: {
          ...state.userInputs.plannerAnswers,
          constraints,
        },
      },
      plan: {
        goal: state.userInputs.goal,
        deliverable: template.deliverable,
        dag: template.dag,
        constraints,
      },
    };
  }

  // Stage 3: Plan already constructed (should not reach here in normal flow)
  console.log("[hitlPlanner] Plan already exists, returning current state...");
  return {};
}
