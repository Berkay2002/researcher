/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import type { ParentState } from "../../../state";

// Constants for query planning
const MIN_TERMS_FOR_VARIATIONS = 0;
const MAX_DOMAIN_QUERIES = 2;
const MAX_QUERIES = 10;
const MIN_WORD_LENGTH = 2;

// Top-level regex literals for performance
const NON_WORD_CLEAN_REGEX = /[^\w\s]/g;
const WORD_SPLIT_REGEX = /\s+/;

/**
 * QueryPlan Node
 *
 * Expands user goal into 5-10 focused search queries with domain scoping
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

  // Generate queries based on goal
  // For now, generate simple variations
  // In Phase 4+, this will use an LLM to generate sophisticated queries
  const queries = generateQueries(goal, constraints);

  console.log(`[queryPlan] Generated ${queries.length} queries:`, queries);

  return {
    queries,
  };
}

/**
 * Generate search queries from goal
 * TODO: Replace with LLM-based query generation in Phase 4
 */
function generateQueries(
  goal: string,
  constraints: Record<string, unknown>
): string[] {
  const queries: string[] = [];

  // Base query is the goal itself
  queries.push(goal);

  // Extract key terms from goal for variation
  const terms = extractKeyTerms(goal);

  // Add variations with different angles
  if (terms.length > MIN_TERMS_FOR_VARIATIONS) {
    // "What is" query
    queries.push(`what is ${terms[0]}`);

    // "How to" query
    queries.push(`how to ${terms.join(" ")}`);

    // "Best practices" query
    queries.push(`${terms.join(" ")} best practices`);

    // "Overview" query
    queries.push(`${terms.join(" ")} overview`);
  }

  // Add domain-specific queries if constraints specify domains
  if (constraints.domains && Array.isArray(constraints.domains)) {
    for (const domain of constraints.domains.slice(0, MAX_DOMAIN_QUERIES)) {
      queries.push(`${goal} site:${domain}`);
    }
  }

  // Add time-scoped query if constraints specify recency
  if (constraints.recent) {
    queries.push(`${goal} recent`);
    queries.push(`${goal} latest`);
  }

  // Limit to max queries
  return queries.slice(0, MAX_QUERIES);
}

/**
 * Extract key terms from goal for query variations
 */
function extractKeyTerms(goal: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "up",
    "about",
    "into",
    "through",
    "during",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "must",
    "can",
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
  ]);

  const words = goal
    .toLowerCase()
    .replace(NON_WORD_CLEAN_REGEX, "")
    .split(WORD_SPLIT_REGEX)
    .filter((word) => word.length > MIN_WORD_LENGTH && !stopWords.has(word));

  return words;
}
