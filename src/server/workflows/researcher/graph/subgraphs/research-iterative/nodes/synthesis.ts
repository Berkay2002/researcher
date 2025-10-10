/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { ParentState } from "../../../state";

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
 * @param state Parent state with iterative research findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with research.enriched for synthesizer
 */
export async function synthesisNode(
  state: ParentState,
  config: LangGraphRunnableConfig
): Promise<Partial<ParentState>> {
  const writer = config.writer;
  const enrichedSources = state.research?.enriched || [];

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

  // Calculate statistics from enriched sources
  const totalSources = enrichedSources.length;
  const uniqueProviders = new Set(enrichedSources.map((s) => s.provider));

  console.log("[Synthesis] Summary:");
  console.log("  - 3 research rounds completed");
  console.log(`  - ${totalSources} unique sources gathered`);
  console.log(`  - Providers used: ${Array.from(uniqueProviders).join(", ")}`);

  if (writer) {
    await writer({
      type: "thought",
      round: 4,
      content: `Analyzed ${totalSources} sources across 3 research rounds.`,
    });
  }

  if (writer) {
    await writer({
      type: "complete",
      round: 4,
      content: `Research complete! ${totalSources} sources gathered and ready for synthesis.`,
    });
  }

  // Mark research as complete
  // The enriched sources are already in state.research.enriched (accumulated by search nodes)
  // Synthesizer node in parent workflow will read from this field
  return {
    // No need to update research.enriched here - search nodes already did that
  };
}
