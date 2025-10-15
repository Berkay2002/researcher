import { MessagesZodState } from "@langchain/langgraph";
import { createAgent, toolStrategy } from "langchain";
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

// ============================================================================
// Structured Output Schema for Research Reports
// ============================================================================

/**
 * Claim schema for tracking factual assertions with citations
 */
const ClaimSchema = z.object({
  id: z.string().describe("Unique identifier for the claim (e.g., 'claim_1')"),
  text: z.string().describe("The factual assertion or claim being made"),
  citations: z
    .array(z.number())
    .describe(
      "Array of source indices (e.g., [1, 3, 5] for [Source 1], [Source 3], [Source 5])"
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level based on source quality and consensus"),
});

/**
 * Research output schema with structured claims
 * This ensures the research report includes traceable, citable claims
 */
const ResearchOutputSchema = z.object({
  report: z
    .string()
    .describe(
      "The complete research report in markdown format with [Source X] inline citations"
    ),
  claims: z
    .array(ClaimSchema)
    .describe(
      "Array of key factual claims extracted from the report with their citations"
    ),
  sourcesUsed: z
    .number()
    .describe("Total number of distinct sources cited in the report"),
  wordCount: z.number().describe("Approximate word count of the report"),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

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
    // Use toolStrategy for Gemini compatibility (Gemini doesn't support native structured output)
    responseFormat: toolStrategy(ResearchOutputSchema),
  };

  return createAgent(config as unknown as AgentParams);
}
