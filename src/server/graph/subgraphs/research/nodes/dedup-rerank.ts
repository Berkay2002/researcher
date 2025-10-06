/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */

import { hashContent } from "../../../../utils/hashing";
import { chunkText } from "../../../../utils/text";
import type { Evidence, ParentState, UnifiedSearchDoc } from "../../../state";

// Constants for deduplication and reranking
const DEFAULT_RECENCY_BOOST = 0.2;
const DEFAULT_AUTHORITY_BOOST = 0.3;
const DEFAULT_MAX_EVIDENCE = 50;
const MAX_CHUNK_SIZE = 1000;
const CHUNK_OVERLAP_SIZE = 100;
const CONTENT_QUALITY_INCREMENT = 0.1;
const CONTENT_QUALITY_SMALL_INCREMENT = 0.05;
const MIN_TITLE_LENGTH = 10;
const MIN_EXCERPT_LENGTH = 100;
const BASE_SCORE = 1.0;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY =
  MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
const RECENT_DAYS_THRESHOLD = 30;
const MIN_CONTENT_LENGTH = 1000;

// Authority domains for ranking
const DEFAULT_AUTHORITATIVE_DOMAINS = [
  "wikipedia.org",
  "github.com",
  "arxiv.org",
  "scholar.google.com",
  ".edu",
  ".gov",
  "sec.gov",
  "reuters.com",
  "ft.com",
  "wsj.com",
];

/**
 * DedupRerank Node
 *
 * Phase D: final processing
 * - Deduplicates enriched documents by content hash
 * - Reranks by recency and authority
 * - Converts UnifiedSearchDoc to Evidence for backward compatibility
 * - Returns final ordered evidence array and research.final
 */
export function dedupRerank(state: ParentState): Partial<ParentState> {
  console.log(
    "[dedupRerank] Deduplicating and reranking enriched documents..."
  );

  const research = state.research ?? {};
  const { enriched } = research;
  const { plan } = state;

  if (!enriched || enriched.length === 0) {
    console.log("[dedupRerank] No enriched documents to process");
    return {
      research: {
        ...research,
        final: [],
      },
      evidence: [], // Maintain backward compatibility
    };
  }

  console.log(`[dedupRerank] Processing ${enriched.length} enriched documents`);

  // Extract reranking constraints from plan if available
  const constraints = plan?.constraints || {};
  const authoritativeDomains = Array.isArray(constraints.authoritativeDomains)
    ? (constraints.authoritativeDomains as string[])
    : DEFAULT_AUTHORITATIVE_DOMAINS;

  // Deduplicate by content hash
  const deduped = deduplicateByContentHash(enriched);

  // Score and sort
  const scored = deduped.map((doc) => ({
    doc,
    score: calculateScore(doc, {
      recencyBoost: DEFAULT_RECENCY_BOOST,
      authorityBoost: DEFAULT_AUTHORITY_BOOST,
      authoritativeDomains,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  const finalDocs = scored.map((item) => item.doc);

  console.log(
    `[dedupRerank] After deduplication: ${finalDocs.length} unique items`
  );

  // Limit to top N if constraints specify max evidence
  const maxEvidence =
    typeof constraints.maxEvidence === "number"
      ? constraints.maxEvidence
      : DEFAULT_MAX_EVIDENCE;

  const limited = finalDocs.slice(0, maxEvidence);

  if (limited.length < finalDocs.length) {
    console.log(`[dedupRerank] Limited to top ${limited.length} documents`);
  }

  // Convert to Evidence format for backward compatibility
  const evidence = convertToEvidence(limited);

  return {
    research: {
      ...research,
      final: limited,
    },
    evidence, // Maintain backward compatibility
  };
}

/**
 * Deduplicate documents by content hash only
 */
function deduplicateByContentHash(
  docs: UnifiedSearchDoc[]
): UnifiedSearchDoc[] {
  const seen = new Set<string>();
  const unique: UnifiedSearchDoc[] = [];

  for (const doc of docs) {
    if (!doc.content) {
      continue; // Skip docs without content
    }

    const contentHash = hashContent(doc.content);

    if (!seen.has(contentHash)) {
      seen.add(contentHash);
      unique.push(doc);
    }
  }

  return unique;
}

/**
 * Check if hostname matches authority domain
 */
function hostMatches(hostname: string, base: string): boolean {
  return hostname === base || hostname.endsWith(`.${base}`);
}

/**
 * Calculate ranking score for document
 */
function calculateScore(
  doc: UnifiedSearchDoc,
  options: {
    recencyBoost: number;
    authorityBoost: number;
    authoritativeDomains: string[];
  }
): number {
  let score = BASE_SCORE;

  // Authority boost
  if (options.authoritativeDomains.some((d) => hostMatches(doc.hostname, d))) {
    score += options.authorityBoost;
  }

  // Recency boost
  if (doc.publishedAt) {
    const publishedDate = new Date(doc.publishedAt);
    const daysSincePublish =
      (Date.now() - publishedDate.getTime()) / MS_PER_DAY;
    if (daysSincePublish <= RECENT_DAYS_THRESHOLD) {
      score += options.recencyBoost;
    }
  }

  // Content quality signals
  if (doc.content && doc.content.length > MIN_CONTENT_LENGTH) {
    score += CONTENT_QUALITY_INCREMENT;
  }
  if (doc.title && doc.title.length > MIN_TITLE_LENGTH) {
    score += CONTENT_QUALITY_SMALL_INCREMENT;
  }
  if (doc.excerpt && doc.excerpt.length > MIN_EXCERPT_LENGTH) {
    score += CONTENT_QUALITY_SMALL_INCREMENT;
  }

  return score;
}

/**
 * Convert UnifiedSearchDoc to Evidence for backward compatibility
 */
function convertToEvidence(docs: UnifiedSearchDoc[]): Evidence[] {
  return docs.map((doc) => {
    const content = doc.content || "";
    const chunks = chunkText(content, {
      maxChunkSize: MAX_CHUNK_SIZE,
      overlapSize: CHUNK_OVERLAP_SIZE,
    });

    return {
      url: doc.url,
      title: doc.title || "Untitled",
      snippet: doc.excerpt || "",
      contentHash: hashContent(content),
      chunks,
      source: doc.provider,
    };
  });
}
