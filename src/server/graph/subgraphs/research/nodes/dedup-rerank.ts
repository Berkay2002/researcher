/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { ParentState } from "../../../state";
import { dedupAndRerank } from "../../../../services/rerank";

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
		recencyBoost: 0.2,
		authorityBoost: 0.3,
		authoritativeDomains,
	});

	console.log(
		`[dedupRerank] After deduplication: ${reranked.length} unique items`
	);

	// Limit to top N if constraints specify max evidence
	const maxEvidence =
		typeof constraints.maxEvidence === "number"
			? constraints.maxEvidence
			: 50;

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
