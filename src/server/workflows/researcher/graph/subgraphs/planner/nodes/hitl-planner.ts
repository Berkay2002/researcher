// src/server/graph/subgraphs/planner/nodes/hitl-planner.ts
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <> */
/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { Command, interrupt } from "@langchain/langgraph";
import {
  getThreadHistoryEntry,
  setThreadHistoryEntry,
} from "@/lib/store/thread-history";
import type { ParentState } from "../../../state";

import {
  analyzePromptCompleteness,
  constructPlanFromAnswers,
  constructPlanFromPrompt,
  generateDynamicQuestions,
} from "./llm-helpers";

export async function hitlPlanner(
  state: ParentState
): Promise<Partial<ParentState> | Command<"planner" | "researchFlow">> {
  const { goal } = state.userInputs;
  if (!goal) {
    throw new Error("No goal provided in userInputs");
  }

  // Early bootstrap: persist once, then loop back before any interrupt
  if (!(state.planning?.questions && state.planning?.analysis)) {
    console.log("[hitlPlanner] Starting HITL planning flow...");
    const promptAnalysis =
      state.planning?.analysis ?? (await analyzePromptCompleteness(goal));

    if (promptAnalysis.isComplete) {
      const plan = await constructPlanFromPrompt(goal);

      // Update thread status to "running" when transitioning to research
      try {
        const existingEntry = await getThreadHistoryEntry(state.threadId);
        if (existingEntry) {
          await setThreadHistoryEntry({
            ...existingEntry,
            status: "running",
            updatedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
          });
        }
      } catch (historyError) {
        // Don't fail the request if history update fails
        console.warn(
          "[hitlPlanner] Failed to update thread history status:",
          historyError
        );
      }

      return new Command({
        update: {
          plan,
          planning: { ...state.planning, analysis: promptAnalysis },
        },
        goto: "researchFlow",
        graph: Command.PARENT,
      });
    }

    const generatedQuestions =
      state.planning?.questions ??
      (await generateDynamicQuestions(goal, promptAnalysis));

    // Persist analysis and questions, then loop back
    return new Command({
      update: {
        planning: {
          analysis: promptAnalysis,
          questions: generatedQuestions,
          answers: state.planning?.answers ?? [],
        },
      },
      goto: "planner",
      graph: Command.PARENT,
    });
  }

  // Resume from cached state
  const { analysis, questions: cachedQuestions, answers = [] } = state.planning;

  // Find next unanswered question from the STABLE array
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const nextQuestion = cachedQuestions.find((q) => !answeredIds.has(q.id));

  if (nextQuestion) {
    const resume = await interrupt({
      stage: "question",
      questionId: nextQuestion.id,
      questionText: nextQuestion.text,
      options: nextQuestion.options,
      metadata: {
        goal,
        currentQuestion:
          cachedQuestions.findIndex((q) => q.id === nextQuestion.id) + 1,
        totalQuestions: cachedQuestions.length,
        missingAspects: analysis.missingAspects,
      },
    });

    const updatedAnswers = [
      ...answers,
      { questionId: nextQuestion.id, ...resume },
    ];

    // Log the user's choice for debugging/analytics
    if (resume.selectedOption) {
      console.log(
        `[hitlPlanner] The user chose option: ${resume.selectedOption}`
      );
    } else if (resume.customAnswer) {
      console.log(
        `[hitlPlanner] The user chose custom answer: ${resume.customAnswer}`
      );
    }

    // Persist everything and loop back into planner until finished
    return new Command({
      update: {
        planning: {
          analysis,
          questions: cachedQuestions,
          answers: updatedAnswers,
        },
      },
      goto: "planner",
      graph: Command.PARENT,
    });
  }

  // All answered → construct plan once, then leave the planner
  const plan = await constructPlanFromAnswers(goal, answers, cachedQuestions);

  // Update thread status to "running" when transitioning to research
  try {
    const existingEntry = await getThreadHistoryEntry(state.threadId);
    if (existingEntry) {
      await setThreadHistoryEntry({
        ...existingEntry,
        status: "running",
        updatedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });
    }
  } catch (historyError) {
    // Don't fail the request if history update fails
    console.warn(
      "[hitlPlanner] Failed to update thread history status:",
      historyError
    );
  }

  return new Command({
    update: {
      plan,
      planning: { analysis, questions: cachedQuestions, answers },
      userInputs: { ...state.userInputs, plannerAnswers: answers }, // optional mirror for UI/history
    },
    goto: "researchFlow",
    graph: Command.PARENT,
  });
}
