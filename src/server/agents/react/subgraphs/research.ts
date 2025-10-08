import { MessagesZodState } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { z } from "zod";
import { createLLM } from "../../../shared/configs/llm";
import { SearchRunMetadataSchema } from "../../../types/react-agent";
import { RESEARCH_SUBAGENT_SYSTEM_PROMPT } from "../prompts/research-system";
import { createSearchTools } from "../tools/search";

type AgentParams = Parameters<typeof createAgent>[0];

const DEFAULT_RESEARCH_TEMPERATURE = 0.2;

const ResearchSubagentStateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  searchRuns: z.array(SearchRunMetadataSchema).default([]),
});

export type ResearchSubagentState = z.infer<typeof ResearchSubagentStateSchema>;

export function createResearchSubagent() {
  const llm = createLLM("gemini-2.5-pro", DEFAULT_RESEARCH_TEMPERATURE);
  const tools = createSearchTools();
  const config = {
    llm,
    tools,
    stateSchema: ResearchSubagentStateSchema,
    prompt: RESEARCH_SUBAGENT_SYSTEM_PROMPT,
  };

  return createAgent(config as unknown as AgentParams);
}
