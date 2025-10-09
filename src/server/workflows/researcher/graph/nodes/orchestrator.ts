/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import { getCurrentDateString } from "@/server/shared/utils/current-date";
import type { ParentState } from "../state";
import {
  type OrchestrationAnalysis,
  OrchestrationAnalysisSchema,
  type ResearchTask,
  type TaskDecomposition,
  TaskDecompositionSchema,
} from "../worker-state";

// Constants for orchestration
const MIN_WORKERS = 3;
const MAX_WORKERS = 8;
const QUERIES_PER_TASK = 2;
const PRIORITY_DECREMENT = 0.1;

/**
 * Orchestrator Node
 *
 * Analyzes the research goal and decomposes it into parallel research tasks.
 * Each task focuses on a specific aspect of the goal and will be executed by
 * an independent worker in parallel.
 *
 * This follows the Orchestrator-Worker pattern from LangGraph documentation:
 * 1. Analyze research goal complexity and domains
 * 2. Identify distinct research aspects (financial, technical, market, etc.)
 * 3. Generate focused queries for each aspect
 * 4. Create task assignments for parallel workers
 *
 * The orchestrator uses structured outputs with Zod schemas to ensure
 * consistent task decomposition.
 */
export async function orchestrator(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log(
    "[orchestrator] Analyzing research goal and decomposing tasks..."
  );

  const { userInputs, plan } = state;

  if (!userInputs?.goal) {
    throw new Error("No goal provided in userInputs");
  }

  const goal = userInputs.goal;
  const constraints = plan?.constraints || {};

  console.log("[orchestrator] Goal:", goal);
  console.log("[orchestrator] Constraints:", constraints);

  // Step 1: Analyze the research goal
  const analysis = await analyzeResearchGoal(goal, constraints);
  console.log(
    `[orchestrator] Analysis: ${analysis.complexity} complexity, ${analysis.estimatedWorkers} workers needed`
  );
  console.log("[orchestrator] Domains:", analysis.domains);
  console.log("[orchestrator] Aspects:", analysis.aspects);

  // Step 2: Decompose into parallel tasks
  const taskDecomposition = await decomposeIntoTasks(
    goal,
    analysis,
    constraints
  );
  console.log(
    `[orchestrator] Created ${taskDecomposition.tasks.length} parallel tasks`
  );
  console.log("[orchestrator] Strategy:", taskDecomposition.reasoning);

  // Step 3: Store tasks in research state for worker distribution
  const tasks = taskDecomposition.tasks;

  // Extract all queries for parent state
  const allQueries = tasks.flatMap((task: ResearchTask) => task.queries);
  console.log(
    `[orchestrator] Total queries across all tasks: ${allQueries.length}`
  );

  return {
    queries: allQueries,
    research: {
      ...(state.research ?? {}),
      queries: allQueries,
    },
    // Store tasks metadata for conditional edge
    // This will be used by the router to spawn workers via Send API
    planning: {
      ...state.planning,
      // biome-ignore lint/suspicious/noExplicitAny: Tasks temporarily stored in planning cache
      tasks: tasks as any,
    },
  };
}

/**
 * Analyze research goal to understand complexity and domains
 */
