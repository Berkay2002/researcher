/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { Citation, Evidence } from "../graph/state";

// Constants for provenance validation
const EXCERPT_SUBSTRING_LENGTH = 100;
const SIMILARITY_THRESHOLD = 0.8;
const MIN_KEYWORD_LENGTH = 4;
const MAX_KEYWORDS = 10;
const MIN_KEYWORD_SCORE = 2;
const MAX_EXCERPT_LENGTH = 300;
const DEFAULT_EXCERPT_LENGTH = 200;
const TITLE_TRUNCATION_LENGTH = 50;
const COVERAGE_PERCENTAGE_MULTIPLIER = 100;
const MAX_COVERAGE_PERCENTAGE = 100;

// Regex patterns for text processing
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Provenance Service
 *
 * Manages citation tracking, provenance validation, and evidence linking
 * for the research assistant system.
 */

/**
 * Type for citation tracking information
 */
export type CitationProvenance = {
  citationId: string;
  evidenceUrl: string;
  evidenceTitle: string;
  excerpt: string;
  confidence: number;
  validationStatus: "validated" | "pending" | "invalid";
  validationReason?: string;
};

/**
 * Type for provenance validation results
 */
export type ProvenanceValidation = {
  isValid: boolean;
  validatedCitations: number;
  totalCitations: number;
  invalidCitations: Array<{
    citationId: string;
    reason: string;
  }>;
};

/**
 * Type for citation creation parameters
 */
export type CreateCitationParams = {
  id: string;
  url: string;
  title: string;
  excerpt: string;
};

/**
 * Create a citation with provenance tracking
 */
export function createCitation(
  params: CreateCitationParams,
  evidence?: Evidence
): Citation {
  const { id, url, title, excerpt } = params;

  // Validate citation against evidence if provided
  const validation = evidence
    ? validateCitationAgainstEvidence({ id, url, title, excerpt }, evidence)
    : { isValid: true, reason: "No evidence provided for validation" };

  console.log(`[provenance] Creating citation ${id}:`, {
    url,
    title: `${title.substring(0, TITLE_TRUNCATION_LENGTH)}...`,
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
  const excerptExists =
    evidence.chunks.some((chunk) =>
      chunk.content
        .toLowerCase()
        .includes(
          citation.excerpt.toLowerCase().substring(0, EXCERPT_SUBSTRING_LENGTH)
        )
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

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  const similarity = intersection.size / union.size;

  // Consider similar if more than 80% of words match
  return similarity > SIMILARITY_THRESHOLD;
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

  console.log(
    `[provenance] Validating ${citations.length} citations against ${evidence.length} evidence sources`
  );

  for (const citation of citations) {
    const evidenceMatch = evidence.find((e) => e.url === citation.url);

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

  console.log(
    `[provenance] Validation complete: ${validatedCitations}/${citations.length} citations validated`
  );

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
      return `${evidence.chunks[0].content.substring(0, DEFAULT_EXCERPT_LENGTH)}...`;
    }
    // Return first chunk content if no chunks available
    return evidence.chunks[0]?.content || "";
  }

  // Extract keywords from context
  const keywords = context
    .toLowerCase()
    .split(WORD_SPLIT_REGEX)
    .filter((word) => word.length > MIN_KEYWORD_LENGTH)
    .slice(0, MAX_KEYWORDS);

  // Find best matching excerpt from chunks
  let bestExcerpt = "";
  let bestScore = 0;

  for (const chunk of evidence.chunks) {
    const score = keywords.reduce(
      (acc, keyword) =>
        acc + (chunk.content.toLowerCase().includes(keyword) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestExcerpt = chunk.content;
    }
  }

  // If no good chunk match, try combining all chunks
  if (bestScore < MIN_KEYWORD_SCORE) {
    const allContent = evidence.chunks.map((chunk) => chunk.content).join(" ");
    const contentScore = keywords.reduce(
      (acc, keyword) =>
        acc + (allContent.toLowerCase().includes(keyword) ? 1 : 0),
      0
    );

    if (contentScore > bestScore) {
      bestExcerpt = allContent;
    }
  }

  // Truncate to reasonable length
  if (bestExcerpt.length > MAX_EXCERPT_LENGTH) {
    bestExcerpt = `${bestExcerpt.substring(0, MAX_EXCERPT_LENGTH)}...`;
  }

  return (
    bestExcerpt ||
    `${evidence.chunks[0]?.content?.substring(0, DEFAULT_EXCERPT_LENGTH) || ""}...`
  );
}

/**
 * Format citations for display
 */
export function formatCitations(citations: Citation[]): string {
  return citations
    .map(
      (citation, index) => `[${index + 1}] ${citation.title}. ${citation.url}`
    )
    .join("\n");
}

/**
 * Generate a citation map for quick lookup
 */
export function generateCitationMap(
  citations: Citation[]
): Map<string, Citation> {
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
export function findDuplicateCitations(
  citations: Citation[]
): Array<{ duplicate: Citation; original: Citation }> {
  const seen = new Map<string, Citation>();
  const duplicates: Array<{ duplicate: Citation; original: Citation }> = [];

  for (const citation of citations) {
    const key = `${citation.url}-${citation.title}`;
    if (seen.has(key)) {
      duplicates.push({
        duplicate: citation,
        // biome-ignore lint/style/noNonNullAssertion: <Safe>
        original: seen.get(key)!,
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
  const evidenceUrls = new Set(evidence.map((e) => e.url));
  const citedUrls = new Set(citations.map((c) => c.url));
  const domains = new Set(citations.map((c) => new URL(c.url).hostname));

  const coverage =
    (citedUrls.size / evidenceUrls.size) * COVERAGE_PERCENTAGE_MULTIPLIER;
  const utilization =
    (citedUrls.size / citations.length) * COVERAGE_PERCENTAGE_MULTIPLIER;
  const diversity = domains.size;

  return {
    coverage: Math.min(coverage, MAX_COVERAGE_PERCENTAGE),
    utilization: Math.min(utilization, MAX_COVERAGE_PERCENTAGE),
    diversity,
  };
}
