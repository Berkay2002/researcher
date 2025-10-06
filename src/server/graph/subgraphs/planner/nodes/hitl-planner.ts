// src/server/graph/subgraphs/planner/nodes/hitl-planner.ts
/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { Command, interrupt } from "@langchain/langgraph";
import type { ParentState, QuestionAnswer } from "../../../state";

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

  // 1) Reuse cached analysis/questions if present
  const planning = state.planning ?? {};
  const analysis = planning.analysis ?? (await analyzePromptCompleteness(goal));

  if (analysis.isComplete) {
    const plan = await constructPlanFromPrompt(goal);
    return new Command({
      update: { plan, planning: { ...planning, analysis } },
      goto: "research",
      graph: Command.PARENT,
    });
  }

  const questions = planning.questions ?? (await generateDynamicQuestions(goal, analysis));
  const answers: QuestionAnswer[] = (planning.answers ?? []).filter(a => questions.some(q => q.id === a.questionId));

  // 2) Find next unanswered question from the STABLE array
  const answeredIds = new Set(answers.map(a => a.questionId));
  const next = questions.find(q => !answeredIds.has(q.id));

  if (next) {
    const resume = await interrupt({
      stage: "question",
      questionId: next.id,
      questionText: next.text,
      options: next.options,
      metadata: {
        goal,
        currentQuestion: questions.findIndex(q => q.id === next.id) + 1,
        totalQuestions: questions.length,
        missingAspects: analysis.missingAspects,
      },
    });

    const updatedAnswers = [...answers, { questionId: next.id, ...resume }];

    // 3) Persist everything and loop back into planner until finished
    return new Command({
      update: { planning: { analysis, questions, answers: updatedAnswers } },
      goto: "planner",
      graph: Command.PARENT,
    });
  }

  // 4) All answered → construct plan once, then leave the planner
  const plan = await constructPlanFromAnswers(goal, answers, questions);
  return new Command({
    update: {
      plan,
      planning: { analysis, questions, answers },
      userInputs: { ...state.userInputs, plannerAnswers: answers }, // optional mirror for UI/history
    },
    goto: "research",
    graph: Command.PARENT,
  });
}