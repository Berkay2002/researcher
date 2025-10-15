/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { searchAll } from "@/server/shared/services/search-gateway";
import type { ParentState } from "../../../state";

// Constants for rate limiting
const BATCH_SIZE = 5; // Exa has a 5 req/sec limit
const BATCH_DELAY_MS = 1000; // 1 second between batches
const MAX_RESULTS_PER_QUERY = 10;

// Regex for URL normalization (defined at top level to avoid performance issues)
const TRAILING_SLASH_REGEX = /\/+$/u;

/**
 * MetaSearch Node
 *
 * Executes all queries through searchGateway (Tavily + Exa fusion)
 * Returns normalized and deduplicated search results
 *
 * Rate limiting: Batches queries to respect Exa's 5 req/sec limit
 */
export async function metaSearch(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[metaSearch] Executing search queries...");

  const { queries, plan } = state;

  if (!queries || queries.length === 0) {
    console.log("[metaSearch] No queries to execute");
    return {
      research: {
        ...(state.research ?? {}),
        discovery: [],
      },
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

  // Batch queries to respect Exa's 5 req/sec rate limit
  // Execute in batches of 5 with 1-second delay between batches
  const allResults: PromiseSettledResult<
    Awaited<ReturnType<typeof searchAll>>
  >[] = [];

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    console.log(
      `[metaSearch] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(queries.length / BATCH_SIZE)} (${batch.length} queries)`
    );

    // Execute batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map((query) =>
        searchAll({
          query,
          maxResults: MAX_RESULTS_PER_QUERY,
          includeDomains,
          excludeDomains,
        })
      )
    );

    allResults.push(...batchResults);

    // Add delay between batches (except after last batch)
    if (i + BATCH_SIZE < queries.length) {
      console.log(
        `[metaSearch] Waiting ${BATCH_DELAY_MS}ms before next batch...`
      );
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Flatten and deduplicate results
  const unifiedDocs = allResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  // Optional: de-dupe across queries by normalized URL
  const seen = new Set<string>();
  const discovery = unifiedDocs.filter((d) => {
    const key = d.url.toLowerCase().replace(TRAILING_SLASH_REGEX, "");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  console.log(`[metaSearch] Found ${discovery.length} total discovery docs`);

  // Write to parent research slice (unified format)
  return {
    research: {
      ...(state.research ?? {}),
      discovery,
    },
  };
}
