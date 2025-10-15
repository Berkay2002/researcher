/** biome-ignore-all lint/style/useTrimStartEnd: <Keep the passthrough> */
import { MessagesZodState } from "@langchain/langgraph";
import {
  ClearToolUsesEdit,
  contextEditingMiddleware,
  createAgent,
  todoListMiddleware,
  toolCallLimitMiddleware,
} from "langchain";
import { z } from "zod";
import { createLLM } from "../../../shared/configs/llm";
import { SearchRunMetadataSchema } from "../../../types/react-agent";
import { RESEARCH_SUBAGENT_SYSTEM_PROMPT } from "../prompts/research-system";
import { createSearchTools } from "../tools/search";

type AgentParams = Parameters<typeof createAgent>[0];

// LLM Configuration
const LARGE_LANGUAGE_MODEL = "gemini-2.5-pro";
const DEFAULT_RESEARCH_TEMPERATURE = 0.2;

// Default limits matching deep-research configuration
const DEFAULT_MAX_REACT_TOOL_CALLS = 10;

const ResearchSubagentStateSchema = z
  .object({
    messages: MessagesZodState.shape.messages,
    searchRuns: z.array(SearchRunMetadataSchema).default([]),
  })
  .passthrough(); // Allow todoListMiddleware to add its own fields

export type ResearchSubagentState = z.infer<typeof ResearchSubagentStateSchema>;

export function createResearchSubagent() {
  const llm = createLLM(LARGE_LANGUAGE_MODEL, DEFAULT_RESEARCH_TEMPERATURE);
  const tools = createSearchTools();

  // Prepare middleware matching deep-research configuration
  const middleware = [
    // Built-in todo list middleware for task planning and tracking
    todoListMiddleware(),

    // Tool call limits matching deep-research constraints
    toolCallLimitMiddleware({
      threadLimit: DEFAULT_MAX_REACT_TOOL_CALLS, // Max 10 tool calls per thread
      runLimit: Math.ceil(DEFAULT_MAX_REACT_TOOL_CALLS / 2), // Max 5 per run
      exitBehavior: "end",
    }),

    // Context editing to clear tool uses between calls
    contextEditingMiddleware({
      edits: [new ClearToolUsesEdit({})],
    }),
  ];

  const config = {
    model: llm,
    tools,
    stateSchema: ResearchSubagentStateSchema,
    prompt: RESEARCH_SUBAGENT_SYSTEM_PROMPT,
    middleware,
  };

  return createAgent(config as unknown as AgentParams);
}
