import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ensureThoughtSignatures } from "@/server/shared/utils/gemini";
import { GOOGLE_API_KEY, LANGCHAIN_TRACING_V2 } from "./env";

// Constants for LLM configuration
const DEFAULT_TEMPERATURE = 0.3;
const QUALITY_TEMPERATURE = 0.1;
const GEMINI_3_TEMPERATURE = 1.0;

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
    thinkingLevel?: "low" | "medium" | "high";
    mediaResolution?: "media_resolution_low" | "media_resolution_medium" | "media_resolution_high";
    [key: string]: unknown;
  } = {}
): ChatGoogleGenerativeAI {
  // Destructure new parameters to avoid passing them to incompatible models
  const { thinkingLevel, mediaResolution, ...otherOptions } = options;

  // Prepare the base config object
  const llmConfig: any = {
    model,
    temperature,
    apiKey: GOOGLE_API_KEY,
    // Enable stream usage by default for better observability
    streamUsage: true,
    // Add metadata for better tracing visibility
    tags: [`model:${model}`, `temperature:${temperature}`],
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
      },
    ],
    ...otherOptions,
  };

  // Only add Gemini 3 specific parameters if the model is Gemini 3
  if (model.includes("gemini-3")) {
    if (thinkingLevel) {
      llmConfig.thinkingLevel = thinkingLevel;
    }
    if (mediaResolution) {
      llmConfig.mediaResolution = mediaResolution;
    }
  }

  const llm = new ChatGoogleGenerativeAI(llmConfig);

  // Patch invoke for Gemini 3 models to ensure thought signatures are present
  if (model.includes("gemini-3")) {
    const originalInvoke = llm.invoke.bind(llm);
    // @ts-ignore - Monkey patching for Gemini 3 compatibility
    llm.invoke = async (input: any, options?: any) => {
      if (Array.isArray(input)) {
        ensureThoughtSignatures(input);
      } else if (
        input &&
        typeof input === "object" &&
        "messages" in input &&
        Array.isArray(input.messages)
      ) {
        ensureThoughtSignatures(input.messages);
      }
      return originalInvoke(input, options);
    };
  }

  return llm;
}

/**
 * Pre-configured LLM instances for different use cases
 *
 * @returns Object containing configured LLM instances
 */
export const LLM_INSTANCES = {
  // Gemini 3 Pro Preview for reasoning tasks (agentic)
  analysis: createLLM(
    "gemini-3-pro-preview",
    GEMINI_3_TEMPERATURE,
    { mediaResolution: "media_resolution_high" }
  ),

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
