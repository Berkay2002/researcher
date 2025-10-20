import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GOOGLE_API_KEY, LANGCHAIN_TRACING_V2 } from "./env";

// Constants for LLM configuration
const DEFAULT_TEMPERATURE = 0.3;
const QUALITY_TEMPERATURE = 0.1;

// LangSmith tracing configuration
const TRACING_ENABLED = LANGCHAIN_TRACING_V2 === "true";

/**
 * Create a ChatGoogleGenerativeAI instance configured for Gemini models
 *
 * @param model - The model name to use (e.g., "gemini-flash-latest", "gemini-2.5-pro")
 * @param temperature - The temperature for generation (default: 0.3)
 * @param options - Additional options for ChatGoogleGenerativeAI
 * @returns Configured ChatGoogleGenerativeAI instance
 */
export function createLLM(
  model: string,
  temperature: number = DEFAULT_TEMPERATURE,
  options: {
    streaming?: boolean;
    maxOutputTokens?: number;
    [key: string]: unknown;
  } = {}
): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model,
    temperature,
    apiKey: GOOGLE_API_KEY,
    // Enable stream usage by default for better observability
    streamUsage: true,
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
  generation: createLLM("gemini-flash-latest", DEFAULT_TEMPERATURE),

  // Low temperature for consistent evaluation
  quality: createLLM("gemini-flash-latest", QUALITY_TEMPERATURE),
} as const;

/**
 * Get an LLM instance by type
 *
 * @param type - The type of LLM to get
 * @returns ChatGoogleGenerativeAI instance
 */
export function getLLM(
  type: keyof typeof LLM_INSTANCES
): ChatGoogleGenerativeAI {
  return LLM_INSTANCES[type];
}
