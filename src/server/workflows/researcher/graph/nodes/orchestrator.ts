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

  const { userInputs, plan, researchIterations, totalIterations, issues } =
    state;

  if (!userInputs?.goal) {
    throw new Error("No goal provided in userInputs");
  }

  const goal = userInputs.goal;
  const constraints = plan?.constraints || {};

  // Detect supplemental research mode
  const currentResearch = researchIterations || 0;
  const currentTotal = totalIterations || 0;
  const isSupplementalResearch = currentResearch > 0;

  if (isSupplementalResearch) {
    console.log(
      `[orchestrator] SUPPLEMENTAL RESEARCH MODE (research iteration ${currentResearch + 1}, total iteration ${currentTotal + 1})`
    );
  } else {
    console.log("[orchestrator] INITIAL RESEARCH MODE");
  }

  console.log("[orchestrator] Goal:", goal);
  console.log("[orchestrator] Constraints:", constraints);

  // Detect feedback mode (called from redteam)
  const hasFeedbackIssues = issues && issues.length > 0;
  const researchIssues = hasFeedbackIssues
    ? issues.filter((i) => i.type === "needs_research")
    : [];
  const revisionIssues = hasFeedbackIssues
    ? issues.filter((i) => i.type === "needs_revision")
    : [];

  // Handle pure revision issues (no research spawning needed)
  if (
    hasFeedbackIssues &&
    revisionIssues.length > 0 &&
    researchIssues.length === 0
  ) {
    console.log(
      `[orchestrator] Pure revision mode - ${revisionIssues.length} revision issues, routing directly to synthesizer`
    );
    return {
      planning: {
        ...state.planning,
        tasks: [], // No workers to spawn
        revisionInstructions: revisionIssues.map((i) => i.description),
      },
      totalIterations: currentTotal + 1,
    };
  }

  let taskDecomposition: TaskDecomposition;

  // Handle supplemental research mode
  if (isSupplementalResearch) {
    // Use researchIssues from above (already filtered)
    console.log(
      `[orchestrator] Generating ${MIN_WORKERS} focused tasks for ${researchIssues.length} research issues`
    );

    taskDecomposition = await generateSupplementalTasks(
      goal,
      researchIssues,
      constraints
    );

    console.log(
      `[orchestrator] Created ${taskDecomposition.tasks.length} supplemental tasks`
    );
  } else {
    // Step 1: Analyze the research goal
    const analysis = await analyzeResearchGoal(goal, constraints);
    console.log(
      `[orchestrator] Analysis: ${analysis.complexity} complexity, ${analysis.estimatedWorkers} workers needed`
    );
    console.log("[orchestrator] Domains:", analysis.domains);
    console.log("[orchestrator] Aspects:", analysis.aspects);

    // Step 2: Decompose into parallel tasks
    taskDecomposition = await decomposeIntoTasks(goal, analysis, constraints);
    console.log(
      `[orchestrator] Created ${taskDecomposition.tasks.length} parallel tasks`
    );
    console.log("[orchestrator] Strategy:", taskDecomposition.reasoning);
  }

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
    // Increment iteration counters
    // Note: issues are cleared automatically by replacement reducer when redteam returns new issues
    researchIterations: currentResearch + (isSupplementalResearch ? 1 : 0),
    totalIterations: currentTotal + 1,
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
 * Generate focused supplemental tasks based on research issues
 */
async function generateSupplementalTasks(
  goal: string,
  researchIssues: Array<{ description: string }>,
  constraints: Record<string, unknown>
): Promise<TaskDecomposition> {
  console.log(
    "[orchestrator] Generating supplemental tasks for research issues..."
  );

  const llm = getLLM("analysis"); // Use Gemini 2.5 Pro for reasoning
  const currentDate = getCurrentDateString();

  const issuesText = researchIssues
    .map((issue, i) => `${i + 1}. ${issue.description}`)
    .join("\n");

  const systemPrompt = `You are a research task planner focused on filling specific research gaps identified in a quality review.

CURRENT DATE: ${currentDate}

Generate 1-2 highly targeted supplemental research tasks to address ONLY the identified issues.

Each task should:
1. Directly address specific missing evidence or unsupported claims
2. Have 2-3 precise search queries targeting the gaps
3. Be minimal and focused - ONLY what's needed to fix the issues
4. Have a priority score (0-1)

IMPORTANT: This is supplemental research to fill gaps, not a comprehensive re-research. Only search for what's explicitly missing.`;

  const constraintsText =
    Object.keys(constraints).length > 0
      ? `\n\nConstraints: ${JSON.stringify(constraints, null, 2)}`
      : "";

  const humanPrompt = `Original research goal: ${goal}

Specific Research Gaps Identified:
${issuesText}${constraintsText}

Create 1-2 minimal supplemental research tasks with precise queries to fill ONLY these specific gaps. Do not re-research the entire topic.`;

  try {
    const llmWithStructuredOutput = llm.withStructuredOutput(
      TaskDecompositionSchema
    );

    const decomposition = await llmWithStructuredOutput.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    // Limit to 2 tasks maximum for supplemental research
    const MAX_SUPPLEMENTAL_TASKS = 2;
    if (decomposition.tasks.length > MAX_SUPPLEMENTAL_TASKS) {
      console.warn(
        `[orchestrator] Limiting supplemental tasks from ${decomposition.tasks.length} to ${MAX_SUPPLEMENTAL_TASKS}`
      );
      decomposition.tasks = decomposition.tasks
        .sort((a: ResearchTask, b: ResearchTask) => b.priority - a.priority)
        .slice(0, MAX_SUPPLEMENTAL_TASKS);
    }

    return decomposition;
  } catch (error) {
    console.error("[orchestrator] Error generating supplemental tasks:", error);

    // Fallback: create simple task from first issue
    const fallbackTask: ResearchTask = {
      id: "supplemental-1",
      aspect: researchIssues[0]?.description || "Additional research",
      queries: [
        `${goal} ${researchIssues[0]?.description || ""}`,
        `${goal} additional evidence`,
      ],
      priority: 1,
    };

    return {
      tasks: [fallbackTask],
      reasoning: "Fallback supplemental task for research gap",
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
