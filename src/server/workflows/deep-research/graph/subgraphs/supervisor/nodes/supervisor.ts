/**
 * Supervisor Node
 *
 * Lead supervisor that delegates research tasks to specialized sub-agents.
 * Manages parallel research execution and determines when research is complete.
 */

import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import type { AgentMiddleware } from "langchain";
import { createAgent, modelCallLimitMiddleware } from "langchain";
import {
  createSupervisorModel,
  getConfiguration,
} from "../../../../configuration";
import {
  ConductResearchSchema,
  ResearchCompleteSchema,
  type SupervisorState,
} from "../../../../graph/state";
import { leadResearcherPrompt } from "../../../../prompts";
import { getTodayStr, thinkTool } from "../../../../utils";

/**
 * Create ConductResearch tool for delegating research
 *
 * @param research_topic - The topic to delegate research on
 * @returns A string indicating the research has been delegated
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
 *
 * @returns A string indicating the research has been marked as complete
 */
const researchCompleteTool = tool((): string => "Research marked as complete", {
  name: "ResearchComplete",
  description: "Call this tool to indicate that the research is complete",
  schema: ResearchCompleteSchema,
});

/**
 * Supervisor node that manages research delegation using agent with middleware
 *
 * @param state - The current state of the supervisor
 * @param config - The configuration for the supervisor
 * @returns A partial state update for the supervisor
 */
export async function supervisor(
  state: SupervisorState,
  config?: RunnableConfig
): Promise<Partial<SupervisorState>> {
  const configuration = getConfiguration(config);
  const { research_brief } = state;

  // Validate research_brief is present
  if (!research_brief) {
    throw new Error(
      "research_brief is required for supervisor but was not provided"
    );
  }

  // Create model instance with tracing support from configuration
  const model = createSupervisorModel(config);

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
  const middleware: AgentMiddleware<any, any, any>[] = [];

  if (configuration.use_model_call_limit) {
    middleware.push(
      modelCallLimitMiddleware({
        threadLimit: configuration.max_researcher_iterations,
        runLimit: Math.ceil(configuration.max_researcher_iterations / 2), // Allow multiple runs per thread
        exitBehavior: "end",
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
      role: "system" as const,
      content: systemPrompt,
    },
    {
      role: "user" as const,
      content: research_brief,
    },
  ];

  // Invoke agent
  try {
    const response = await agent.invoke({ messages }, config);

    return {
      supervisor_messages: response.messages || [
        new AIMessage({ content: "Research completed." }),
      ],
    };
  } catch (error) {
    const err = error as Error;
    const DEBUG_BRIEF_LENGTH = 100;
    // Log the full error for debugging
    // biome-ignore lint/suspicious/noConsole: Debugging supervisor errors
    console.error("Supervisor agent error:", {
      message: err.message,
      stack: err.stack,
      model,
      research_brief: research_brief?.substring(0, DEBUG_BRIEF_LENGTH),
    });

    throw new Error(`Supervisor failed: ${err.message}`);
  }
}