async function analyzeResearchGoal(
  goal: string,
  constraints: Record<string, unknown>
): Promise<OrchestrationAnalysis> {
  console.log("[orchestrator] Using LLM to analyze research goal...");

  const llm = getLLM("analysis"); // Use Gemini 2.5 Pro for reasoning
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research planning expert. Analyze the research goal to understand its complexity and key domains.

CURRENT DATE: ${currentDate}

Your analysis should identify:
1. Complexity level (simple, moderate, complex)
2. Key domains or fields involved (e.g., finance, technology, healthcare, policy)
3. Different aspects to research in parallel (e.g., financial analysis, technical evaluation, market trends)
4. Estimated number of parallel workers needed (3-8)
5. Overall research strategy

Be thorough but concise.`;

  const constraintsText =
    Object.keys(constraints).length > 0
      ? `\n\nConstraints: ${JSON.stringify(constraints, null, 2)}`
      : "";

  const humanPrompt = `Research goal: ${goal}${constraintsText}

Please analyze this research goal and provide your assessment.`;

  try {
    const llmWithStructuredOutput = llm.withStructuredOutput(
      OrchestrationAnalysisSchema
    );

    const analysis = await llmWithStructuredOutput.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    console.log("[orchestrator] Analysis completed");
    return analysis;
  } catch (error) {
    console.error("[orchestrator] Error analyzing research goal:", error);
    // Fallback to simple analysis
    return {
      complexity: "moderate",
      domains: [goal],
      aspects: [goal, `${goal} analysis`, `${goal} trends`],
      estimatedWorkers: MIN_WORKERS,
      strategy: "Execute comprehensive research across all relevant domains",
    };
  }
}

/**
 * Decompose research goal into parallel tasks for workers
 */
async function decomposeIntoTasks(
  goal: string,
  analysis: OrchestrationAnalysis,
  constraints: Record<string, unknown>
): Promise<TaskDecomposition> {
  console.log("[orchestrator] Decomposing research into parallel tasks...");

  const llm = getLLM("analysis"); // Use Gemini 2.5 Pro for reasoning
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research task planner. Break down the research goal into ${MIN_WORKERS}-${MAX_WORKERS} distinct parallel research tasks.

CURRENT DATE: ${currentDate}

Each task should:
1. Focus on a specific aspect (e.g., financial analysis, technical evaluation, market trends, competitive landscape)
2. Have ${QUERIES_PER_TASK}-4 targeted search queries
3. Be independently executable in parallel
4. Have a priority score (0-1) indicating importance

Generate tasks that cover different angles without overlap. Higher priority tasks are more critical to the core research goal.`;

  const constraintsText =
    Object.keys(constraints).length > 0
      ? `\n\nConstraints: ${JSON.stringify(constraints, null, 2)}`
      : "";

  const humanPrompt = `Research goal: ${goal}

Analysis:
- Complexity: ${analysis.complexity}
- Domains: ${analysis.domains.join(", ")}
- Aspects: ${analysis.aspects.join(", ")}
- Strategy: ${analysis.strategy}${constraintsText}

Please create ${MIN_WORKERS}-${MAX_WORKERS} parallel research tasks with focused queries for each aspect.`;

  try {
    const llmWithStructuredOutput = llm.withStructuredOutput(
      TaskDecompositionSchema
    );

    const decomposition = await llmWithStructuredOutput.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    // Ensure we have a reasonable number of tasks
    if (decomposition.tasks.length < MIN_WORKERS) {
      console.warn(
        `[orchestrator] Only ${decomposition.tasks.length} tasks generated, expected at least ${MIN_WORKERS}`
      );
    }
    if (decomposition.tasks.length > MAX_WORKERS) {
      console.warn(
        `[orchestrator] ${decomposition.tasks.length} tasks generated, limiting to ${MAX_WORKERS}`
      );
      decomposition.tasks = decomposition.tasks
        .sort((a: ResearchTask, b: ResearchTask) => b.priority - a.priority)
        .slice(0, MAX_WORKERS);
    }

    return decomposition;
  } catch (error) {
    console.error("[orchestrator] Error decomposing tasks:", error);

    // Fallback: create simple task decomposition based on aspects
    const fallbackTasks: ResearchTask[] = analysis.aspects
      .slice(0, MAX_WORKERS)
      .map((aspect: string, index: number) => ({
        id: `task-${index + 1}`,
        aspect,
        queries: [
          `${goal} ${aspect}`,
          `${goal} ${aspect} analysis`,
          `${goal} ${aspect} recent developments`,
        ],
        priority: 1 - index * PRIORITY_DECREMENT,
      }));

    return {
      tasks: fallbackTasks,
      reasoning:
        "Fallback decomposition: Created tasks for each identified aspect",
    };
  }
}
