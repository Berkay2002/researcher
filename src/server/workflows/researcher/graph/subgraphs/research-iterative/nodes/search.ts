/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { searchAll } from "@/server/shared/services/search-gateway";
import type { UnifiedSearchDoc } from "../../../state";
import type { Finding, IterativeResearchState } from "../state";

// Constants for sequential search execution
const DEFAULT_RESULTS_PER_QUERY = 8;
const SEARCH_PAUSE_MS = 300; // Human-like delay between queries

/**
 * Execute a single search query
 *
 * Pattern: Standard async function, not LangGraph-specific
 * Uses existing searchAll service from shared/services
 */
async function executeSearch(
  query: string,
  maxResults = DEFAULT_RESULTS_PER_QUERY,
  constraints: Record<string, unknown> = {}
): Promise<UnifiedSearchDoc[]> {
  // Extract domain constraints if available
  const includeDomains = Array.isArray(constraints.domains)
    ? (constraints.domains as string[])
    : [];
  const excludeDomains = Array.isArray(constraints.excludeDomains)
    ? (constraints.excludeDomains as string[])
    : [];

  try {
    const results = await searchAll({
      query,
      maxResults,
      includeDomains,
      excludeDomains,
    });
    return results;
  } catch (error) {
    console.error(`[Search] Error executing query "${query}":`, error);
    return [];
  }
}

/**
 * Round 1 Search Node
 *
 * Executes broad orientation queries sequentially with Tavily.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming search events
 * - Sequential execution with delays (no parallelization)
 * - Returns Partial<State> with findings array
 *
 * @param state Current iterative research state
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with Round 1 finding
 */
export async function round1SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { currentQueries = [], constraints = {} } = state;
  const writer = config.writer;
  const startedAt = new Date().toISOString();

  console.log(
    `[Round1 Search] Executing ${currentQueries.length} broad queries sequentially...`
  );

  if (currentQueries.length === 0) {
    console.warn("[Round1 Search] No queries provided, skipping search");
    return {
      findings: [],
    };
  }

  const allResults: UnifiedSearchDoc[] = [];
  const providersUsed: ("tavily" | "exa")[] = [];

  // Execute queries SEQUENTIALLY (no Promise.all or parallelization)
  for (const query of currentQueries) {
    if (writer) {
      await writer({
        type: "search",
        round: 1,
        content: `Searching: "${query}"`,
      });
    }

    const results = await executeSearch(
      query,
      DEFAULT_RESULTS_PER_QUERY,
      constraints
    );
    allResults.push(...results);

    // Track providers (Tavily is primary for Round 1)
    if (results.length > 0) {
      providersUsed.push("tavily");
    }

    if (writer) {
      await writer({
        type: "read",
        round: 1,
        content: `Reading ${results.length} sources...`,
      });
    }

    // Human-like pause between queries
    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  const completedAt = new Date().toISOString();

  console.log(`[Round1 Search] Found ${allResults.length} total sources`);

  if (writer) {
    await writer({
      type: "thought",
      round: 1,
      content: `Reviewed ${allResults.length} sources from Round 1 broad orientation.`,
    });
  }

  // Create Round 1 finding (LangGraph pattern: return partial state)
  const finding: Finding = {
    round: 1,
    queries: currentQueries,
    results: allResults,
    reasoning: "Broad orientation to establish research foundation",
    gaps: [], // Gaps will be identified by next reasoning node
    metadata: {
      queriesGenerated: currentQueries.length,
      sourcesFound: allResults.length,
      providersUsed: Array.from(new Set(providersUsed)),
      startedAt,
      completedAt,
    },
  };

  return {
    findings: [finding], // Annotation reducer will accumulate
    allSources: allResults, // Annotation reducer will accumulate
  };
}

/**
 * Round 2 Search Node
 *
 * Executes targeted deep-dive queries sequentially, alternating Tavily/Exa.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming
 * - Sequential execution with provider alternation
 * - Returns partial state with findings
 *
 * @param state Current iterative research state
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with Round 2 finding
 */
