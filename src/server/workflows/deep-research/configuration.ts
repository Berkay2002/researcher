/**
 * Configuration management for the Deep Research system.
 *
 * Defines all configuration options with Zod validation and TypeScript types.
 */

import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { EXA_API_KEY, TAVILY_API_KEY } from "@/server/shared/configs/env";
import { createLLM } from "@/server/shared/configs/llm";

// ============================================================================
// Search API Configuration
// ============================================================================

/**
 * Available search API providers
 */
export const SearchAPISchema = z.enum(["tavily", "exa", "none"]);

export type SearchAPI = z.infer<typeof SearchAPISchema>;

export const SearchAPI = {
  TAVILY: "tavily" as const,
  EXA: "exa" as const,
  NONE: "none" as const,
};

// ============================================================================
// Configuration Constants
// ============================================================================

const DEFAULT_MAX_STRUCTURED_OUTPUT_RETRIES = 3;
const MAX_STRUCTURED_OUTPUT_RETRIES_LIMIT = 10;

const DEFAULT_MAX_CONCURRENT_RESEARCH_UNITS = 5;
const MAX_CONCURRENT_RESEARCH_UNITS_LIMIT = 20;

const DEFAULT_MAX_RESEARCHER_ITERATIONS = 10;
const MAX_RESEARCHER_ITERATIONS_LIMIT = 20;

const DEFAULT_MAX_REACT_TOOL_CALLS = 20; // Increased from 10 to allow more cross-referencing
const MAX_REACT_TOOL_CALLS_LIMIT = 40; // Increased from 30 for complex research

const DEFAULT_SUMMARIZATION_MODEL_MAX_TOKENS = 8192;

const MIN_CONTENT_LENGTH = 1500;
const MAX_CONTENT_LENGTH_LIMIT = 200_000;
const DEFAULT_MAX_CONTENT_LENGTH = 50_000;

const DEFAULT_RESEARCH_MODEL_MAX_TOKENS = 20_000;
const DEFAULT_RESEARCHER_MODEL_MAX_TOKENS = 20_000;
const DEFAULT_COMPRESSION_MODEL_MAX_TOKENS = 8192;
const DEFAULT_FINAL_REPORT_MODEL_MAX_TOKENS = 25_000;

const DEFAULT_CLARIFICATION_MODEL_MAX_TOKENS = 2048;
const DEFAULT_RESEARCH_BRIEF_MODEL_MAX_TOKENS = 4096;

const DEFAULT_FOLLOWUP_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_FOLLOWUP_MODEL_MAX_TOKENS = 8192;
const DEFAULT_ROUTING_MODEL_MAX_TOKENS = 2048;

// ============================================================================
// MCP Configuration
// ============================================================================

/**
 * Configuration for Model Context Protocol (MCP) servers
 */
