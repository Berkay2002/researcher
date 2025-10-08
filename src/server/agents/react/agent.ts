import { createAgent } from "langchain";
import { createLLM } from "../../shared/configs/llm";
import { REACT_AGENT_SYSTEM_PROMPT } from "./prompts/system";
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
  } = options;
  const resolvedLLM =
    llm ?? createLLM("gemini-2.5-pro", DEFAULT_AGENT_TEMPERATURE);
  const coreTools = buildReactAgentTools();
  const tools = extraTools ? [...coreTools, ...extraTools] : coreTools;

  const agentConfig = {
    llm: resolvedLLM,
    tools,
    stateSchema: stateSchema ?? ReactAgentStateSchema,
    contextSchema,
    prompt: prompt ?? REACT_AGENT_SYSTEM_PROMPT,
    preModelHook,
    postModelHook,
  };

  if (model) {
    (agentConfig as { model?: typeof model }).model = model;
  }

  return createAgent(agentConfig as unknown as AgentParams);
}