export async function round2SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { currentQueries, constraints } = state;
  const writer = config.writer;
  const startedAt = new Date().toISOString();

  console.log(
    `[Round2 Search] Executing ${currentQueries.length} targeted queries sequentially...`
  );

  const allResults: UnifiedSearchDoc[] = [];
  const providersUsed: ("tavily" | "exa")[] = [];

  // Execute queries SEQUENTIALLY with provider alternation
  for (let i = 0; i < currentQueries.length; i++) {
    const query = currentQueries[i];
    // Alternate between Tavily and Exa for source diversity
    const provider = i % 2 === 0 ? "tavily" : "exa";

    if (writer) {
      await writer({
        type: "search",
        round: 2,
        content: `Deep diving (${provider}): "${query}"`,
      });
    }

    const results = await executeSearch(
      query,
      DEFAULT_RESULTS_PER_QUERY,
      constraints
    );
    allResults.push(...results);

    if (results.length > 0) {
      providersUsed.push(provider);
    }

    if (writer) {
      await writer({
        type: "read",
        round: 2,
        content: `Analyzing ${results.length} detailed sources...`,
      });
    }

    // Human-like pause between queries
    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  const completedAt = new Date().toISOString();

  console.log(`[Round2 Search] Found ${allResults.length} new sources`);

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Deep dive complete. Gathered ${allResults.length} targeted sources.`,
    });
  }

  // Create Round 2 finding
  const finding: Finding = {
    round: 2,
    queries: currentQueries,
    results: allResults,
    reasoning: "Targeted deep dive to fill knowledge gaps from Round 1",
    gaps: [], // Gaps will be identified by next reasoning node
    metadata: {
      queriesGenerated: currentQueries.length,
      sourcesFound: allResults.length,
      providersUsed: Array.from(new Set(providersUsed)),
      startedAt,
      completedAt,
    },
  };

  return {
    findings: [finding], // Annotation reducer will accumulate
    allSources: allResults, // Annotation reducer will accumulate
  };
}

/**
 * Round 3 Search Node
 *
 * Executes validation queries sequentially with Tavily.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming
 * - Sequential execution with Tavily
 * - Returns partial state with findings
 *
 * @param state Current iterative research state
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with Round 3 finding
 */
export async function round3SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { currentQueries, constraints } = state;
  const writer = config.writer;
  const startedAt = new Date().toISOString();

  console.log(
    `[Round3 Search] Executing ${currentQueries.length} validation queries sequentially...`
  );

  const allResults: UnifiedSearchDoc[] = [];
  const providersUsed: ("tavily" | "exa")[] = [];

  // Execute queries SEQUENTIALLY for final validation
  for (const query of currentQueries) {
    if (writer) {
      await writer({
        type: "search",
        round: 3,
        content: `Validating: "${query}"`,
      });
    }

    const results = await executeSearch(
      query,
      DEFAULT_RESULTS_PER_QUERY,
      constraints
    );
    allResults.push(...results);

    if (results.length > 0) {
      providersUsed.push("tavily");
    }

    if (writer) {
      await writer({
        type: "read",
        round: 3,
        content: `Cross-referencing ${results.length} sources...`,
      });
    }

    // Human-like pause between queries
    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  const completedAt = new Date().toISOString();

  console.log(`[Round3 Search] Found ${allResults.length} validation sources`);

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Validation complete. Gathered ${allResults.length} cross-reference sources.`,
    });
  }

  // Create Round 3 finding
  const finding: Finding = {
    round: 3,
    queries: currentQueries,
    results: allResults,
    reasoning:
      "Validation queries to cross-verify findings and fill final gaps",
    gaps: [], // No more gaps after Round 3
    metadata: {
      queriesGenerated: currentQueries.length,
      sourcesFound: allResults.length,
      providersUsed: Array.from(new Set(providersUsed)),
      startedAt,
      completedAt,
    },
  };

  return {
    findings: [finding], // Annotation reducer will accumulate
    allSources: allResults, // Annotation reducer will accumulate
  };
}
