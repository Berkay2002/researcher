// ============================================================================
// NOT CURRENTLY USED - Preserved for future parallel mode restoration
// ============================================================================
// This file implements intelligent routing between iterative and parallel modes.
// Since we now use ONLY iterative research, this node is not used.
// To restore: uncomment imports in index-orchestrator.ts and add routing logic.

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@/server/shared/configs/llm";
import { getCurrentDateString } from "@/server/shared/utils/current-date";
import type { ParentState } from "../state";
// import { OrchestrationDecisionSchema } from "../state"; // Commented out - schema not exported

/**
 * Analyze goal complexity to determine research mode routing
 *
 * NOTE: This node is currently NOT USED. Workflow uses only iterative research.
 *
 * This node uses an LLM to analyze the research goal and decide whether to use:
 * - **Iterative Mode**: For cohesive, single-topic research with intersecting aspects
 *   Example: "Give me an in-depth analysis of Nvidia" → All aspects (financial, technical, market) are about one company
 * - **Parallel Mode**: For independent, multi-aspect research with no intersection
 *   Example: "Compare Tesla, Ford, and GM financially" → 3 independent company analyses
 *
 * Decision is based on:
 * 1. Number of distinct aspects/entities in the goal
 * 2. Whether those aspects intersect conceptually
 * 3. Complexity and depth required
 *
 * Following LangGraph patterns:
 * - Uses structured LLM output (withStructuredOutput)
 * - Returns partial state update
 * - Streams decision via config.writer
 *
 * @param state - Parent state with user inputs and plan
 * @param config - LangGraph config for streaming
 * @returns Partial state with orchestration decision
 */
export async function analyzeComplexity(
  state: ParentState,
  config: LangGraphRunnableConfig
): Promise<Partial<ParentState>> {
  const { goal } = state.userInputs;
  const plan = state.plan;
  const writer = config.writer;

  // Emit thinking event
  if (writer) {
    await writer({
      type: "thought",
      content: "Analyzing research goal complexity...",
      metadata: { step: "complexity_analysis" },
    });
  }

  // Get LLM with structured output for decision
  const llm = getLLM("analysis").withStructuredOutput(
    OrchestrationDecisionSchema
  );

  const currentDate = getCurrentDateString();

  const systemPrompt = `You are an expert research orchestrator. Your job is to analyze a research goal and determine the best execution strategy.

**Current Date**: ${currentDate}

**Strategies:**

1. **Iterative Mode** (Sequential Deep Dive)
   - Use when: The goal involves ONE cohesive topic with intersecting aspects
   - Example: "Analyze Nvidia's market position"
     - All aspects (financial, technical, market) are about ONE company
     - Research findings will inform and build upon each other
     - Depth and thoroughness prioritized over speed
   - Characteristics: Single focal point, intersecting knowledge, cumulative understanding

2. **Parallel Mode** (Independent Workstreams)
   - Use when: The goal requires MULTIPLE independent research tracks with NO intersection
   - Example: "Compare Tesla, Ford, and GM financially"
     - 3 separate companies = 3 independent research tracks
     - Financial data for Tesla doesn't help research Ford
     - Each track is completely independent
   - Characteristics: Multiple focal points, no knowledge transfer, parallelizable work

**Decision Criteria:**

- Count the number of distinct entities/aspects in the goal
- Determine if research findings will intersect/inform each other
- If YES to intersection → **iterative** (build cumulative understanding)
- If NO to intersection (truly independent) → **parallel** (optimize for speed)

**Edge Cases:**

- "Analyze AI chip market" → **iterative** (one market, multiple interconnected players)
- "Tesla vs Ford" → **iterative** (comparison requires understanding relationships)
- "Nvidia + AMD market share" → **iterative** (market share is inherently comparative)
- "Research 5 different cities for vacation" → **parallel** (no intersection between cities)

**Quality over Speed:**
- When in doubt, choose **iterative** for deeper, more coherent research
- Parallel mode is ONLY for truly independent research tracks

Analyze the goal and respond with your decision.`;

  const userPrompt = `Research Goal: "${goal}"

${plan ? `Research Plan:\n- Deliverable: ${plan.deliverable}\n- Constraints: ${JSON.stringify(plan.constraints, null, 2)}` : ""}

Analyze this goal and determine the best research strategy.`;

  // Get structured decision from LLM
  const decision = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  // Emit decision event
  if (writer) {
    await writer({
      type: "thought",
      content: `Research mode: **${decision.mode}**\n\nReasoning: ${decision.reasoning}\n\nAspects identified: ${decision.aspects.join(", ")}\n\nIntersection detected: ${decision.hasIntersection ? "Yes" : "No"}`,
      metadata: {
        step: "complexity_analysis",
        decision: decision.mode,
        confidence: decision.confidence,
      },
    });
  }

  // Return decision in state
  return {
    orchestrationDecision: decision,
  };
}
