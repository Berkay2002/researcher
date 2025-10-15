/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */

import { searchAll } from "@/server/shared/services/search-gateway";
import type { ParentState, UnifiedSearchDoc } from "../../../state";

// Regex for URL normalization
const TRAILING_SLASH_REGEX = /\/+$/u;

/**
 * HarvestSelected Node
 *
 * Phase C: enrichment (network calls)
 * Fetches full content for selected URLs from discovery phase
 * Writes enriched docs back to state.research.enriched
 */
export async function harvestSelected(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log(
    "[harvestSelected] Fetching full content for selected candidates..."
  );

  const research = state.research ?? {};
  const { selected, discovery } = research;

  if (!selected || selected.length === 0) {
    console.log("[harvestSelected] No selected candidates to enrich");
    return {
      research: {
        ...research,
        enriched: [],
      },
    };
  }

  if (!discovery || discovery.length === 0) {
    console.log("[harvestSelected] No discovery results available");
    return {
      research: {
        ...research,
        enriched: [],
      },
    };
  }

  console.log(
    `[harvestSelected] Enriching ${selected.length} selected candidates`
  );

  // Create URL lookup from discovery
  const urlById = new Map(discovery.map((doc) => [doc.id, doc.url]));

  // Extract URLs for selected IDs
  const urls = selected
    .map((id) => urlById.get(id))
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0) {
    console.log(
      "[harvestSelected] No valid URLs found for selected candidates"
    );
    return {
      research: {
        ...research,
        enriched: [],
      },
    };
  }

  // Fetch full content using search gateway in enrichment mode
  const enrichedDocs = await searchAll({
    mode: "enrich",
    urls,
  });

  // Add URL-level deduplication to avoid double counting
  const byUrl = new Map<string, UnifiedSearchDoc>();

  for (const d of enrichedDocs) {
    const key = d.url.toLowerCase().replace(TRAILING_SLASH_REGEX, "");
    if (!byUrl.has(key)) {
      byUrl.set(key, d);
    }
  }
  const uniqueEnriched = [...byUrl.values()];

  console.log(
    `[harvestSelected] Successfully enriched ${uniqueEnriched.length} documents`
  );

  // Log content statistics
  const totalContentLength = uniqueEnriched.reduce(
    (sum, doc) => sum + (doc.content?.length || 0),
    0
  );
  console.log(
    `[harvestSelected] Total content length: ${totalContentLength} characters`
  );

  return {
    research: {
      ...research,
      enriched: uniqueEnriched,
    },
  };
}
