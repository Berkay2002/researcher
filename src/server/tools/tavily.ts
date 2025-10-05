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
};

// ============================================================================
// Tavily Search Result (Normalized)
// ============================================================================

export type TavilySearchResult = {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
  source: "tavily";
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
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          include_domains:
            includeDomains.length > 0 ? includeDomains : undefined,
          exclude_domains:
            excludeDomains.length > 0 ? excludeDomains : undefined,
          include_raw_content: false,
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
   * Normalize Tavily result to common format
   */
  private normalizeResult(result: TavilyResult): TavilySearchResult {
    return {
      url: result.url,
      title: result.title,
      snippet: result.content.slice(0, MAX_SNIPPET_LENGTH), // Limit snippet length
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
