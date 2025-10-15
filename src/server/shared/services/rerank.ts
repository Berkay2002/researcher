import type { Evidence } from "@/server/workflows/researcher/graph/state";
import { normalizeUrl } from "../utils/url";

// Constants for reranking configuration
const DEFAULT_RECENCY_BOOST = 0.2;
const DEFAULT_AUTHORITY_BOOST = 0.3;
const CONTENT_QUALITY_INCREMENT = 0.1;
const CONTENT_QUALITY_SMALL_INCREMENT = 0.05;
const MIN_TITLE_LENGTH = 50;
const MIN_SNIPPET_LENGTH = 100;
const CHUNK_COUNT_THRESHOLD_1 = 5;
const CHUNK_COUNT_THRESHOLD_2 = 10;
const BASE_SCORE = 1.0;

/**
 * Rerank options
 */
export type RerankOptions = {
  /** Boost factor for recent documents (0-1) */
  recencyBoost?: number;
  /** Boost factor for authoritative domains (0-1) */
  authorityBoost?: number;
  /** List of authoritative domains */
  authoritativeDomains?: string[];
};

/**
 * Deduplicate evidence by content hash and rerank by recency/authority
 */
export function dedupAndRerank(
  evidence: Evidence[],
  options: RerankOptions = {}
): Evidence[] {
  const {
    recencyBoost = DEFAULT_RECENCY_BOOST,
    authorityBoost = DEFAULT_AUTHORITY_BOOST,
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
  let score = BASE_SCORE;

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
  if (chunkCount > CHUNK_COUNT_THRESHOLD_1) {
    score += CONTENT_QUALITY_INCREMENT;
  }
  if (chunkCount > CHUNK_COUNT_THRESHOLD_2) {
    score += CONTENT_QUALITY_INCREMENT;
  }

  // Longer title often indicates more specific content
  if (evidence.title.length > MIN_TITLE_LENGTH) {
    score += CONTENT_QUALITY_SMALL_INCREMENT;
  }

  // Presence of snippet
  if (evidence.snippet && evidence.snippet.length > MIN_SNIPPET_LENGTH) {
    score += CONTENT_QUALITY_SMALL_INCREMENT;
  }

  return score;
}
