import { ChatOpenAI } from "@langchain/openai";
import { LANGCHAIN_TRACING_V2, OPENAI_API_KEY } from "./env";

// Constants for LLM configuration
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_TEMPERATURE = 0.3;
const QUALITY_TEMPERATURE = 0.1;

// LangSmith tracing configuration
const TRACING_ENABLED = LANGCHAIN_TRACING_V2 === "true";

/**
 * Create a ChatOpenAI instance configured for Gemini OpenAI compatibility
 *
 * @param model - The model name to use (e.g., "gemini-2.5-flash", "gemini-2.5-pro")
 * @param temperature - The temperature for generation (default: 0.3)
 * @param options - Additional options for ChatOpenAI
 * @returns Configured ChatOpenAI instance
 */
export function createLLM(
  model: string,
  temperature: number = DEFAULT_TEMPERATURE,
  options: {
    streaming?: boolean;
    maxTokens?: number;
    [key: string]: unknown;
  } = {}
): ChatOpenAI {
  return new ChatOpenAI({
    model,
    temperature,
    apiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: GEMINI_BASE_URL,
    },
    // Disable stream_options to avoid token metadata conflicts
    streamUsage: false,
    // Add metadata for better tracing visibility
    tags: TRACING_ENABLED
      ? [`model:${model}`, `temperature:${temperature}`]
      : undefined,
    ...options,
  });
}

/**
 * Pre-configured LLM instances for different use cases
 */
export const LLM_INSTANCES = {
  // Gemini 2.5 Pro for reasoning tasks (agentic)
  analysis: createLLM("gemini-2.5-pro", DEFAULT_TEMPERATURE),

  // Gemini 2.5 Flash for well-defined tasks
  generation: createLLM("gemini-2.5-flash", DEFAULT_TEMPERATURE),

  // Low temperature for consistent evaluation
  quality: createLLM("gemini-2.5-flash", QUALITY_TEMPERATURE),
} as const;

/**
 * Get an LLM instance by type
 *
 * @param type - The type of LLM to get
 * @returns ChatOpenAI instance
 */
export function getLLM(type: keyof typeof LLM_INSTANCES): ChatOpenAI {
  return LLM_INSTANCES[type];
}
