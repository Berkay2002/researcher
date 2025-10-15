import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Strategic reflection tool for research planning
 * This matches the think_tool from deep-research/utils.ts
 */
export const thinkTool = tool(
  ({ reflection }: { reflection: string }): string =>
    `Reflection recorded: ${reflection}`,
  {
    name: "think_tool",
    description: "Strategic reflection tool for research planning and analysis",
    schema: z.object({
      reflection: z
        .string()
        .describe(
          "Your detailed reflection on research progress, findings, gaps, and next steps"
        ),
    }),
  }
);

/**
 * Export the think tool for consistency with deep-research workflow
 */
export { thinkTool as createThinkTool };
