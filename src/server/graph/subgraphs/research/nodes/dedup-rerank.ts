/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { dedupAndRerank } from "../../../../services/rerank";
import type { ParentState } from "../../../state";

// Constants for deduplication and reranking
const DEFAULT_RECENCY_BOOST = 0.2;
const DEFAULT_AUTHORITY_BOOST = 0.3;
const DEFAULT_MAX_EVIDENCE = 50;

/**
 * DedupRerank Node
 *
 * Final processing step:
 * - Deduplicates evidence by content hash
 * - Reranks by recency and authority
 * - Returns final ordered evidence array
 */
export async function dedupRerank(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[dedupRerank] Deduplicating and reranking evidence...");

  const { evidence, plan } = state;

  if (!evidence || evidence.length === 0) {
    console.log("[dedupRerank] No evidence to process");
    return {
      evidence: [],
    };
  }

  console.log(`[dedupRerank] Processing ${evidence.length} evidence items`);

  // Extract reranking constraints from plan if available
  const constraints = plan?.constraints || {};
  const authoritativeDomains = Array.isArray(constraints.authoritativeDomains)
    ? (constraints.authoritativeDomains as string[])
    : undefined;

  // Deduplicate and rerank
  const reranked = dedupAndRerank(evidence, {
    recencyBoost: DEFAULT_RECENCY_BOOST,
    authorityBoost: DEFAULT_AUTHORITY_BOOST,
    authoritativeDomains,
  });

  console.log(
    `[dedupRerank] After deduplication: ${reranked.length} unique items`
  );

  // Limit to top N if constraints specify max evidence
  const maxEvidence =
    typeof constraints.maxEvidence === "number"
      ? constraints.maxEvidence
      : DEFAULT_MAX_EVIDENCE;

  const limited = reranked.slice(0, maxEvidence);

  if (limited.length < reranked.length) {
    console.log(
      `[dedupRerank] Limited to top ${limited.length} evidence items`
    );
  }

  return {
    evidence: limited,
  };
}
