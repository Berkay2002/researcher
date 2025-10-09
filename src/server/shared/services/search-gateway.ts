/** biome-ignore-all lint/suspicious/noConsole: <> */
import type { UnifiedSearchDoc } from "@/server/workflows/researcher/graph/state";
import { getExaClient } from "../tools/exa";
import { getTavilyClient } from "../tools/tavily";
import { shortHash } from "../utils/hashing";
import { createRateLimiter } from "../utils/rate-limiter";
import { dedupeKeyForUrl } from "../utils/url";

// Domain resolution utilities
const TOPIC_DOMAIN_MAP: Record<string, string[]> = {
  finance: ["reuters.com", "bloomberg.com", "wsj.com", "ft.com", "sec.gov"],
  technology: [
    "techcrunch.com",
    "arstechnica.com",
    "theverge.com",
    "wired.com",
  ],
  health: [
    "nih.gov",
    "who.int",
    "mayoclinic.org",
    "webmd.com",
    "healthline.com",
  ],
  science: [
    "nature.com",
    "science.org",
    "sciencedaily.com",
    "phys.org",
    "arxiv.org",
  ],
  news: ["reuters.com", "ap.org", "bbc.com", "npr.org", "cnn.com"],
};

/**
 * Resolve domain filters from topics or validate FQDNs
 */
function resolveDomainFilters(domains: string[]): string[] {
  const resolved: string[] = [];

  for (const domain of domains) {
    // Check if it's a topic
    if (TOPIC_DOMAIN_MAP[domain.toLowerCase()]) {
      resolved.push(...TOPIC_DOMAIN_MAP[domain.toLowerCase()]);
    } else if (domain.includes(".")) {
      // It's already a FQDN
      resolved.push(domain.toLowerCase());
    }
    // Skip invalid entries
  }

  return [...new Set(resolved)]; // Deduplicate
}

// Constants for search gateway configuration
const DEFAULT_MAX_RESULTS = 10;
const SEARCH_PROVIDERS_COUNT = 2;
const EXCERPT_LENGTH = 500;

// Rate limit constants
const EXA_REQUESTS_PER_SECOND = 5; // Exa's documented rate limit
const TAVILY_REQUESTS_PER_SECOND = 10; // Conservative preventive limit

// Rate limiters for API providers
const exaRateLimiter = createRateLimiter(
  EXA_REQUESTS_PER_SECOND,
  EXA_REQUESTS_PER_SECOND
);
const tavilyRateLimiter = createRateLimiter(
  TAVILY_REQUESTS_PER_SECOND,
  TAVILY_REQUESTS_PER_SECOND
);

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

  // Resolve domain filters
  const include = resolveDomainFilters(includeDomains);
  const exclude = resolveDomainFilters(excludeDomains);

  // Calculate results per provider (split evenly)
  const resultsPerProvider = Math.ceil(maxResults / SEARCH_PROVIDERS_COUNT);

  // Execute searches in parallel
  const [tavilyResults, exaResults] = await Promise.allSettled([
    searchTavily({
      query,
      maxResults: resultsPerProvider,
      includeDomains: include,
      excludeDomains: exclude,
      mode,
    }),
    searchExa({
      query,
      maxResults: resultsPerProvider,
      includeDomains: include,
      excludeDomains: exclude,
      mode,
    }),
  ]);

  // Combine results
  let combined: UnifiedSearchDoc[] = [];

  if (tavilyResults.status === "fulfilled") {
    combined.push(...tavilyResults.value);
  }

  if (exaResults.status === "fulfilled") {
    combined.push(...exaResults.value);
  }

  // Retry without filters if no results and we had include domains
  if (combined.length === 0 && include.length > 0) {
    console.warn(
      "[searchGateway] No results with domain filters - retrying without filters"
    );

    const retryResults = await Promise.allSettled([
      searchTavily({
        query,
        maxResults: resultsPerProvider,
        includeDomains: [],
        excludeDomains: exclude,
        mode,
      }),
      searchExa({
        query,
        maxResults: resultsPerProvider,
        includeDomains: [],
        excludeDomains: exclude,
        mode,
      }),
    ]);

    combined = [];
    if (retryResults[0].status === "fulfilled") {
      combined.push(...retryResults[0].value);
    }
    if (retryResults[1].status === "fulfilled") {
      combined.push(...retryResults[1].value);
    }
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
    // Apply rate limiting before making the API call
    return await tavilyRateLimiter.execute(async () => {
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
        publishedAt: r.publishedAt ?? null,
        providerScore: r.score,
        score: null, // Will be normalized later
        fetchedAt: new Date().toISOString(),
        sourceMeta: r, // Keep raw provider record
      }));
    });
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
    // Apply rate limiting before making the API call
    return await exaRateLimiter.execute(async () => {
      const exa = getExaClient();

      // Discovery mode: highlights only, no full content
      const searchOptions = {
        query,
        maxResults,
        includeDomains,
        excludeDomains,
        contents:
          mode === "discovery"
            ? {
                highlights: { numSentences: 1, highlightsPerUrl: 1 },
              }
            : undefined,
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
        publishedAt: r.publishedAt ?? null,
        providerScore: r.score,
        score: null, // Will be normalized later
        fetchedAt: new Date().toISOString(),
        sourceMeta: r, // Keep raw provider record
      }));
    });
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
    // Apply rate limiting before making the API call
    return await tavilyRateLimiter.execute(async () => {
      const tavily = getTavilyClient();
      const extracted = await tavily.extract(urls);

      return extracted.map((r) => ({
        id: shortHash(r.url),
        provider: "tavily" as const,
        query: r.url,
        url: r.url,
        hostname: new URL(r.url).hostname,
        title: r.title ?? null,
        excerpt: r.raw_content ? r.raw_content.slice(0, EXCERPT_LENGTH) : null,
        content: r.raw_content ?? null,
        publishedAt: r.published_date ?? null,
        providerScore: null,
        score: null,
        fetchedAt: new Date().toISOString(),
        sourceMeta: r, // Keep raw provider record
      }));
    });
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
    // Apply rate limiting before making the API call
    return await exaRateLimiter.execute(async () => {
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
        publishedAt: result.publishedDate ?? null,
        providerScore: result.score,
        score: null,
        fetchedAt: new Date().toISOString(),
        sourceMeta: result, // Keep raw provider record
      }));
    });
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
    // Use dedupeKeyForUrl for pre-fetch deduplication
    const dedupeKey = dedupeKeyForUrl(result.url);
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      unique.push(result);
    }
  }

  return unique;
}
