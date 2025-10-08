import { createAgent } from "langchain";
import type { CreateAgentParams } from "langchain/agents/types";
import { createLLM } from "../../shared/configs/llm";
import { REACT_AGENT_SYSTEM_PROMPT } from "./prompts/system";
import { ReactAgentStateSchema } from "./state";
import { buildReactAgentTools } from "./tools";

const DEFAULT_AGENT_TEMPERATURE = 0.2;

type ReactTool = ReturnType<typeof buildReactAgentTools>[number];

type BaseAgentParams = CreateAgentParams;

type ModelOverride = BaseAgentParams["llm"] | BaseAgentParams["model"];

export type ReactAgentOptions = Pick<
  BaseAgentParams,
  "llm" | "prompt" | "preModelHook" | "postModelHook" | "stateSchema" | "contextSchema"
> & {
  model?: ModelOverride;
  extraTools?: ReactTool[];
};

export function createReactAgent(options: ReactAgentOptions = {}) {
  const modelOverride = options.model;
  const resolvedLLM =
    options.llm ??
    (modelOverride && typeof modelOverride !== "string"
      ? modelOverride
      : undefined) ??
    createLLM("gemini-2.5-pro", DEFAULT_AGENT_TEMPERATURE);
  const coreTools = buildReactAgentTools();
  const tools = options.extraTools
    ? [...coreTools, ...options.extraTools]
    : coreTools;

  const agentConfig: CreateAgentParams = {
    llm: resolvedLLM,
    tools,
    stateSchema: options.stateSchema ?? ReactAgentStateSchema,
    contextSchema: options.contextSchema,
    prompt: options.prompt ?? REACT_AGENT_SYSTEM_PROMPT,
    preModelHook: options.preModelHook,
    postModelHook: options.postModelHook,
  };

  if (typeof modelOverride === "string") {
    agentConfig.model = modelOverride;
  }

  return createAgent(agentConfig);
}
