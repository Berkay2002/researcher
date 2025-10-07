import type { Evidence, SearchResult, UnifiedSearchDoc } from "../graph/state";
import { hashContent } from "../utils/hashing";
import { chunkText } from "../utils/text";
import { dedupeKeyForUrl, getRobotsTxtUrl, isValidUrl } from "../utils/url";

// Constants for harvest configuration
const DEFAULT_TIMEOUT_MS = 10_000;
const ROBOTS_TXT_TIMEOUT_MS = 5000;
const MIN_CONTENT_LENGTH = 100;
const MAX_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP_SIZE = 100;
const USER_AGENT_SLICE_OFFSET = 11;
const DISALLOW_SLICE_OFFSET = 9;
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;
const EXCERPT_LENGTH = 500;

// Regex patterns (defined at top level for performance)
const CANONICAL_URL_REGEX =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i;
const TITLE_REGEX = /<title[^>]*>([^<]+)<\/title>/i;

/**
 * Harvest options
 */
export type HarvestOptions = {
  /** Maximum time to wait for fetch (ms) */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Whether to respect robots.txt */
  respectRobotsTxt?: boolean;
};

/**
 * Harvest full content from search results
 */
export async function harvestResults(
  results: SearchResult[],
  options: HarvestOptions = {}
): Promise<Evidence[]> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    userAgent = "ResearchAssistant/1.0 (Educational)",
    respectRobotsTxt = true,
  } = options;

  // Harvest in parallel with Promise.allSettled to handle failures gracefully
  const harvested = await Promise.allSettled(
    results.map((result) =>
      harvestSingle(result, { timeout, userAgent, respectRobotsTxt })
    )
  );

  // Filter successful harvests
  const evidence: Evidence[] = [];
  for (const result of harvested) {
    if (result.status === "fulfilled" && result.value !== null) {
      evidence.push(result.value);
    }
  }

  return evidence;
}

/**
 * Harvest single URL
 */
async function harvestSingle(
  result: SearchResult,
  options: Required<HarvestOptions>
): Promise<Evidence | null> {
  const { url, title, snippet, source } = result;

  // Validate URL
  if (!isValidUrl(url)) {
    return null;
  }

  // Check robots.txt if enabled
  if (options.respectRobotsTxt) {
    const allowed = await checkRobotsTxt(url, options.userAgent);
    if (!allowed) {
      return null;
    }
  }

  // Fetch content with timeout and capture URL resolution info
  const fetchResult = await fetchWithTimeout(
    url,
    options.timeout,
    options.userAgent
  );
  if (!fetchResult.content) {
    return null;
  }

  // Extract text content
  const text = extractTextContent(fetchResult.content);
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    // Skip if too little content
    return null;
  }

  // Generate content hash
  const contentHash = hashContent(text);

  // Chunk the text
  const chunks = chunkText(text, {
    maxChunkSize: MAX_CHUNK_SIZE,
    overlapSize: CHUNK_OVERLAP_SIZE,
  });

  return {
    url,
    title,
    snippet,
    contentHash,
    chunks,
    source,
    // URL resolution fields for post-fetch deduplication
    resolvedUrl: fetchResult.resolvedUrl,
    canonicalUrl: fetchResult.canonicalUrl,
  };
}

/**
 * Fetch URL content with timeout and capture redirect information
 */
