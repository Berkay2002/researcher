/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { interrupt } from "@langchain/langgraph";
import type { ParentState, QuestionAnswer } from "../../../state";
import type { InterruptPayload } from "../state";
import {
  analyzePromptCompleteness,
  constructPlanFromAnswers,
  constructPlanFromPrompt,
  generateDynamicQuestions,
} from "./llm-helpers";

/**
 * HITL Planner Node
 *
 * Dynamic question-answer planning flow:
 * 1. Analyze prompt to identify missing information
 * 2. Generate dynamic questions with contextual options
 * 3. Iteratively collect answers through HITL interrupts
 * 4. Construct plan from collected answers
 *
 * Uses LangGraph 1.0-alpha interrupt() primitive for HITL functionality.
 */
export async function hitlPlanner(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[hitlPlanner] Starting HITL planning flow...");

  const { goal } = state.userInputs;

  if (!goal) {
    throw new Error("No goal provided in userInputs");
  }

  // Step 1: Analyze prompt completeness
  const analysis = await analyzePromptCompleteness(goal);

  if (analysis.isComplete) {
    console.log("[hitlPlanner] Prompt is complete - building plan directly");
    const plan = await constructPlanFromPrompt(goal);
    return { plan };
  }

  console.log(
    `[hitlPlanner] Prompt incomplete - missing ${analysis.missingAspects.length} aspects`
  );

  // Step 2: Generate dynamic questions
  const questions = await generateDynamicQuestions(goal, analysis);

  if (questions.length === 0) {
    console.log("[hitlPlanner] No questions generated - building default plan");
    const plan = await constructPlanFromPrompt(goal);
    return { plan };
  }

  console.log(`[hitlPlanner] Generated ${questions.length} questions`);

  // Step 3: Collect answers through iterative interrupts
  const answers: QuestionAnswer[] = state.userInputs.plannerAnswers || [];

  // Find next unanswered question
  const answeredQuestionIds = new Set(answers.map((a) => a.questionId));
  const nextQuestion = questions.find((q) => !answeredQuestionIds.has(q.id));

  if (nextQuestion) {
    console.log(
      `[hitlPlanner] Asking question ${answeredQuestionIds.size + 1} of ${questions.length}: "${nextQuestion.text}"`
    );

    // Create interrupt payload
    const payload: InterruptPayload = {
      stage: "question",
      questionId: nextQuestion.id,
      questionText: nextQuestion.text,
      options: nextQuestion.options,
      metadata: {
        goal,
        currentQuestion: answeredQuestionIds.size + 1,
        totalQuestions: questions.length,
        missingAspects: analysis.missingAspects,
      },
    };

    // Interrupt and wait for user answer
    const resumeValue = await interrupt(payload);

    // Save answer to state
    const newAnswer: QuestionAnswer = {
      questionId: nextQuestion.id,
      selectedOption: resumeValue.selectedOption as string | undefined,
      customAnswer: resumeValue.customAnswer as string | undefined,
    };

    return {
      userInputs: {
        ...state.userInputs,
        plannerAnswers: [...answers, newAnswer],
      },
    };
  }

  // Step 4: All questions answered - construct plan
  console.log("[hitlPlanner] All questions answered - constructing final plan");

  const plan = await constructPlanFromAnswers(goal, answers, questions);

  return { plan };
}
