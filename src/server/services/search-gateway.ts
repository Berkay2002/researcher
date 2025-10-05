import type { SearchResult } from "../graph/state";
import { getExaClient } from "../tools/exa";
import { getTavilyClient } from "../tools/tavily";
import { normalizeUrl } from "../utils/url";

// Constants for search gateway configuration
const DEFAULT_MAX_RESULTS = 10;
const SEARCH_PROVIDERS_COUNT = 2;

/**
 * Search gateway options
 */
export type SearchGatewayOptions = {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
};

/**
 * Search across Tavily and Exa in parallel
 * Returns normalized and deduplicated results
 */
export async function searchAll(
  options: SearchGatewayOptions
): Promise<SearchResult[]> {
  const {
    query,
    maxResults = DEFAULT_MAX_RESULTS,
    includeDomains = [],
    excludeDomains = [],
  } = options;

  // Calculate results per provider (split evenly)
  const resultsPerProvider = Math.ceil(maxResults / SEARCH_PROVIDERS_COUNT);

  // Execute searches in parallel
  const [tavilyResults, exaResults] = await Promise.allSettled([
    searchTavily(query, resultsPerProvider, includeDomains, excludeDomains),
    searchExa(query, resultsPerProvider, includeDomains, excludeDomains),
  ]);

  // Combine results
  const combined: SearchResult[] = [];

  if (tavilyResults.status === "fulfilled") {
    combined.push(...tavilyResults.value);
  }

  if (exaResults.status === "fulfilled") {
    combined.push(...exaResults.value);
  }

  // Deduplicate by normalized URL
  const deduped = deduplicateByUrl(combined);

  // Limit to maxResults
  return deduped.slice(0, maxResults);
}

/**
 * Search using Tavily
 */
async function searchTavily(
  query: string,
  maxResults: number,
  includeDomains: string[],
  excludeDomains: string[]
): Promise<SearchResult[]> {
  try {
    const tavily = getTavilyClient();
    const results = await tavily.search({
      query,
      maxResults,
      includeDomains,
      excludeDomains,
    });

    return results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      publishedAt: r.publishedAt,
      source: "tavily" as const,
    }));
  } catch (error) {
    // Log error but don't throw - allow other provider to succeed
    // biome-ignore lint/suspicious/noConsole: Error logging for development
    console.error("[searchGateway] Tavily search failed:", error);
    return [];
  }
}

/**
 * Search using Exa
 */
async function searchExa(
  query: string,
  maxResults: number,
  includeDomains: string[],
  excludeDomains: string[]
): Promise<SearchResult[]> {
  try {
    const exa = getExaClient();
    const results = await exa.search({
      query,
      maxResults,
      includeDomains,
      excludeDomains,
    });

    return results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      publishedAt: r.publishedAt,
      source: "exa" as const,
    }));
  } catch (error) {
    // Log error but don't throw - allow other provider to succeed
    // biome-ignore lint/suspicious/noConsole: Error logging for development
    console.error("[searchGateway] Exa search failed:", error);
    return [];
  }
}

/**
 * Deduplicate search results by normalized URL
 */
function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }

  return unique;
}
