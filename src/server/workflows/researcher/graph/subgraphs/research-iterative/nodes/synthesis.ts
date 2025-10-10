/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { IterativeResearchState } from "../state";

/**
 * Synthesis Node
 *
 * Final node that prepares all gathered sources for the downstream synthesizer.
 * This node writes to the research.enriched field that the existing synthesizer expects.
 *
 * Pattern from: documentation/langgraph/04-persistence.md
 * - Returns partial state update
 * - Uses config.writer for streaming completion event
 * - NO custom synthesis logic - just preparation for existing workflow synthesizer
 *
 * The actual synthesis (writing the report) is done by the existing
 * synthesizer node in the parent workflow, which reads from research.enriched.
 *
 * @param state Current iterative research state with all findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update marking research complete
 */
export async function synthesisNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { findings, allSources } = state;
  const writer = config.writer;

  console.log(
    "[Synthesis] Preparing research results for downstream synthesizer..."
  );

  if (writer) {
    await writer({
      type: "thought",
      round: 4,
      content: "Synthesizing all findings into comprehensive evidence base...",
    });
  }

  // Calculate statistics
  const totalQueries = findings.reduce((sum, f) => sum + f.queries.length, 0);
  const totalSources = allSources.length;
  const uniqueProviders = new Set(
    findings.flatMap((f) => f.metadata.providersUsed)
  );

  console.log("[Synthesis] Summary:");
  console.log(`  - ${findings.length} research rounds completed`);
  console.log(`  - ${totalQueries} queries executed`);
  console.log(`  - ${totalSources} unique sources gathered`);
  console.log(`  - Providers used: ${Array.from(uniqueProviders).join(", ")}`);

  if (writer) {
    await writer({
      type: "thought",
      round: 4,
      content: `Analyzed ${totalSources} sources across ${findings.length} research rounds (${totalQueries} queries).`,
    });
  }

  if (writer) {
    await writer({
      type: "complete",
      round: 4,
      content: `Research complete! ${totalSources} sources gathered and ready for synthesis.`,
    });
  }

  // Return state update that marks research complete
  // The allSources array is already accumulated via Annotation reducer
  // No need to return it again
  return {
    researchComplete: true,
  };
}
