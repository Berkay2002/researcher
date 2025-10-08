import { ToolMessage } from "@langchain/core/messages";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import { EXA_API_KEY, TAVILY_API_KEY } from "../../../shared/configs/env";
import { ExaClient } from "../../../shared/tools/exa";
import { TavilyClient } from "../../../shared/tools/tavily";
import type { SearchRunMetadata } from "../../../types/react-agent";

const tavilyClient = new TavilyClient(TAVILY_API_KEY);
const exaClient = new ExaClient(EXA_API_KEY);

const MIN_SEARCH_RESULTS = 1;
const MAX_SEARCH_RESULTS = 20;
const DEFAULT_SEARCH_RESULTS = 5;

const TavilySearchInputSchema = z.object({
  query: z.string().describe("Web search query to run"),
  maxResults: z
    .number()
    .int()
    .min(MIN_SEARCH_RESULTS)
    .max(MAX_SEARCH_RESULTS)
    .default(DEFAULT_SEARCH_RESULTS)
    .describe("Maximum number of results to return"),
  searchDepth: z
    .enum(["basic", "advanced"])
    .default("basic")
    .describe("Use advanced mode for deeper research"),
});

const ExaSearchInputSchema = z.object({
  query: z.string().describe("Semantic search query to run"),
  maxResults: z
    .number()
    .int()
    .min(MIN_SEARCH_RESULTS)
    .max(MAX_SEARCH_RESULTS)
    .default(DEFAULT_SEARCH_RESULTS)
    .describe("Maximum number of results to return"),
  searchType: z
    .enum(["auto", "neural", "keyword", "fast"])
    .default("auto")
    .describe("Search ranking strategy"),
});

type SearchState = {
  searchRuns?: SearchRunMetadata[];
};

export function createSearchTools() {
  const tavilySearch = tool(
    async ({ query, maxResults, searchDepth }, config) => {
      const startedAt = new Date().toISOString();
      const results = await tavilyClient.search({
        query,
        maxResults,
        searchDepth,
      });
      const completedAt = new Date().toISOString();
      const state = getCurrentTaskInput<SearchState>();
      const metadata = {
        query,
        provider: "tavily" as const,
        startedAt,
        completedAt,
      };
      const observation = JSON.stringify({
        provider: "tavily",
        results,
      });
      const toolCallId = config.toolCall?.id ?? `tavily-${Date.now()}`;
      return new Command({
        update: {
          searchRuns: [...(state.searchRuns ?? []), metadata],
          messages: [
            new ToolMessage({
              content: observation,
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "tavily_search",
      description: "Use for general web search and news discovery.",
      schema: TavilySearchInputSchema,
    }
  );

  const exaSearch = tool(
    async ({ query, maxResults, searchType }, config) => {
      const startedAt = new Date().toISOString();
      const results = await exaClient.search({
        query,
        maxResults,
        type: searchType,
      });
      const completedAt = new Date().toISOString();
      const state = getCurrentTaskInput<SearchState>();
      const metadata = {
        query,
        provider: "exa" as const,
        startedAt,
        completedAt,
      };
      const observation = JSON.stringify({
        provider: "exa",
        results,
      });
      const toolCallId = config.toolCall?.id ?? `exa-${Date.now()}`;
      return new Command({
        update: {
          searchRuns: [...(state.searchRuns ?? []), metadata],
          messages: [
            new ToolMessage({
              content: observation,
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "exa_search",
      description: "Use for neural web search and semantic enrichment.",
      schema: ExaSearchInputSchema,
    }
  );

  return [tavilySearch, exaSearch];
}
