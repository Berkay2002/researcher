/**
 * Supervisor Node
 *
 * Lead supervisor that delegates research tasks to specialized sub-agents.
 * Manages parallel research execution and determines when research is complete.
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import {
  ClearToolUsesEdit,
  contextEditingMiddleware,
  createAgent,
  modelCallLimitMiddleware,
} from "langchain";
import { getConfiguration } from "../../../../configuration";
import {
  ConductResearchSchema,
  ResearchCompleteSchema,
  type SupervisorState,
} from "../../../../graph/state";
import { leadResearcherPrompt } from "../../../../prompts";
import { getTodayStr, thinkTool } from "../../../../utils";

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
 * Supervisor node that manages research delegation using agent with middleware
 */
export async function supervisor(
  state: SupervisorState,
  config?: RunnableConfig
): Promise<Partial<SupervisorState>> {
  const configuration = getConfiguration(config);
  const { supervisor_messages, research_brief } = state;

  // Configure LLM
  const model: string = configuration.research_model;

  const tools = [conductResearchTool, researchCompleteTool, thinkTool];

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

  // Prepare middleware
  // biome-ignore lint/suspicious/noExplicitAny: <Different middleware types have different schemas>
  const middleware: any[] = [];

  if (configuration.use_model_call_limit) {
    middleware.push(
      modelCallLimitMiddleware({
        threadLimit: configuration.max_researcher_iterations,
        runLimit: Math.ceil(configuration.max_researcher_iterations / 2), // Allow multiple runs per thread
        exitBehavior: "end",
      })
    );
  }

  if (configuration.use_context_editing) {
    middleware.push(
      contextEditingMiddleware({
        edits: [new ClearToolUsesEdit({})],
      })
    );
  }

  // Create agent with middleware
  const agent = createAgent({
    model,
    tools,
    middleware,
  });

  // Build initial messages
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

  // Invoke agent
  const response = await agent.invoke({ messages }, config);

  return {
    supervisor_messages: response.messages || [
      new AIMessage({ content: "Research completed." }),
    ],
  };
}