export const MCPConfigSchema = z.object({
  url: z.string().optional().nullable(),
  tools: z.array(z.string()).optional().nullable(),
  auth_required: z.boolean().optional().default(false),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;

// ============================================================================
// Main Configuration Schema
// ============================================================================

/**
 * Main configuration class for the Deep Research agent
 */
export const ConfigurationSchema = z.object({
  // General Configuration
  max_structured_output_retries: z
    .number()
    .min(1)
    .max(MAX_STRUCTURED_OUTPUT_RETRIES_LIMIT)
    .default(DEFAULT_MAX_STRUCTURED_OUTPUT_RETRIES),
  allow_clarification: z.boolean().default(true),
  max_concurrent_research_units: z
    .number()
    .min(1)
    .max(MAX_CONCURRENT_RESEARCH_UNITS_LIMIT)
    .default(DEFAULT_MAX_CONCURRENT_RESEARCH_UNITS),

  // Research Configuration
  search_api: SearchAPISchema.default("tavily"),
  max_researcher_iterations: z
    .number()
    .min(1)
    .max(MAX_RESEARCHER_ITERATIONS_LIMIT)
    .default(DEFAULT_MAX_RESEARCHER_ITERATIONS),
  max_react_tool_calls: z
    .number()
    .min(1)
    .max(MAX_REACT_TOOL_CALLS_LIMIT)
    .default(DEFAULT_MAX_REACT_TOOL_CALLS),

  // Model Configuration
  summarization_model: z.string().default("gemini-flash-latest"),
  summarization_model_max_tokens: z
    .number()
    .default(DEFAULT_SUMMARIZATION_MODEL_MAX_TOKENS),
  max_content_length: z
    .number()
    .min(MIN_CONTENT_LENGTH)
    .max(MAX_CONTENT_LENGTH_LIMIT)
    .default(DEFAULT_MAX_CONTENT_LENGTH),

  research_model: z.string().default("gemini-2.5-pro"),
  research_model_max_tokens: z
    .number()
    .default(DEFAULT_RESEARCH_MODEL_MAX_TOKENS),

  researcher_model: z.string().default("gemini-2.5-pro"),
  researcher_model_max_tokens: z
    .number()
    .default(DEFAULT_RESEARCHER_MODEL_MAX_TOKENS),

  compression_model: z.string().default("gemini-flash-latest"),
  compression_model_max_tokens: z
    .number()
    .default(DEFAULT_COMPRESSION_MODEL_MAX_TOKENS),

  final_report_model: z.string().default("gemini-2.5-pro"),
  final_report_model_max_tokens: z
    .number()
    .default(DEFAULT_FINAL_REPORT_MODEL_MAX_TOKENS),

  // Clarification Configuration
  clarification_model: z.string().default("gemini-flash-latest"),
  clarification_model_max_tokens: z
    .number()
    .default(DEFAULT_CLARIFICATION_MODEL_MAX_TOKENS),

  // Research Brief Configuration
  research_brief_model: z.string().default("gemini-flash-latest"),
  research_brief_model_max_tokens: z
    .number()
    .default(DEFAULT_RESEARCH_BRIEF_MODEL_MAX_TOKENS),

  // MCP Configuration
  mcp_config: MCPConfigSchema.optional().nullable(),
  mcp_prompt: z.string().optional().nullable(),

  // Middleware Configuration
  use_model_call_limit: z.boolean().default(true),
  use_tool_call_limit: z.boolean().default(true),
  use_model_fallback: z.boolean().default(true),
  use_context_editing: z.boolean().default(true),
  fallback_models: z
    .array(z.string())
    .default(["gemini-flash-latest", "gemini-2.5-pro"]),

  // Follow-up Routing Configuration
  enable_followup_routing: z.boolean().default(true),
  followup_confidence_threshold: z
    .number()
    .min(0)
    .max(1)
    .default(DEFAULT_FOLLOWUP_CONFIDENCE_THRESHOLD)
    .describe(
      "Minimum confidence score (0-1) required for automatic routing. Below this, user will be asked to clarify."
    ),
  routing_model: z.string().default("gemini-flash-latest"),
  followup_model: z.string().default("gemini-flash-latest"),
  followup_model_max_tokens: z
    .number()
    .default(DEFAULT_FOLLOWUP_MODEL_MAX_TOKENS),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

// ============================================================================
// Configuration Helper Functions
// ============================================================================

/**
 * Extract configuration from RunnableConfig
 */
export function fromRunnableConfig(
  config?: RunnableConfig
): Partial<Configuration> {
  const configurable = config?.configurable ?? {};

  // Extract all configuration values from the configurable object
  const values: Partial<Configuration> = {};

  // Map through all schema keys
  const schemaKeys = Object.keys(ConfigurationSchema.shape);

  for (const key of schemaKeys) {
    if (key in configurable && configurable[key] !== undefined) {
      // @ts-expect-error - Dynamic key access
      values[key] = configurable[key];
    }
  }

  return values;
}

/**
 * Create a Configuration instance from a RunnableConfig with defaults
 */
export function getConfiguration(config?: RunnableConfig): Configuration {
  const partial = fromRunnableConfig(config);
  return ConfigurationSchema.parse(partial);
}

/**
 * Get Tavily API key from environment
 */
export function getTavilyApiKey(): string | undefined {
  return TAVILY_API_KEY;
}

/**
 * Get Exa API key from environment
 */
export function getExaApiKey(): string | undefined {
  return EXA_API_KEY;
}

// ============================================================================
// Model Creation Helpers
// ============================================================================

/**
 * Create a configured LLM instance for research tasks
 *
 * @param modelName - The model name (e.g., "gemini-2.5-pro", "gemini-flash-latest")
 * @param temperature - The temperature for generation
 * @param maxTokens - Maximum tokens for output
 * @returns Configured ChatGoogleGenerativeAI instance with tracing
 */
export function createResearchLLM(
  modelName: string,
  temperature: number,
  maxTokens?: number
) {
  return createLLM(modelName, temperature, {
    maxOutputTokens: maxTokens,
  });
}

/**
 * Create supervisor model instance from configuration
 */
export function createSupervisorModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);
  const SUPERVISOR_TEMPERATURE = 0.3;

  return createResearchLLM(
    configuration.research_model,
    SUPERVISOR_TEMPERATURE,
    configuration.research_model_max_tokens
  );
}

/**
 * Create researcher model instance from configuration
 */
export function createResearcherModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);
  const RESEARCHER_TEMPERATURE = 0.3;

  return createResearchLLM(
    configuration.researcher_model,
    RESEARCHER_TEMPERATURE,
    configuration.researcher_model_max_tokens
  );
}

/**
 * Create final report model instance from configuration
 */
export function createFinalReportModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);
  const FINAL_REPORT_TEMPERATURE = 0.3;

  return createResearchLLM(
    configuration.final_report_model,
    FINAL_REPORT_TEMPERATURE,
    configuration.final_report_model_max_tokens
  );
}

/**
 * Create research brief model instance from configuration
 */
export function createResearchBriefModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);

  return createResearchLLM(
    configuration.research_brief_model,
    0, // Use 0 temperature for consistent research brief generation
    configuration.research_brief_model_max_tokens
  );
}

/**
 * Create clarification model instance from configuration
 */
export function createClarificationModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);

  return createResearchLLM(
    configuration.clarification_model,
    0, // Use 0 temperature for consistent clarification analysis
    configuration.clarification_model_max_tokens
  );
}

/**
 * Create compression model instance from configuration
 */
export function createCompressionModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);
  const COMPRESSION_TEMPERATURE = 0.1; // Low temperature for quality

  return createResearchLLM(
    configuration.compression_model,
    COMPRESSION_TEMPERATURE,
    configuration.compression_model_max_tokens
  );
}

/**
 * Create summarization model instance from configuration
 */
export function createSummarizationModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);

  return createResearchLLM(
    configuration.summarization_model,
    0, // Use 0 temperature for consistent summarization
    configuration.summarization_model_max_tokens
  );
}

/**
 * Create routing model instance from configuration
 */
export function createRoutingModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);

  return createResearchLLM(
    configuration.routing_model,
    0, // Use 0 temperature for consistent routing decisions
    DEFAULT_ROUTING_MODEL_MAX_TOKENS
  );
}

/**
 * Create follow-up model instance from configuration
 */
export function createFollowupModel(config?: RunnableConfig) {
  const configuration = getConfiguration(config);
  const FOLLOWUP_TEMPERATURE = 0.3;

  return createResearchLLM(
    configuration.followup_model,
    FOLLOWUP_TEMPERATURE,
    configuration.followup_model_max_tokens
  );
}
