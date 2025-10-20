import { z } from "zod";

// Environment variable schema for runtime validation
const envSchema = z.object({
  // LLM Provider - Using Gemini via native Google Generative AI SDK
  GOOGLE_API_KEY: z.string().min(1, "Google API key is required"),

  // Search APIs
  TAVILY_API_KEY: z.string().min(1, "Tavily API key is required"),
  EXA_API_KEY: z.string().min(1, "Exa API key is required"),

  // Optional Configuration
  REDIS_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // LangSmith for tracing (optional)
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
});

// Validate and export environment variables
function validateEnv() {
  try {
    const env = envSchema.parse(process.env);

    return env;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Environment validation errors should be logged
    console.error("L Invalid environment variables:", error);
    throw new Error(
      "Environment validation failed. Please check your .env.local file."
    );
  }
}

// Export validated environment variables
export const env = validateEnv();

// Export individual variables for convenience
export const {
  GOOGLE_API_KEY,
  TAVILY_API_KEY,
  EXA_API_KEY,
  REDIS_URL,
  NODE_ENV,
  LANGCHAIN_TRACING_V2,
  LANGCHAIN_API_KEY,
  LANGCHAIN_PROJECT,
} = env;

// Export isDevelopment helper
export const isDevelopment = NODE_ENV === "development";

// Export type for environment variables
export type Env = z.infer<typeof envSchema>;
