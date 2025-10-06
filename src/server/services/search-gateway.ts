/** biome-ignore-all lint/suspicious/noConsole: <> */
import type { UnifiedSearchDoc } from "../graph/state";
import { getExaClient } from "../tools/exa";
import { getTavilyClient } from "../tools/tavily";
import { shortHash } from "../utils/hashing";
import { normalizeUrl } from "../utils/url";

// Constants for search gateway configuration
const DEFAULT_MAX_RESULTS = 10;
const SEARCH_PROVIDERS_COUNT = 2;
const EXCERPT_LENGTH = 500;

/**
 * Search gateway mode for two-pass search architecture
 */
export type SearchMode = "discovery" | "enrich";

/**
 * Search gateway options
 */
export type SearchGatewayOptions = {
  query?: string;
  urls?: string[];
  mode?: SearchMode;
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
): Promise<UnifiedSearchDoc[]> {
  const {
    query,
    urls,
    mode = "discovery",
    maxResults = DEFAULT_MAX_RESULTS,
    includeDomains = [],
    excludeDomains = [],
  } = options;

  // Handle enrich mode - fetch content for specific URLs
  if (mode === "enrich" && urls && urls.length > 0) {
    return enrichUrls(urls);
  }

  // Handle discovery mode - search with query
  if (!query) {
    throw new Error("Query is required for discovery mode");
  }

  // Calculate results per provider (split evenly)
  const resultsPerProvider = Math.ceil(maxResults / SEARCH_PROVIDERS_COUNT);

  // Execute searches in parallel
  const [tavilyResults, exaResults] = await Promise.allSettled([
    searchTavily({
      query,
      maxResults: resultsPerProvider,
      includeDomains,
      excludeDomains,
      mode,
    }),
    searchExa({
      query,
      maxResults: resultsPerProvider,
      includeDomains,
      excludeDomains,
      mode,
    }),
  ]);

  // Combine results
  const combined: UnifiedSearchDoc[] = [];

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
 * Enrich specific URLs with full content
 */
async function enrichUrls(urls: string[]): Promise<UnifiedSearchDoc[]> {
  const results: UnifiedSearchDoc[] = [];

  // Process URLs in parallel
  const enrichedResults = await Promise.allSettled([
    enrichUrlsTavily(urls),
    enrichUrlsExa(urls),
  ]);

  if (enrichedResults[0].status === "fulfilled") {
    results.push(...enrichedResults[0].value);
  }

  if (enrichedResults[1].status === "fulfilled") {
    results.push(...enrichedResults[1].value);
  }

  return results;
}

/**
 * Search using Tavily
 */
type SearchTavilyOptions = {
  query: string;
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  mode: SearchMode;
};

async function searchTavily(
  options: SearchTavilyOptions
): Promise<UnifiedSearchDoc[]> {
  const { query, maxResults, includeDomains, excludeDomains, mode } = options;
  try {
    const tavily = getTavilyClient();

    // Discovery mode: advanced depth, no raw content
    // Enrich mode: not used for search, only for content fetching
    const searchOptions = {
      query,
      maxResults,
      includeDomains,
      excludeDomains,
      searchDepth: (mode === "discovery" ? "advanced" : "basic") as
        | "basic"
        | "advanced",
      includeRawContent: false,
    };

    const results = await tavily.search(searchOptions);

    return results.map((r) => ({
      id: shortHash(r.url),
      provider: "tavily" as const,
      query,
      url: r.url,
      hostname: new URL(r.url).hostname,
      title: r.title,
      excerpt: r.snippet,
      content: null, // No full content in discovery mode
      publishedAt: r.publishedAt,
      providerScore: r.score,
      score: null, // Will be normalized later
      fetchedAt: new Date().toISOString(),
      sourceMeta: {},
    }));
  } catch (error) {
    // Log error but don't throw - allow other provider to succeed
    console.error("[searchGateway] Tavily search failed:", error);
    return [];
  }
}

/**
 * Search using Exa
 */
type SearchExaOptions = {
  query: string;
  maxResults: number;
  includeDomains: string[];
  excludeDomains: string[];
  mode: SearchMode;
};

async function searchExa(
  options: SearchExaOptions
): Promise<UnifiedSearchDoc[]> {
  const { query, maxResults, includeDomains, excludeDomains, mode } = options;
  try {
    const exa = getExaClient();

    // Discovery mode: highlights only, no full content
    const searchOptions = {
      query,
      maxResults,
      includeDomains,
      excludeDomains,
      text: mode === "discovery" ? { maxCharacters: 500 } : undefined,
    };

    const results = await exa.search(searchOptions);

    return results.map((r) => ({
      id: shortHash(r.url),
      provider: "exa" as const,
      query,
      url: r.url,
      hostname: new URL(r.url).hostname,
      title: r.title,
      excerpt: r.snippet,
      content: null, // No full content in discovery mode
      publishedAt: r.publishedAt,
      providerScore: r.score,
      score: null, // Will be normalized later
      fetchedAt: new Date().toISOString(),
      sourceMeta: {},
    }));
  } catch (error) {
    console.error("[searchGateway] Exa search failed:", error);
    return [];
  }
}

/**
 * Enrich URLs using Tavily (fetch full content)
 */
async function enrichUrlsTavily(urls: string[]): Promise<UnifiedSearchDoc[]> {
  try {
    const tavily = getTavilyClient();
    const results: UnifiedSearchDoc[] = [];

    // Process URLs in batches to avoid rate limits
    for (const url of urls) {
      try {
        const searchResults = await tavily.search({
          query: url, // Use URL as query to get specific content
          maxResults: 1,
          searchDepth: "basic",
          includeRawContent: true,
        });

        if (searchResults.length > 0) {
          const result = searchResults[0];
          results.push({
            id: shortHash(result.url),
            provider: "tavily" as const,
            query: url,
            url: result.url,
            hostname: new URL(result.url).hostname,
            title: result.title,
            excerpt: result.snippet,
            content: result.content || null,
            publishedAt: result.publishedAt,
            providerScore: result.score,
            score: null,
            fetchedAt: new Date().toISOString(),
            sourceMeta: {},
          });
        }
      } catch (error) {
        console.error(
          `[searchGateway] Tavily enrichment failed for ${url}:`,
          error
        );
      }
    }

    return results;
  } catch (error) {
    console.error("[searchGateway] Tavily enrichment failed:", error);
    return [];
  }
}

/**
 * Enrich URLs using Exa (fetch full content)
 */
async function enrichUrlsExa(urls: string[]): Promise<UnifiedSearchDoc[]> {
  try {
    const exa = getExaClient();

    // Use Exa's contents endpoint for full text
    const results = await exa.getContents(urls, {
      text: true,
    });

    return results.map((result) => ({
      id: shortHash(result.url),
      provider: "exa" as const,
      query: result.url,
      url: result.url,
      hostname: new URL(result.url).hostname,
      title: result.title,
      excerpt: result.text?.slice(0, EXCERPT_LENGTH) || null,
      content: result.text || null,
      publishedAt: result.publishedDate,
      providerScore: result.score,
      score: null,
      fetchedAt: new Date().toISOString(),
      sourceMeta: {},
    }));
  } catch (error) {
    console.error("[searchGateway] Exa enrichment failed:", error);
    return [];
  }
}

/**
 * Deduplicate search results by normalized URL
 */
function deduplicateByUrl(results: UnifiedSearchDoc[]): UnifiedSearchDoc[] {
  const seen = new Set<string>();
  const unique: UnifiedSearchDoc[] = [];

  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }

  return unique;
}