async function fetchWithTimeout(
  url: string,
  timeout: number,
  userAgent: string
): Promise<{
  content: string | null;
  resolvedUrl: string | null;
  canonicalUrl: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
      },
      signal: controller.signal,
      redirect: "manual", // Don't follow redirects automatically
    });

    clearTimeout(timeoutId);

    // Handle redirects manually to capture the final URL
    let resolvedUrl = url;
    let finalResponse = response;

    if (
      response.status >= HTTP_REDIRECT_MIN &&
      response.status <= HTTP_REDIRECT_MAX
    ) {
      const location = response.headers.get("location");
      if (location) {
        // Resolve relative URL if needed
        const baseUrl = new URL(url);
        resolvedUrl = new URL(location, baseUrl).toString();

        // Fetch the final URL
        finalResponse = await fetch(resolvedUrl, {
          headers: {
            "User-Agent": userAgent,
          },
        });
      }
    }

    if (!finalResponse.ok) {
      return { content: null, resolvedUrl, canonicalUrl: null };
    }

    // Check content type
    const contentType = finalResponse.headers.get("content-type") || "";
    const isHtmlOrPlainText =
      contentType.includes("text/html") || contentType.includes("text/plain");
    if (!isHtmlOrPlainText) {
      return { content: null, resolvedUrl, canonicalUrl: null };
    }

    const content = await finalResponse.text();

    // Extract canonical URL from HTML if present
    const canonicalUrl = extractCanonicalUrl(content);

    return { content, resolvedUrl, canonicalUrl };
  } catch {
    // Handle timeout, network errors, etc.
    return { content: null, resolvedUrl: null, canonicalUrl: null };
  }
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html: string): string {
  // Simple HTML tag removal (for production, use a proper HTML parser)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract canonical URL from HTML content
 */
function extractCanonicalUrl(html: string): string | null {
  const canonicalMatch = html.match(CANONICAL_URL_REGEX);
  if (canonicalMatch?.[1]) {
    try {
      // Validate that it's a valid URL
      new URL(canonicalMatch[1]);
      return canonicalMatch[1];
    } catch {
      // Invalid URL, ignore
    }
  }
  return null;
}

/**
 * Harvest single URL for UnifiedSearchDoc (new implementation)
 */
export async function harvestUnifiedDoc(
  url: string,
  options: HarvestOptions = {}
): Promise<UnifiedSearchDoc | null> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    userAgent = "ResearchAssistant/1.0 (Educational)",
    respectRobotsTxt = true,
  } = options;

  // Validate URL
  if (!isValidUrl(url)) {
    return null;
  }

  // Check robots.txt if enabled
  if (respectRobotsTxt) {
    const allowed = await checkRobotsTxt(url, userAgent);
    if (!allowed) {
      return null;
    }
  }

  // Fetch content with timeout and capture URL resolution info
  const fetchResult = await fetchWithTimeout(url, timeout, userAgent);
  if (!fetchResult.content) {
    return null;
  }

  // Extract text content
  const text = extractTextContent(fetchResult.content);
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    // Skip if too little content
    return null;
  }

  // Extract title from HTML
  const title = extractTitle(fetchResult.content) || url;

  // Create excerpt from first part of text
  const excerpt = text.slice(0, EXCERPT_LENGTH);

  // Generate normalized key for post-fetch deduplication
  const finalUrl = fetchResult.canonicalUrl || fetchResult.resolvedUrl || url;
  const normalizedKey = dedupeKeyForUrl(finalUrl);

  return {
    id: hashContent(text),
    provider: "tavily" as const, // Use tavily as default provider
    query: url,
    url,
    hostname: new URL(url).hostname,
    title,
    excerpt,
    content: text,
    resolvedUrl: fetchResult.resolvedUrl,
    canonicalUrl: fetchResult.canonicalUrl,
    normalizedKey,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Extract title from HTML content
 */
function extractTitle(html: string): string | null {
  const titleMatch = html.match(TITLE_REGEX);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Check robots.txt for URL allowance
 */
async function checkRobotsTxt(
  url: string,
  userAgent: string
): Promise<boolean> {
  try {
    const robotsTxtUrl = getRobotsTxtUrl(url);
    if (!robotsTxtUrl) {
      return true; // Allow if can't determine robots.txt URL
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ROBOTS_TXT_TIMEOUT_MS
    );

    const response = await fetch(robotsTxtUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return true; // Allow if robots.txt doesn't exist
    }

    const robotsTxt = await response.text();

    // Simple robots.txt parser - look for Disallow directives
    // For production, use a proper robots.txt parser library
    const lines = robotsTxt.split("\n");
    let relevantSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("User-agent:")) {
        const agent = trimmed.slice(USER_AGENT_SLICE_OFFSET).trim();
        relevantSection = agent === "*" || agent === userAgent;
      }

      if (relevantSection && trimmed.startsWith("Disallow:")) {
        const path = trimmed.slice(DISALLOW_SLICE_OFFSET).trim();
        if (path === "/" || url.includes(path)) {
          return false; // Disallowed
        }
      }
    }

    return true; // Allowed
  } catch {
    return true; // Allow on error
  }
}
