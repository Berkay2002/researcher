/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { harvestResults } from "../../../../services/harvest";
import type { ParentState } from "../../../state";

/**
 * Harvest Node
 *
 * Fetches full content from search results
 * Extracts text, generates content hashes, and chunks documents
 */
export async function harvest(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[harvest] Fetching full content from search results...");

  const { searchResults } = state;

  if (!searchResults || searchResults.length === 0) {
    console.log("[harvest] No search results to harvest");
    return {
      evidence: [],
    };
  }

  console.log(`[harvest] Harvesting ${searchResults.length} URLs`);

  // Harvest with robots.txt respect and timeouts
  const evidence = await harvestResults(searchResults, {
    timeout: 10_000,
    respectRobotsTxt: true,
    userAgent: "ResearchAssistant/1.0 (Educational)",
  });

  console.log(`[harvest] Successfully harvested ${evidence.length} documents`);

  // Log chunk statistics
  const totalChunks = evidence.reduce((sum, ev) => sum + ev.chunks.length, 0);
  console.log(`[harvest] Generated ${totalChunks} total chunks`);

  return {
    evidence,
  };
}
