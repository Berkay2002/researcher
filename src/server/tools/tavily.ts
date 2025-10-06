import { z } from "zod";

// ============================================================================
// Tavily API Types
// ============================================================================

const TavilyResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  content: z.string(),
  published_date: z.string().optional(),
  score: z.number().optional(),
});

const TavilyResponseSchema = z.object({
  results: z.array(TavilyResultSchema),
});

type TavilyResult = z.infer<typeof TavilyResultSchema>;

// ============================================================================
// Tavily Search Options
// ============================================================================

export type TavilySearchOptions = {
  query: string;
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeDomains?: string[];
  excludeDomains?: string[];
  includeRawContent?: boolean | "markdown" | "text";
};

// ============================================================================
// Tavily Search Result (Normalized)
// ============================================================================

export type TavilySearchResult = {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  publishedAt?: string;
  score?: number;
  source: "tavily";
};

export type TavilyExtractResult = {
  url: string;
  title?: string;
  raw_content?: string;
  published_date?: string;
  images?: string[];
  favicon?: string;
};

// ============================================================================
// Constants
// ============================================================================

const MAX_SNIPPET_LENGTH = 500;

// ============================================================================
// Tavily API Client
// ============================================================================

export class TavilyClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.tavily.com";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Search using Tavily API
   */
  async search(options: TavilySearchOptions): Promise<TavilySearchResult[]> {
    const {
      query,
      maxResults = 10,
      searchDepth = "basic",
      includeDomains = [],
      excludeDomains = [],
      includeRawContent = false,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          include_domains:
            includeDomains.length > 0 ? includeDomains : undefined,
          exclude_domains:
            excludeDomains.length > 0 ? excludeDomains : undefined,
          include_raw_content: includeRawContent,
          include_images: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const parsed = TavilyResponseSchema.parse(data);

      return parsed.results.map((result) => this.normalizeResult(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Tavily response validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract content from specific URLs
   */
  async extract(
    urls: string[] | string,
    opts?: {
      format?: "markdown" | "text";
      extractDepth?: "basic" | "advanced";
      includeImages?: boolean;
      includeFavicon?: boolean;
      timeout?: number; // seconds, 1–60
    }
  ): Promise<TavilyExtractResult[]> {
    const urlList = Array.isArray(urls) ? urls : [urls];

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          urls: urlList,
          format: opts?.format ?? "markdown",
          extract_depth: opts?.extractDepth ?? "basic",
          include_images: opts?.includeImages ?? false,
          include_favicon: opts?.includeFavicon ?? false,
          timeout: opts?.timeout,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Tavily Extract API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      return data.results as TavilyExtractResult[];
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Error logging for development
      console.error("[TavilyClient] Extract failed:", error);
      throw error;
    }
  }

  /**
   * Normalize Tavily result to common format
   */
  private normalizeResult(result: TavilyResult): TavilySearchResult {
    return {
      url: result.url,
      title: result.title,
      snippet: result.content.slice(0, MAX_SNIPPET_LENGTH), // Limit snippet length
      content: result.content, // Full content if includeRawContent was true
      publishedAt: result.published_date,
      score: result.score,
      source: "tavily",
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let tavilyClientInstance: TavilyClient | null = null;

export function getTavilyClient(): TavilyClient {
  if (!tavilyClientInstance) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }
    tavilyClientInstance = new TavilyClient(apiKey);
  }
  return tavilyClientInstance;
}
