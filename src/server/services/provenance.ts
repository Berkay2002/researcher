/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { Citation, Evidence } from "../graph/state";

/**
 * Provenance Service
 *
 * Manages citation tracking, provenance validation, and evidence linking
 * for the research assistant system.
 */

/**
 * Interface for citation tracking information
 */
export interface CitationProvenance {
	citationId: string;
	evidenceUrl: string;
	evidenceTitle: string;
	excerpt: string;
	confidence: number;
	validationStatus: "validated" | "pending" | "invalid";
	validationReason?: string;
}

/**
 * Interface for provenance validation results
 */
export interface ProvenanceValidation {
	isValid: boolean;
	validatedCitations: number;
	totalCitations: number;
	invalidCitations: Array<{
		citationId: string;
		reason: string;
	}>;
}

/**
 * Create a citation with provenance tracking
 */
export function createCitation(
	id: string,
	url: string,
	title: string,
	excerpt: string,
	evidence?: Evidence
): Citation {
	// Validate citation against evidence if provided
	const validation = evidence ? validateCitationAgainstEvidence(
		{ id, url, title, excerpt },
		evidence
	) : { isValid: true, reason: "No evidence provided for validation" };

	console.log(`[provenance] Creating citation ${id}:`, {
		url,
		title: title.substring(0, 50) + "...",
		isValid: validation.isValid,
	});

	return {
		id,
		url,
		title,
		excerpt,
	};
}

/**
 * Validate a citation against evidence
 */
export function validateCitationAgainstEvidence(
	citation: Citation,
	evidence: Evidence
): { isValid: boolean; reason: string } {
	// Check URL match
	if (citation.url !== evidence.url) {
		return {
			isValid: false,
			reason: `URL mismatch: citation="${citation.url}" vs evidence="${evidence.url}"`,
		};
	}

	// Check title similarity (allowing for minor variations)
	if (!areTitlesSimilar(citation.title, evidence.title)) {
		return {
			isValid: false,
			reason: `Title mismatch: citation="${citation.title}" vs evidence="${evidence.title}"`,
		};
	}

	// Check if excerpt exists in evidence content
	const excerptExists = evidence.content.toLowerCase().includes(
		citation.excerpt.toLowerCase().substring(0, 100)
	) || evidence.chunks.some(chunk =>
		chunk.content.toLowerCase().includes(citation.excerpt.toLowerCase().substring(0, 100))
	);

	if (!excerptExists) {
		return {
			isValid: false,
			reason: "Excerpt not found in evidence content",
		};
	}

	return {
		isValid: true,
		reason: "Citation successfully validated against evidence",
	};
}

/**
 * Check if two titles are similar (allowing for minor variations)
 */
function areTitlesSimilar(title1: string, title2: string): boolean {
	// Direct match
	if (title1.trim() === title2.trim()) {
		return true;
	}

	// Normalize titles for comparison
	const normalizeTitle = (title: string): string => {
		return title
			.toLowerCase()
			.replace(/[^\w\s]/g, "") // Remove punctuation
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();
	};

	const normalized1 = normalizeTitle(title1);
	const normalized2 = normalizeTitle(title2);

	// Check for high similarity after normalization
	if (normalized1 === normalized2) {
		return true;
	}

	// Check if one is a substring of the other (allowing for truncation)
	if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
		return true;
	}

	// Calculate Jaccard similarity for fuzzy matching
	const words1 = new Set(normalized1.split(" "));
	const words2 = new Set(normalized2.split(" "));

	const intersection = new Set([...words1].filter(x => words2.has(x)));
	const union = new Set([...words1, ...words2]);

	const similarity = intersection.size / union.size;

	// Consider similar if more than 80% of words match
	return similarity > 0.8;
}

/**
 * Validate multiple citations against available evidence
 */
