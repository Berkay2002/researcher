import { z } from "zod";

// ============================================================================
// Exa API Types
// ============================================================================

const ExaResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  text: z.string().optional(),
  publishedDate: z.string().optional(),
  score: z.number().optional(),
});

const ExaResponseSchema = z.object({
  results: z.array(ExaResultSchema),
});

type ExaResult = z.infer<typeof ExaResultSchema>;

// ============================================================================
// Exa Search Options
// ============================================================================

export type ExaSearchOptions = {
  query: string;
  maxResults?: number;
  type?: "keyword" | "neural" | "auto";
  category?: "company" | "research paper" | "news" | "pdf" | "tweet";
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
};

// ============================================================================
// Exa Search Result (Normalized)
// ============================================================================

export type ExaSearchResult = {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
  source: "exa";
};

// ============================================================================
// Constants
// ============================================================================

const MAX_SNIPPET_LENGTH = 500;

// ============================================================================
// Exa API Client
// ============================================================================

export class ExaClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.exa.ai";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("EXA_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Search using Exa API
   */
  async search(options: ExaSearchOptions): Promise<ExaSearchResult[]> {
    const {
      query,
      maxResults = 10,
      type = "auto",
      category,
      includeDomains = [],
      excludeDomains = [],
      startPublishedDate,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          query,
          num_results: maxResults,
          type,
          category,
          include_domains:
            includeDomains.length > 0 ? includeDomains : undefined,
          exclude_domains:
            excludeDomains.length > 0 ? excludeDomains : undefined,
          start_published_date: startPublishedDate,
          use_autoprompt: true,
          text: {
            max_characters: 500,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Exa API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const parsed = ExaResponseSchema.parse(data);

      return parsed.results.map((result) => this.normalizeResult(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Exa response validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Normalize Exa result to common format
   */
  private normalizeResult(result: ExaResult): ExaSearchResult {
    return {
      url: result.url,
      title: result.title,
      snippet: result.text?.slice(0, MAX_SNIPPET_LENGTH) || "", // Limit snippet length
      publishedAt: result.publishedDate,
      score: result.score,
      source: "exa",
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let exaClientInstance: ExaClient | null = null;

export function getExaClient(): ExaClient {
  if (!exaClientInstance) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY environment variable is not set");
    }
    exaClientInstance = new ExaClient(apiKey);
  }
  return exaClientInstance;
}
