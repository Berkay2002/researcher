// src/server/graph/subgraphs/planner/nodes/hitl-planner.ts
/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { Command, interrupt } from "@langchain/langgraph";
import type { ParentState, QuestionAnswer } from "../../../state";
import type { InterruptPayload } from "../state";
import {
  analyzePromptCompleteness,
  constructPlanFromAnswers,
  constructPlanFromPrompt,
  generateDynamicQuestions,
} from "./llm-helpers";

export async function hitlPlanner(
  state: ParentState
): Promise<Partial<ParentState> | Command<"planner" | "research">> {
  console.log("[hitlPlanner] Starting HITL planning flow...");

  const { goal } = state.userInputs;
  if (!goal) {
    throw new Error("No goal provided in userInputs");
  }

  // 1) Analyze completeness
  const analysis = await analyzePromptCompleteness(goal);

  // If complete, build plan and jump straight to research
  if (analysis.isComplete) {
    console.log("[hitlPlanner] Prompt is complete - building plan directly");
    const plan = await constructPlanFromPrompt(goal);
    return new Command({
      update: { plan },
      goto: "research",
      graph: Command.PARENT, // we're inside the planner subgraph; route in parent
    });
  }

  console.log(
    `[hitlPlanner] Prompt incomplete - missing ${analysis.missingAspects.length} aspects`
  );

  // 2) Make questions
  const questions = await generateDynamicQuestions(goal, analysis);
  if (questions.length === 0) {
    console.log("[hitlPlanner] No questions generated - building default plan");
    const plan = await constructPlanFromPrompt(goal);
    return new Command({
      update: { plan },
      goto: "research",
      graph: Command.PARENT,
    });
  }

  console.log(`[hitlPlanner] Generated ${questions.length} questions`);

  // Answers already provided so far (persisted in state)
  const answers: QuestionAnswer[] = state.userInputs.plannerAnswers || [];
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));

  if (nextQuestion) {
    console.log(
      `[hitlPlanner] Asking question ${answeredIds.size + 1} of ${questions.length}: "${nextQuestion.text}"`
    );

    const payload: InterruptPayload = {
      stage: "question",
      questionId: nextQuestion.id,
      questionText: nextQuestion.text,
      options: nextQuestion.options,
      metadata: {
        goal,
        currentQuestion: answeredIds.size + 1,
        totalQuestions: questions.length,
        missingAspects: analysis.missingAspects,
      },
    };

    // Pause; on resume this returns the user's choice
    const resumeValue = await interrupt(payload);

    const newAnswer: QuestionAnswer = {
      questionId: nextQuestion.id,
      selectedOption: resumeValue.selectedOption as string | undefined,
      customAnswer: resumeValue.customAnswer as string | undefined,
    };
    const updatedAnswers = [...answers, newAnswer];

    // If more remain, loop back into planner
    const stillUnanswered = questions.some(
      (q) => !updatedAnswers.some((a) => a.questionId === q.id)
    );

    if (stillUnanswered) {
      return new Command({
        update: {
          userInputs: { ...state.userInputs, plannerAnswers: updatedAnswers },
        },
        goto: "planner", // self-loop
        graph: Command.PARENT, // because planner is a subgraph node in parent
      });
    }

    // Otherwise, finalize plan and continue to research
    const plan = await constructPlanFromAnswers(
      goal,
      updatedAnswers,
      questions
    );
    return new Command({
      update: {
        userInputs: { ...state.userInputs, plannerAnswers: updatedAnswers },
        plan,
      },
      goto: "research",
      graph: Command.PARENT,
    });
  }

  // Safety: all answered but no plan yet
  console.log("[hitlPlanner] All questions answered - constructing final plan");
  const plan = await constructPlanFromAnswers(goal, answers, questions);
  return new Command({
    update: { plan },
    goto: "research",
    graph: Command.PARENT,
  });
}
