import { MessagesZodState } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { z } from "zod";
import { createLLM } from "../../../shared/configs/llm";
import { SearchRunMetadataSchema } from "../../../types/react-agent";
import { RESEARCH_SUBAGENT_SYSTEM_PROMPT } from "../prompts/research-system";
import { createSearchTools } from "../tools/search";

type AgentParams = Parameters<typeof createAgent>[0];

// LLM Configuration
const LARGE_LANGUAGE_MODEL = "gemini-2.5-pro";
const DEFAULT_RESEARCH_TEMPERATURE = 0.2;

// Research Quality Standards (configurable via environment variables)
export const RESEARCH_CONFIG = {
  // Minimum number of distinct sources for comprehensive research
  MIN_SOURCES: Number.parseInt(process.env.RESEARCH_MIN_SOURCES || "15", 10),

  // Target number of sources for high-quality research
  TARGET_SOURCES: Number.parseInt(
    process.env.RESEARCH_TARGET_SOURCES || "20",
    10
  ),

  // Minimum word count for comprehensive reports
  MIN_WORD_COUNT: Number.parseInt(
    process.env.RESEARCH_MIN_WORD_COUNT || "1500",
    10
  ),

  // Target word count for detailed analysis
  TARGET_WORD_COUNT: Number.parseInt(
    process.env.RESEARCH_TARGET_WORD_COUNT || "2500",
    10
  ),

  // Minimum number of citations in the report
  MIN_CITATIONS: Number.parseInt(
    process.env.RESEARCH_MIN_CITATIONS || "10",
    10
  ),

  // Minimum number of search queries to execute
  MIN_SEARCH_QUERIES: Number.parseInt(
    process.env.RESEARCH_MIN_QUERIES || "5",
    10
  ),

  // Target number of search queries for thorough coverage
  TARGET_SEARCH_QUERIES: Number.parseInt(
    process.env.RESEARCH_TARGET_QUERIES || "8",
    10
  ),

  // Maximum results per search query
  RESULTS_PER_QUERY: Number.parseInt(
    process.env.RESEARCH_RESULTS_PER_QUERY || "12",
    10
  ),
} as const;

const ResearchSubagentStateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  searchRuns: z.array(SearchRunMetadataSchema).default([]),
});

export type ResearchSubagentState = z.infer<typeof ResearchSubagentStateSchema>;

export function createResearchSubagent() {
  const llm = createLLM(LARGE_LANGUAGE_MODEL, DEFAULT_RESEARCH_TEMPERATURE);
  const tools = createSearchTools();
  const config = {
    llm,
    tools,
    stateSchema: ResearchSubagentStateSchema,
    prompt: RESEARCH_SUBAGENT_SYSTEM_PROMPT,
  };

  return createAgent(config as unknown as AgentParams);
}
