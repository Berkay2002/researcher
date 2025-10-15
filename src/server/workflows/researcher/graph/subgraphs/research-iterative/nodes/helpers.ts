/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import { getCurrentDateString } from "@/server/shared/utils/current-date";

// Constants for query generation
const MAX_QUERIES_ROUND_1 = 3;
const MAX_QUERIES_ROUND_2 = 4;
const MAX_QUERIES_ROUND_3 = 3;
const MAX_FALLBACK_QUERIES = 5;

// Top-level regex for performance (LangGraph best practice)
const MARKDOWN_CODE_BLOCK_REGEX = /```(?:json)?\s*|\s*```/g;
const JSON_ARRAY_REGEX = /\[[\s\S]*\]/;
const QUERY_PREFIX_REGEX = /^["'*•-]\s*/;

/**
 * Extract queries from LLM text output
 *
 * Fallback parsing when LLM doesn't return pure JSON.
 * Uses regex patterns defined at module level for performance.
 *
 * Pattern: Standard text processing helper (not LangGraph-specific)
 */
export function extractQueriesFromText(text: string): string[] {
  // Strip markdown code blocks
  const cleanedText = text.replace(MARKDOWN_CODE_BLOCK_REGEX, "").trim();

  // Try to extract JSON array
  const jsonMatch = cleanedText.match(JSON_ARRAY_REGEX);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((q) =>
          typeof q === "string"
            ? q.trim().replace(QUERY_PREFIX_REGEX, "")
            : String(q)
        );
      }
    } catch {
      // Fall through to line-by-line parsing
    }
  }

  // Fallback: Parse line by line
  const lines = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      if (line.startsWith("{")) {
        return false;
      }
      if (line.startsWith("[")) {
        return false;
      }
      return true;
    });

  return lines
    .map((line) => line.replace(QUERY_PREFIX_REGEX, ""))
    .filter((q) => q.length > 0)
    .slice(0, MAX_FALLBACK_QUERIES);
}

/**
 * Generate Round 1 queries: Broad orientation
 *
 * Uses LLM with structured prompts to generate 2-3 broad queries.
 * Pattern: Standard LLM invocation with HumanMessage/SystemMessage
 *
 * @param goal Research goal from parent state
 * @param constraints Constraints from plan (if any)
 * @returns Array of broad orientation queries
 */
export async function generateRound1Queries(
  goal: string,
  constraints: Record<string, unknown>
): Promise<string[]> {
  console.log("[Round1] Generating broad orientation queries...");

  const llm = getLLM("generation");
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research query generator conducting Round 1 (Broad Orientation) research.

CURRENT DATE: ${currentDate}

Your task: Generate 2-3 broad, high-level search queries to establish a comprehensive foundation.

These queries should cover:
1. General overview and current state
2. Recent developments and trends
3. Key stakeholders, organizations, or context

IMPORTANT: Return ONLY a raw JSON array of query strings with no markdown formatting.
Example: ["query 1", "query 2", "query 3"]`;

  const constraintsText =
    Object.keys(constraints).length > 0
      ? `\n\nConstraints: ${JSON.stringify(constraints, null, 2)}`
      : "";

  const humanPrompt = `Research Goal: ${goal}${constraintsText}

Generate ${MAX_QUERIES_ROUND_1} broad orientation queries for Round 1.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const queries = extractQueriesFromText(response.content as string);
    console.log(`[Round1] Generated ${queries.length} queries:`, queries);
    return queries.slice(0, MAX_QUERIES_ROUND_1);
  } catch (error) {
    console.error("[Round1] Error generating queries:", error);
    // Fallback: Create basic queries from goal
    return [
      `${goal} overview`,
      `${goal} recent developments`,
      `${goal} key facts`,
    ].slice(0, MAX_QUERIES_ROUND_1);
  }
}

/**
 * Analyze Round 1 findings and identify gaps
 *
 * Uses LLM to analyze what was found and what's missing.
 * Pattern: Standard LLM invocation for reasoning
 *
 * @param goal Research goal
 * @param round1Queries Queries from Round 1
 * @param round1SourceCount Number of sources found in Round 1
 * @returns Object with gaps array and reasoning
 */
