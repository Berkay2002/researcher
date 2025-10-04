import type { Evidence } from "../graph/state";
import { normalizeUrl } from "../utils/url";

/**
 * Rerank options
 */
export interface RerankOptions {
	/** Boost factor for recent documents (0-1) */
	recencyBoost?: number;
	/** Boost factor for authoritative domains (0-1) */
	authorityBoost?: number;
	/** List of authoritative domains */
	authoritativeDomains?: string[];
}

/**
 * Deduplicate evidence by content hash and rerank by recency/authority
 */
export function dedupAndRerank(
	evidence: Evidence[],
	options: RerankOptions = {}
): Evidence[] {
	const {
		recencyBoost = 0.2,
		authorityBoost = 0.3,
		authoritativeDomains = [
			"wikipedia.org",
			"github.com",
			"arxiv.org",
			"scholar.google.com",
			".edu",
			".gov",
		],
	} = options;

	// Deduplicate by content hash
	const deduped = deduplicateByContentHash(evidence);

	// Score and sort
	const scored = deduped.map((ev) => ({
		evidence: ev,
		score: calculateScore(ev, {
			recencyBoost,
			authorityBoost,
			authoritativeDomains,
		}),
	}));

	scored.sort((a, b) => b.score - a.score);

	return scored.map((item) => item.evidence);
}

/**
 * Deduplicate evidence by content hash
 */
function deduplicateByContentHash(evidence: Evidence[]): Evidence[] {
	const seen = new Set<string>();
	const unique: Evidence[] = [];

	for (const ev of evidence) {
		// Use combination of contentHash and normalized URL for deduplication
		const key = `${ev.contentHash}:${normalizeUrl(ev.url)}`;

		if (!seen.has(key)) {
			seen.add(key);
			unique.push(ev);
		}
	}

	return unique;
}

/**
 * Calculate ranking score for evidence
 */
function calculateScore(
	evidence: Evidence,
	options: Required<RerankOptions>
): number {
	let score = 1.0;

	// Authority boost
	const domain = extractDomain(evidence.url);
	if (domain && isAuthoritative(domain, options.authoritativeDomains)) {
		score += options.authorityBoost;
	}

	// Recency boost (if publishedAt is available)
	// For now, we don't have reliable publishedAt in all cases
	// This would be enhanced with better metadata extraction

	// Content quality signals
	score += calculateContentQualityScore(evidence);

	return score;
}

/**
 * Check if domain is authoritative
 */
function isAuthoritative(
	domain: string,
	authoritativeDomains: string[]
): boolean {
	const lowerDomain = domain.toLowerCase();

	for (const authDomain of authoritativeDomains) {
		if (
			lowerDomain === authDomain ||
			lowerDomain.endsWith(`.${authDomain}`) ||
			lowerDomain.includes(authDomain)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.hostname;
	} catch {
		return null;
	}
}

/**
 * Calculate content quality score based on various signals
 */
function calculateContentQualityScore(evidence: Evidence): number {
	let score = 0;

	// More chunks generally means more comprehensive content
	const chunkCount = evidence.chunks.length;
	if (chunkCount > 5) {
		score += 0.1;
	}
	if (chunkCount > 10) {
		score += 0.1;
	}

	// Longer title often indicates more specific content
	if (evidence.title.length > 50) {
		score += 0.05;
	}

	// Presence of snippet
	if (evidence.snippet && evidence.snippet.length > 100) {
		score += 0.05;
	}

	return score;
}
