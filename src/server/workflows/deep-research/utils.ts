/**
 * Utility functions and helpers for the Deep Research agent.
 *
 * Includes tools, search utilities, token limit detection, and helper functions.
 */

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createLLM } from "@/server/shared/configs/llm";
import { getExaClient } from "@/server/shared/tools/exa";
import {
  getConfiguration,
  getExaApiKey,
  getTavilyApiKey,
  type SearchAPI,
} from "./configuration";
import {
  ResearchCompleteSchema,
  type Summary,
  SummarySchema,
} from "./graph/state";
import { summarizeWebpagePrompt } from "./prompts";

// ============================================================================
// Constants
// ============================================================================

const TAVILY_SEARCH_DESCRIPTION =
  "A search engine optimized for comprehensive, accurate, and trusted results. " +
  "Useful for when you need to answer questions about current events.";

const EXA_SEARCH_DESCRIPTION =
  "A neural search engine for finding high-quality, relevant content. " +
  "Excellent for research, finding academic papers, and discovering authoritative sources.";

const SUMMARIZATION_TIMEOUT_MS = 60_000; // 60 seconds
const SOURCE_INDEX_OFFSET = 1; // Offset for 1-based indexing in output
const SEPARATOR_LINE_LENGTH = 80; // Length of separator line in formatted output
const DEFAULT_MAX_SEARCH_RESULTS = 5; // Default number of search results per query

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Get current date formatted for display in prompts
 */
export function getTodayStr(): string {
  const now = new Date();
  const weekday = now.toLocaleString("en-US", { weekday: "short" });
  const month = now.toLocaleString("en-US", { month: "short" });
  const day = now.getDate();
  const year = now.getFullYear();

  return `${weekday} ${month} ${day}, ${year}`;
}

// ============================================================================
// Tavily Search Tool
// ============================================================================

/**
 * Tavily search result from API
 */
type TavilySearchResult = {
  url: string;
  title: string;
  content: string;
  raw_content?: string;
};

/**
 * Tavily search API response
 */
type TavilySearchResponse = {
  query: string;
  results: TavilySearchResult[];
};

/**
 * Execute Tavily search queries asynchronously
 */

async function tavilySearchAsync(
  searchQueries: string[],
  maxResults: number,
  topic: "general" | "news" | "finance",
  includeRawContent: false | "markdown" | "text"
): Promise<TavilySearchResponse[]> {
  const tavilyApiKey = getTavilyApiKey();

  if (!tavilyApiKey) {
    throw new Error("TAVILY_API_KEY is required for Tavily search");
  }

  // Import tavily dynamically to avoid issues if not installed
  const { tavily } = await import("@tavily/core");
  const client = tavily({ apiKey: tavilyApiKey });

  // Execute all searches in parallel
  const searchTasks = searchQueries.map(async (query) => {
    const response = await client.search(query, {
      maxResults,
      includeRawContent,
      topic,
    });

    return {
      query,
      results: response.results,
    };
  });

  return Promise.all(searchTasks);
}

/**
 * Summarize webpage content using AI model
 */
async function summarizeWebpage(
  model: BaseChatModel | Runnable,
  webpageContent: string
): Promise<string> {
  try {
    const promptContent = summarizeWebpagePrompt
      .replace("{webpage_content}", webpageContent)
      .replace("{date}", getTodayStr());

    // Execute summarization with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Summarization timeout")),
        SUMMARIZATION_TIMEOUT_MS
      )
    );

    const summaryPromise = model.invoke([
      new HumanMessage({ content: promptContent }),
    ]);

    const response = await Promise.race([summaryPromise, timeoutPromise]);

    // Parse the structured output
    const summary = response.content as unknown as Summary;

    const formattedSummary =
      `<summary>\n${summary.summary}\n</summary>\n\n` +
      `<key_excerpts>\n${summary.key_excerpts}\n</key_excerpts>`;

    return formattedSummary;
  } catch (error) {
    // Return original content on error
    // biome-ignore lint/suspicious/noConsole: Development logging for summarization failures
    console.warn(`Summarization failed: ${error}. Returning original content.`);
    return webpageContent;
  }
}

/**
 * Tavily search tool for web search
 */
