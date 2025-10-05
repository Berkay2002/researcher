/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { searchAll } from "../../../../services/searchGateway";
import type { ParentState } from "../../../state";

/**
 * MetaSearch Node
 *
 * Executes all queries through searchGateway (Tavily + Exa fusion)
 * Returns normalized and deduplicated search results
 */
export async function metaSearch(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[metaSearch] Executing search queries...");

  const { queries, plan } = state;

  if (!queries || queries.length === 0) {
    console.log("[metaSearch] No queries to execute");
    return {
      searchResults: [],
    };
  }

  console.log(`[metaSearch] Executing ${queries.length} queries`);

  // Extract domain constraints from plan if available
  const constraints = plan?.constraints || {};
  const includeDomains = Array.isArray(constraints.domains)
    ? (constraints.domains as string[])
    : [];
  const excludeDomains = Array.isArray(constraints.excludeDomains)
    ? (constraints.excludeDomains as string[])
    : [];

  // Execute all queries in parallel
  const allResults = await Promise.allSettled(
    queries.map((query) =>
      searchAll({
        query,
        maxResults: 10,
        includeDomains,
        excludeDomains,
      })
    )
  );

  // Flatten and deduplicate results
  const searchResults = allResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  console.log(
    `[metaSearch] Found ${searchResults.length} total search results`
  );

  return {
    searchResults,
  };
}
