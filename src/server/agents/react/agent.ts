import {
  createAgent,
  modelCallLimitMiddleware,
  todoListMiddleware,
  toolCallLimitMiddleware,
} from "langchain";
import { createLLM } from "../../shared/configs/llm";
import { getReactAgentSystemPrompt } from "./prompts/system";
import { ReactAgentStateSchema } from "./state";
import { buildReactAgentTools } from "./tools";

const DEFAULT_AGENT_TEMPERATURE = 0.2;

type ReactTool = ReturnType<typeof buildReactAgentTools>[number];

type AgentParams = Parameters<typeof createAgent>[0];

type ExtractAgentProp<Key extends PropertyKey> = AgentParams extends {
  [P in Key]?: infer Value;
}
  ? Value
  : never;

export type ReactAgentOptions = {
  llm?: ExtractAgentProp<"llm">;
  model?: ExtractAgentProp<"model">;
  prompt?: ExtractAgentProp<"prompt">;
  preModelHook?: ExtractAgentProp<"preModelHook">;
  postModelHook?: ExtractAgentProp<"postModelHook">;
  stateSchema?: ExtractAgentProp<"stateSchema">;
  contextSchema?: ExtractAgentProp<"contextSchema">;
  extraTools?: ReactTool[];
  middleware?: ExtractAgentProp<"middleware">;
};

export function createReactAgent(options: ReactAgentOptions = {}) {
  const {
    llm,
    model,
    prompt,
    preModelHook,
    postModelHook,
    stateSchema,
    contextSchema,
    extraTools,
    middleware: customMiddleware,
  } = options;
  const resolvedLLM =
    llm ?? createLLM("gemini-2.5-pro", DEFAULT_AGENT_TEMPERATURE);
  const coreTools = buildReactAgentTools();
  const tools = extraTools ? [...coreTools, ...extraTools] : coreTools;

  // Build middleware stack with todo list, limits, and custom middleware
  const middleware = [
    // Built-in todo list middleware for task planning and tracking
    todoListMiddleware(),

    // Tool call limits matching deep-research constraints
    toolCallLimitMiddleware({
      toolName: "tavily_search",
      threadLimit: 10, // Max 10 searches per thread
      runLimit: 5, // Max 5 searches per run
      exitBehavior: "end",
    }),
    toolCallLimitMiddleware({
      toolName: "exa_search",
      threadLimit: 10, // Max 10 searches per thread
      runLimit: 5, // Max 5 searches per run
      exitBehavior: "end",
    }),
    toolCallLimitMiddleware({
      toolName: "research_subagent",
      threadLimit: 3, // Limit expensive subagent calls
      runLimit: 2, // Max 2 per run
      exitBehavior: "end",
    }),

    // Model call limits to prevent runaway behavior
    modelCallLimitMiddleware({
      threadLimit: 20, // Max 20 model calls per thread
      runLimit: 10, // Max 10 model calls per run
      exitBehavior: "end",
    }),

    // Custom middleware (added last so it runs first)
    ...(customMiddleware || []),
  ];

  const agentConfig = {
    llm: resolvedLLM,
    tools,
    stateSchema: stateSchema ?? ReactAgentStateSchema,
    contextSchema,
    prompt: prompt ?? getReactAgentSystemPrompt(),
    preModelHook,
    postModelHook,
    middleware,
  };

  if (model) {
    (agentConfig as { model?: typeof model }).model = model;
  }

  const agent = createAgent(agentConfig as unknown as AgentParams);

  // Return the underlying compiled graph for LangGraph CLI compatibility
  // The ReactAgent class wraps a CompiledStateGraph, but the CLI expects
  // the graph itself (which has methods like getGraphAsync)
  return agent.graph;
}