export const tavilySearchTool = tool(
  async (
    {
      queries,
      maxResults = DEFAULT_MAX_SEARCH_RESULTS,
      topic = "general",
    }: {
      queries: string[];
      maxResults?: number;
      topic?: "general" | "news" | "finance";
    },
    config?: RunnableConfig
  ): Promise<string> => {
    // Execute search queries
    const searchResults = await tavilySearchAsync(
      queries,
      maxResults,
      topic,
      "text"
    );

    // Deduplicate results by URL
    const uniqueResults = new Map<
      string,
      TavilySearchResult & { query: string }
    >();

    for (const response of searchResults) {
      for (const result of response.results) {
        if (!uniqueResults.has(result.url)) {
          uniqueResults.set(result.url, {
            ...result,
            query: response.query,
          });
        }
      }
    }

    // Set up summarization model
    const configuration = getConfiguration(config);
    const maxCharToInclude = configuration.max_content_length;

    const summarizationModel = createLLM(configuration.summarization_model, 0, {
      maxTokens: configuration.summarization_model_max_tokens,
    }).withStructuredOutput(SummarySchema);

    // Create summarization tasks
    const summarizationTasks: Promise<string | null>[] = Array.from(
      uniqueResults.values()
    ).map((result) => {
      if (!result.raw_content) {
        return Promise.resolve(null);
      }

      const truncatedContent = result.raw_content.slice(0, maxCharToInclude);
      return summarizeWebpage(summarizationModel, truncatedContent);
    });

    // Execute all summarizations in parallel
    const summaries = await Promise.all(summarizationTasks);

    // Combine results with summaries
    const summarizedResults = Array.from(uniqueResults.entries()).map(
      ([url, result], index) => ({
        url,
        title: result.title,
        content: summaries[index] ?? result.content,
      })
    );

    // Format output
    if (summarizedResults.length === 0) {
      return "No valid search results found. Please try different search queries or use a different search API.";
    }

    let formattedOutput = "Search results: \n\n";

    for (const [index, result] of summarizedResults.entries()) {
      formattedOutput += `\n\n--- SOURCE ${index + SOURCE_INDEX_OFFSET}: ${result.title} ---\n`;
      formattedOutput += `URL: ${result.url}\n\n`;
      formattedOutput += `SUMMARY:\n${result.content}\n\n`;
      formattedOutput += `\n\n${"-".repeat(SEPARATOR_LINE_LENGTH)}\n`;
    }

    return formattedOutput;
  },
  {
    name: "tavily_search",
    description: TAVILY_SEARCH_DESCRIPTION,
    schema: z.object({
      queries: z
        .array(z.string())
        .describe("List of search queries to execute"),
      maxResults: z
        .number()
        .optional()
        .default(DEFAULT_MAX_SEARCH_RESULTS)
        .describe("Maximum number of results to return per query"),
      topic: z
        .enum(["general", "news", "finance"])
        .optional()
        .default("general")
        .describe("Topic filter for search results"),
    }),
  }
);

// ============================================================================
// Exa Search Tool
// ============================================================================

/**
 * Exa search tool for neural/semantic search
 */