export async function analyzeRound1Gaps(
  goal: string,
  round1Queries: string[],
  round1SourceCount: number
): Promise<{ gaps: string[]; reasoning: string }> {
  console.log("[Round1] Analyzing findings to identify gaps...");

  const llm = getLLM("analysis"); // Use Gemini 2.5 Pro for reasoning
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research analyst reviewing Round 1 (Broad Orientation) findings.

CURRENT DATE: ${currentDate}

Your task: Analyze what was covered and identify knowledge gaps that need deeper investigation.

Consider:
- What specific details are missing?
- What quantitative data is needed?
- What aspects require technical deep-dive?
- What recent developments need validation?

Return a JSON object with:
{
  "gaps": ["gap 1", "gap 2", "gap 3", "gap 4"],
  "reasoning": "Brief explanation of identified gaps"
}`;

  const humanPrompt = `Research Goal: ${goal}

Round 1 Results:
- Executed ${round1Queries.length} broad queries
- Found ${round1SourceCount} sources
- Queries: ${round1Queries.join(", ")}

Based on these broad queries, what specific knowledge gaps remain for a comprehensive report?`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const content = (response.content as string)
      .replace(MARKDOWN_CODE_BLOCK_REGEX, "")
      .trim();
    const parsed = JSON.parse(content);

    return {
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      reasoning: parsed.reasoning || "Gap analysis completed",
    };
  } catch (error) {
    console.error("[Round1] Error analyzing gaps:", error);
    return {
      gaps: [
        "Detailed quantitative data",
        "Technical specifics",
        "Recent developments",
        "Comparative analysis",
      ],
      reasoning: "Fallback gap identification",
    };
  }
}

/**
 * Generate Round 2 queries: Deep dive based on gaps
 *
 * Uses LLM with gap analysis from Round 1 to generate targeted queries.
 * Pattern: Standard LLM invocation with context
 *
 * @param goal Research goal
 * @param gaps Gaps identified from Round 1
 * @param round1Context Context from Round 1 for reference
 * @returns Array of targeted deep-dive queries
 */
export async function generateRound2Queries(
  goal: string,
  gaps: string[],
  round1Context: { queries: string[]; sourceCount: number }
): Promise<string[]> {
  console.log("[Round2] Generating targeted deep-dive queries...");

  const llm = getLLM("generation");
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research query generator conducting Round 2 (Deep Dive) research.

CURRENT DATE: ${currentDate}

Your task: Generate 3-4 targeted queries to fill the knowledge gaps identified in Round 1.

Focus on:
- Specific details missing from Round 1
- Quantitative data (financials, metrics, statistics)
- Technical or operational specifics
- Recent developments or trends that need validation

IMPORTANT: Return ONLY a raw JSON array of query strings with no markdown formatting.
Example: ["query 1", "query 2", "query 3", "query 4"]`;

  const humanPrompt = `Research Goal: ${goal}

Round 1 Summary:
- Queries: ${round1Context.queries.join(", ")}
- Sources found: ${round1Context.sourceCount}

Identified Gaps:
${gaps.map((gap, i) => `${i + 1}. ${gap}`).join("\n")}

Generate ${MAX_QUERIES_ROUND_2} targeted queries to address these gaps.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const queries = extractQueriesFromText(response.content as string);
    console.log(`[Round2] Generated ${queries.length} queries:`, queries);
    return queries.slice(0, MAX_QUERIES_ROUND_2);
  } catch (error) {
    console.error("[Round2] Error generating queries:", error);
    // Fallback: Create queries from gaps
    return gaps.map((gap) => `${goal} ${gap}`).slice(0, MAX_QUERIES_ROUND_2);
  }
}

/**
 * Analyze Round 2 findings and identify remaining gaps
 *
 * Similar to Round 1 analysis but for Round 2 deep-dive findings.
 * Pattern: Standard LLM invocation for reasoning
 */
export async function analyzeRound2Gaps(
  goal: string,
  round2Queries: string[],
  round2SourceCount: number,
  totalSourceCount: number
): Promise<{ gaps: string[]; reasoning: string }> {
  console.log(
    "[Round2] Analyzing deep-dive findings to identify remaining gaps..."
  );

  const llm = getLLM("analysis");
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research analyst reviewing Round 2 (Deep Dive) findings.

CURRENT DATE: ${currentDate}

Your task: Analyze what has been covered so far and identify any remaining critical gaps.

After 2 rounds of research (broad + deep dive), consider:
- Are there contradictions that need validation?
- Are key claims properly supported?
- What final details would complete the picture?

Return a JSON object with:
{
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "reasoning": "Brief explanation of remaining gaps"
}`;

  const humanPrompt = `Research Goal: ${goal}

Round 2 Results:
- Executed ${round2Queries.length} targeted queries
- Found ${round2SourceCount} new sources
- Total sources so far: ${totalSourceCount}
- Queries: ${round2Queries.join(", ")}

What critical gaps remain for a comprehensive, validated report?`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const content = (response.content as string)
      .replace(MARKDOWN_CODE_BLOCK_REGEX, "")
      .trim();
    const parsed = JSON.parse(content);

    return {
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      reasoning: parsed.reasoning || "Remaining gaps identified",
    };
  } catch (error) {
    console.error("[Round2] Error analyzing gaps:", error);
    return {
      gaps: [
        "Validation of key claims",
        "Cross-referencing sources",
        "Final context verification",
      ],
      reasoning: "Fallback gap identification",
    };
  }
}

/**
 * Generate Round 3 queries: Validation and gap filling
 *
 * Uses LLM to generate final validation queries based on remaining gaps.
 * Pattern: Standard LLM invocation
 */
export async function generateRound3Queries(
  goal: string,
  gaps: string[],
  round2Context: { queries: string[]; sourceCount: number },
  totalSourceCount: number
): Promise<string[]> {
  console.log("[Round3] Generating validation queries...");

  const llm = getLLM("generation");
  const currentDate = getCurrentDateString();

  const systemPrompt = `You are a research query generator conducting Round 3 (Validation) research.

CURRENT DATE: ${currentDate}

Your task: Generate 2-3 validation queries to:
1. Cross-verify key findings
2. Fill any critical remaining gaps
3. Ensure comprehensive coverage

This is the final research round before synthesis.

IMPORTANT: Return ONLY a raw JSON array of query strings with no markdown formatting.
Example: ["query 1", "query 2", "query 3"]`;

  const humanPrompt = `Research Goal: ${goal}

Progress So Far:
- Total sources collected: ${totalSourceCount}
- Round 2 queries: ${round2Context.queries.join(", ")}

Remaining Gaps:
${gaps.map((gap, i) => `${i + 1}. ${gap}`).join("\n")}

Generate ${MAX_QUERIES_ROUND_3} validation queries for final round.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const queries = extractQueriesFromText(response.content as string);
    console.log(`[Round3] Generated ${queries.length} queries:`, queries);
    return queries.slice(0, MAX_QUERIES_ROUND_3);
  } catch (error) {
    console.error("[Round3] Error generating queries:", error);
    // Fallback: Create validation queries
    return gaps
      .map((gap) => `${goal} ${gap} validation`)
      .slice(0, MAX_QUERIES_ROUND_3);
  }
}
