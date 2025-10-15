/**
 * Supervisor Node
 *
 * Lead supervisor that delegates research tasks to specialized sub-agents.
 * Manages parallel research execution and determines when research is complete.
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { createLLM } from "@/server/shared/configs/llm";
import { getConfiguration } from "../../../../configuration";
import {
  ConductResearchSchema,
  ResearchCompleteSchema,
  type SupervisorState,
} from "../../../../graph/state";
import { leadResearcherPrompt } from "../../../../prompts";
import { getTodayStr, thinkTool } from "../../../../utils";

const SUPERVISOR_TEMPERATURE = 0.3; // Agentic reasoning temperature

/**
 * Create ConductResearch tool for delegating research
 */
const conductResearchTool = tool(
  ({ research_topic }: { research_topic: string }): string =>
    `Delegated research on: ${research_topic}`,
  {
    name: "ConductResearch",
    description:
      "Delegate research on a specific topic to a specialized researcher",
    schema: ConductResearchSchema,
  }
);

/**
 * Create ResearchComplete tool for indicating completion
 */
const researchCompleteTool = tool((): string => "Research marked as complete", {
  name: "ResearchComplete",
  description: "Call this tool to indicate that the research is complete",
  schema: ResearchCompleteSchema,
});

/**
 * Supervisor node that manages research delegation
 */
export async function supervisor(
  state: SupervisorState,
  config?: RunnableConfig
): Promise<Partial<SupervisorState>> {
  const configuration = getConfiguration(config);
  const { supervisor_messages, research_brief, research_iterations } = state;

  // Check if we've hit max iterations
  if (research_iterations >= configuration.max_researcher_iterations) {
    // Force completion
    return {
      supervisor_messages: [
        new AIMessage({
          content: "Maximum research iterations reached. Completing research.",
        }),
      ],
    };
  }

  // Configure LLM with tools
  const model = createLLM(
    configuration.research_model,
    SUPERVISOR_TEMPERATURE,
    {
      maxTokens: configuration.research_model_max_tokens,
    }
  );

  const tools = [conductResearchTool, researchCompleteTool, thinkTool];
  const modelWithTools = model.bindTools(tools);

  // Prepare system prompt
  const systemPrompt = leadResearcherPrompt
    .replace("{date}", getTodayStr())
    .replace(
      "{max_researcher_iterations}",
      String(configuration.max_researcher_iterations)
    )
    .replace(
      "{max_concurrent_research_units}",
      String(configuration.max_concurrent_research_units)
    );

  // Build messages array
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: `Research Brief: ${research_brief}`,
    },
    ...supervisor_messages,
  ];

  // Invoke model
  const response = await modelWithTools.invoke(messages);

  return {
    supervisor_messages: [new AIMessage(response)],
    research_iterations: research_iterations + 1,
  };
}
