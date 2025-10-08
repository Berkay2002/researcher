/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import type { ParentState } from "../../../state";

// Constants for query planning
const MAX_QUERIES = 10;

// Top-level regex for performance
const QUERY_CLEAN_REGEX = /^["'*•]\s*/;
const MARKDOWN_CODE_BLOCK_REGEX = /^```(?:json)?\s*|\s*```$/gm;
const TRAILING_COMMA_REGEX = /,\s*$/;

/**
 * QueryPlan Node
 *
 * Expands user goal into 5-10 focused search queries using LLM
 */
export async function queryPlan(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[queryPlan] Generating search queries from goal...");

  const { userInputs, plan } = state;

  if (!userInputs?.goal) {
    throw new Error("No goal provided in userInputs");
  }

  // Extract goal and any constraints from plan
  const goal = userInputs.goal;
  const constraints = plan?.constraints || {};

  console.log("[queryPlan] Goal:", goal);
  console.log("[queryPlan] Constraints:", constraints);

  // Generate queries using LLM
  const queries = await generateQueriesWithLLM(goal, constraints);

  console.log(`[queryPlan] Generated ${queries.length} queries:`, queries);

  return {
    queries,
    research: {
      ...(state.research ?? {}),
      queries,
    },
  };
}

/**
 * Generate search queries using LLM
 */
async function generateQueriesWithLLM(
  goal: string,
  constraints: Record<string, unknown>
): Promise<string[]> {
  console.log("[queryPlan] Using LLM to generate queries...");

  const llm = getLLM("generation");

  const systemPrompt = `You are a research query generator. Your task is to create 5-7 diverse, high-quality search queries for the given research goal.

Your queries should:
1. Cover different aspects of the topic (financial, technical, market, competitive, etc.)
2. Use varied search terms and phrasing
3. Be specific enough to return relevant results
4. Include different query types (overview, analysis, recent developments, etc.)
5. Consider the provided constraints

Return ONLY a raw JSON array of query strings with no markdown formatting.
Example: ["query 1", "query 2", "query 3"]`;

  const constraintsText =
    Object.keys(constraints).length > 0
      ? `\nConstraints: ${JSON.stringify(constraints, null, 2)}`
      : "";

  const humanPrompt = `Research goal: ${goal}${constraintsText}

Please generate 5-7 diverse search queries that will help comprehensively research this topic.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    let content = response.content as string;

    // Strip markdown code blocks if present (e.g., ```json ... ```)
    content = content.replace(MARKDOWN_CODE_BLOCK_REGEX, "").trim();

    // Try to parse as JSON array
    let queries: string[] = [];
    try {
      queries = JSON.parse(content) as string[];
    } catch (parseError) {
      console.error(
        "[queryPlan] Failed to parse LLM response as JSON:",
        parseError
      );
      console.log("[queryPlan] LLM response:", content);

      // Fallback: extract lines that look like queries
      queries = content
        .split("\n")
        .map((line) =>
          line
            .replace(QUERY_CLEAN_REGEX, "")
            .replace(TRAILING_COMMA_REGEX, "")
            .trim()
        )
        .filter(
          (line) =>
            line.length > 10 &&
            !line.startsWith("[") &&
            !line.startsWith("]") &&
            !line.includes("{")
        )
        .slice(0, MAX_QUERIES);
    }

    // Ensure we have at least the original goal
    if (queries.length === 0) {
      queries = [goal];
    }

    // Limit to max queries
    return queries.slice(0, MAX_QUERIES);
  } catch (error) {
    console.error("[queryPlan] Error generating queries with LLM:", error);

    // Fallback to simple query variations
    return [
      goal,
      `${goal} analysis`,
      `${goal} overview`,
      `${goal} recent developments`,
      `${goal} market trends`,
    ].slice(0, MAX_QUERIES);
  }
}