export const exaSearchTool = tool(
  async (
    {
      queries,
      maxResults = DEFAULT_MAX_SEARCH_RESULTS,
      type = "auto",
    }: {
      queries: string[];
      maxResults?: number;
      type?: "keyword" | "neural" | "auto";
    },
    config?: RunnableConfig
  ): Promise<string> => {
    const exaApiKey = getExaApiKey();

    if (!exaApiKey) {
      throw new Error("EXA_API_KEY is required for Exa search");
    }

    const exaClient = getExaClient();

    // Execute all searches in parallel
    const searchTasks = queries.map(async (query) => {
      const results = await exaClient.search({
        query,
        maxResults,
        type,
        contents: {
          text: { maxCharacters: 1000 },
        },
      });

      return {
        query,
        results,
      };
    });

    const searchResults = await Promise.all(searchTasks);

    // Deduplicate results by URL
    const uniqueResults = new Map<
      string,
      { url: string; title: string; snippet: string; query: string }
    >();

    for (const response of searchResults) {
      for (const result of response.results) {
        if (!uniqueResults.has(result.url)) {
          uniqueResults.set(result.url, {
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            query: response.query,
          });
        }
      }
    }

    // Set up summarization model
    const configuration = getConfiguration(config);
    const maxCharToInclude = configuration.max_content_length;

    const summarizationModel = createLLM(configuration.summarization_model, 0, {
      maxTokens: configuration.summarization_model_max_tokens,
    }).withStructuredOutput(SummarySchema);

    // Create summarization tasks
    const summarizationTasks: Promise<string | null>[] = Array.from(
      uniqueResults.values()
    ).map((result) => {
      const truncatedContent = result.snippet.slice(0, maxCharToInclude);
      return summarizeWebpage(summarizationModel, truncatedContent);
    });

    // Execute all summarizations in parallel
    const summaries = await Promise.all(summarizationTasks);

    // Combine results with summaries
    const summarizedResults = Array.from(uniqueResults.entries()).map(
      ([url, result], index) => ({
        url,
        title: result.title,
        content: summaries[index] ?? result.snippet,
      })
    );

    // Format output
    if (summarizedResults.length === 0) {
      return "No valid search results found. Please try different search queries or use a different search API.";
    }

    let formattedOutput = "Search results: \n\n";

    for (const [index, result] of summarizedResults.entries()) {
      formattedOutput += `\n\n--- SOURCE ${index + SOURCE_INDEX_OFFSET}: ${result.title} ---\n`;
      formattedOutput += `URL: ${result.url}\n\n`;
      formattedOutput += `SUMMARY:\n${result.content}\n\n`;
      formattedOutput += `\n\n${"-".repeat(SEPARATOR_LINE_LENGTH)}\n`;
    }

    return formattedOutput;
  },
  {
    name: "exa_search",
    description: EXA_SEARCH_DESCRIPTION,
    schema: z.object({
      queries: z
        .array(z.string())
        .describe("List of search queries to execute"),
      maxResults: z
        .number()
        .optional()
        .default(DEFAULT_MAX_SEARCH_RESULTS)
        .describe("Maximum number of results to return per query"),
      type: z
        .enum(["keyword", "neural", "auto"])
        .optional()
        .default("auto")
        .describe("Search type: keyword, neural, or auto"),
    }),
  }
);

// ============================================================================
// Think Tool for Reflection
// ============================================================================

/**
 * Strategic reflection tool for research planning
 */
export const thinkTool = tool(
  ({ reflection }: { reflection: string }): string =>
    `Reflection recorded: ${reflection}`,
  {
    name: "think_tool",
    description: "Strategic reflection tool for research planning",
    schema: z.object({
      reflection: z
        .string()
        .describe(
          "Your detailed reflection on research progress, findings, gaps, and next steps"
        ),
    }),
  }
);

// ============================================================================
// Research Complete Tool
// ============================================================================

/**
 * Tool to indicate research is complete
 */
export const researchCompleteTool = tool(
  (): string => "Research marked as complete",
  {
    name: "ResearchComplete",
    description: "Call this tool to indicate that the research is complete",
    schema: ResearchCompleteSchema,
  }
);

// ============================================================================
// Search Tool Configuration
// ============================================================================

/**
 * Get search tools based on configured search API
 */
export function getSearchTool(searchApi: SearchAPI): unknown[] {
  switch (searchApi) {
    case "tavily":
      // Tavily search tool
      return [tavilySearchTool];

    case "exa":
      // Exa neural search tool
      return [exaSearchTool];

    case "none":
      // No search functionality
      return [];

    default:
      // Default to Tavily
      return [tavilySearchTool];
  }
}

/**
 * Get all available tools for research
 */
export function getAllTools(config?: RunnableConfig): unknown[] {
  const configuration = getConfiguration(config);

  // Start with core research tools
  const tools: unknown[] = [researchCompleteTool, thinkTool];

  // Add search tools
  const searchTools = getSearchTool(configuration.search_api);
  tools.push(...searchTools);

  // TODO: Add MCP tools if configured
  // const existingToolNames = new Set(tools.map(t => t.name));
  // const mcpTools = await loadMcpTools(config, existingToolNames);
  // tools.push(...mcpTools);

  return tools;
}

// ============================================================================
// Message Utilities
// ============================================================================

/**
 * Get notes from tool call messages
 */
export function getNotesFromToolCalls(messages: BaseMessage[]): string[] {
  // Filter for tool messages and extract content
  return messages
    .filter((msg) => ToolMessage.isInstance(msg))
    .map((msg) => String(msg.content));
}

// Note: removeUpToLastAiMessage function removed - now handled by contextEditingMiddleware

// ============================================================================
// Token Limit Detection (Deprecated - Now handled by modelFallbackMiddleware)
// ============================================================================

// Note: Token limit detection functions removed - now handled by modelFallbackMiddleware
// The middleware automatically handles token limit errors and retries with fallback models.