export function validateCitationsProvenance(
	citations: Citation[],
	evidence: Evidence[]
): ProvenanceValidation {
	const invalidCitations: Array<{ citationId: string; reason: string }> = [];
	let validatedCitations = 0;

	console.log(`[provenance] Validating ${citations.length} citations against ${evidence.length} evidence sources`);

	for (const citation of citations) {
		const evidenceMatch = evidence.find(e => e.url === citation.url);

		if (!evidenceMatch) {
			invalidCitations.push({
				citationId: citation.id,
				reason: "No matching evidence found for citation URL",
			});
			continue;
		}

		const validation = validateCitationAgainstEvidence(citation, evidenceMatch);
		if (validation.isValid) {
			validatedCitations++;
		} else {
			invalidCitations.push({
				citationId: citation.id,
				reason: validation.reason,
			});
		}
	}

	const isValid = invalidCitations.length === 0;

	console.log(`[provenance] Validation complete: ${validatedCitations}/${citations.length} citations validated`);

	return {
		isValid,
		validatedCitations,
		totalCitations: citations.length,
		invalidCitations,
	};
}

/**
 * Extract relevant excerpt from evidence for a citation
 */
export function extractRelevantExcerpt(
	evidence: Evidence,
	context?: string
): string {
	if (!context) {
		// Return first chunk or beginning of content
		if (evidence.chunks.length > 0) {
			return evidence.chunks[0].content.substring(0, 200) + "...";
		}
		return evidence.content.substring(0, 200) + "...";
	}

	// Extract keywords from context
	const keywords = context
		.toLowerCase()
		.split(/\s+/)
		.filter(word => word.length > 4)
		.slice(0, 10);

	// Find best matching excerpt from chunks
	let bestExcerpt = "";
	let bestScore = 0;

	for (const chunk of evidence.chunks) {
		const score = keywords.reduce((acc, keyword) => {
			return acc + (chunk.content.toLowerCase().includes(keyword) ? 1 : 0);
		}, 0);

		if (score > bestScore) {
			bestScore = score;
			bestExcerpt = chunk.content;
		}
	}

	// If no good chunk match, try the full content
	if (bestScore < 2) {
		const contentScore = keywords.reduce((acc, keyword) => {
			return acc + (evidence.content.toLowerCase().includes(keyword) ? 1 : 0);
		}, 0);

		if (contentScore > bestScore) {
			bestExcerpt = evidence.content;
		}
	}

	// Truncate to reasonable length
	if (bestExcerpt.length > 300) {
		bestExcerpt = bestExcerpt.substring(0, 300) + "...";
	}

	return bestExcerpt || evidence.content.substring(0, 200) + "...";
}

/**
 * Format citations for display
 */
export function formatCitations(citations: Citation[]): string {
	return citations
		.map((citation, index) => {
			return `[${index + 1}] ${citation.title}. ${citation.url}`;
		})
		.join("\n");
}

/**
 * Generate a citation map for quick lookup
 */
export function generateCitationMap(citations: Citation[]): Map<string, Citation> {
	const citationMap = new Map<string, Citation>();

	for (const citation of citations) {
		citationMap.set(citation.id, citation);
		citationMap.set(citation.url, citation);
	}

	return citationMap;
}

/**
 * Check for duplicate citations
 */
export function findDuplicateCitations(citations: Citation[]): Array<{ duplicate: Citation; original: Citation }> {
	const seen = new Map<string, Citation>();
	const duplicates: Array<{ duplicate: Citation; original: Citation }> = [];

	for (const citation of citations) {
		const key = `${citation.url}-${citation.title}`;
		if (seen.has(key)) {
			duplicates.push({
				duplicate: citation,
				original: seen.get(key)!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
			});
		} else {
			seen.set(key, citation);
		}
	}

	return duplicates;
}

/**
 * Calculate citation coverage metrics
 */
export function calculateCitationCoverage(
	citations: Citation[],
	evidence: Evidence[]
): {
	coverage: number; // Percentage of evidence that's cited
	utilization: number; // Percentage of citations that have evidence
	diversity: number; // Number of unique domains cited
} {
	const evidenceUrls = new Set(evidence.map(e => e.url));
	const citedUrls = new Set(citations.map(c => c.url));
	const domains = new Set(citations.map(c => new URL(c.url).hostname));

	const coverage = (citedUrls.size / evidenceUrls.size) * 100;
	const utilization = (citedUrls.size / citations.length) * 100;
	const diversity = domains.size;

	return {
		coverage: Math.min(coverage, 100),
		utilization: Math.min(utilization, 100),
		diversity,
	};
}