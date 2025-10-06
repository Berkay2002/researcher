/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { ParentState, UnifiedSearchDoc } from "../../../state";

// Constants for candidate assessment
const DEFAULT_TARGET_COUNT = Number.parseInt(
  process.env.RESEARCH_TARGET_COUNT || "16",
  10
); // Target 12-18 URLs
const MAX_PER_HOST = Number.parseInt(
  process.env.RESEARCH_MAX_PER_HOST || "3",
  10
); // Cap per host to avoid monoculture
const AUTHORITY_HOSTS = [
  "sec.gov",
  "reuters.com",
  "ft.com",
  "wsj.com",
  "ir.amd.com",
  "ir.nvidia.com",
  "investor.apple.com",
  "secfilings.nasdaq.com",
];
const RECENCY_HALF_LIFE_DAYS = Number.parseInt(
  process.env.RESEARCH_RECENCY_HALF_LIFE_DAYS || "90",
  10
);
const NEUTRAL_SCORE = 0.5;
const AUTHORITY_BOOST = 0.2;
const MAX_BOOST_SCORE = 1.0;
const MS_PER_DAY = 86_400_000; // 1000 * 60 * 60 * 24
const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 100;
const MIN_EXCERPT_LENGTH = 50;
const CONTENT_QUALITY_BOOST = 0.1;
const RECENT_DAYS_THRESHOLD = Number.parseInt(
  process.env.RESEARCH_RECENT_DAYS_THRESHOLD || "30",
  10
);

/**
 * AssessCandidates Node
 *
 * Phase B: reason/curate (no network)
 * Scores candidates using heuristics and optionally LLM re-rank
 * Selects a curated set of URLs for enrichment
 */
export function assessCandidates(state: ParentState): Partial<ParentState> {
  console.log("[assessCandidates] Evaluating discovery results...");

  const research = state.research ?? {};
  const { discovery } = research;

  if (!discovery || discovery.length === 0) {
    console.log("[assessCandidates] No discovery results to evaluate");
    return {
      research: {
        ...research,
        selected: [],
        rationale: "No discovery results available for evaluation.",
      },
    };
  }

  console.log(
    `[assessCandidates] Processing ${discovery.length} discovery results`
  );

  // 1) Normalize provider scores 0-1
  const normed = normalizeScores(discovery);

  // 2) Rule-based boost: recency + authority + doc-type + host diversity
  const scored = rankByHeuristics(normed, {
    now: Date.now(),
    authorityHosts: AUTHORITY_HOSTS,
    recencyHalfLifeDays: RECENCY_HALF_LIFE_DAYS,
  });

  // 3) Cap by host to avoid monoculture
  const diverse = capPerHost(scored, MAX_PER_HOST);

  // 4) Select top candidates
  const chosen = diverse.slice(0, DEFAULT_TARGET_COUNT);

  // 5) Generate rationale
  const rationale = generateRationale(chosen, discovery.length);

  console.log(
    `[assessCandidates] Selected ${chosen.length} candidates for enrichment`
  );

  return {
    research: {
      ...research,
      selected: chosen.map((doc) => doc.id),
      rationale,
    },
  };
}

/**
 * Normalize provider scores to 0-1 range
 */
function normalizeScores(docs: UnifiedSearchDoc[]): UnifiedSearchDoc[] {
  const scores = docs
    .map((doc) => doc.providerScore)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));

  if (scores.length === 0) {
    // No provider scores, assign neutral score
    return docs.map((doc) => ({ ...doc, score: 0.5 }));
  }

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1; // Avoid division by zero

  return docs.map((doc) => ({
    ...doc,
    score:
      typeof doc.providerScore === "number" &&
      Number.isFinite(doc.providerScore)
        ? (doc.providerScore - minScore) / range
        : NEUTRAL_SCORE, // Neutral score for missing provider scores
  }));
}

/**
 * Apply heuristic ranking to documents
 */
type RankingOptions = {
  now: number;
  authorityHosts: string[];
  recencyHalfLifeDays: number;
};

function rankByHeuristics(
  docs: UnifiedSearchDoc[],
  options: RankingOptions
): UnifiedSearchDoc[] {
  return docs
    .map((doc) => {
      let boostScore = doc.score || NEUTRAL_SCORE;

      // Authority boost
      if (
        options.authorityHosts.some((base) => hostMatches(doc.hostname, base))
      ) {
        boostScore += AUTHORITY_BOOST;
      }

      // Recency boost
      if (doc.publishedAt) {
        const publishedDate = new Date(doc.publishedAt);
        const daysSincePublish =
          (options.now - publishedDate.getTime()) / MS_PER_DAY;
        const recencyBoost =
          Math.exp(-daysSincePublish / options.recencyHalfLifeDays) *
          AUTHORITY_BOOST;
        boostScore += recencyBoost;
      }

      // Title/snippet quality boost (basic heuristic)
      const titleLength = doc.title?.length || 0;
      const excerptLength = doc.excerpt?.length || 0;
      if (
        titleLength > MIN_TITLE_LENGTH &&
        titleLength < MAX_TITLE_LENGTH &&
        excerptLength > MIN_EXCERPT_LENGTH
      ) {
        boostScore += CONTENT_QUALITY_BOOST;
      }

      return {
        ...doc,
        score: Math.min(boostScore, MAX_BOOST_SCORE), // Cap at 1.0
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Cap documents per host to ensure diversity
 */
function capPerHost(
  docs: UnifiedSearchDoc[],
  maxPerHost: number
): UnifiedSearchDoc[] {
  const hostCounts = new Map<string, number>();
  const result: UnifiedSearchDoc[] = [];

  for (const doc of docs) {
    const count = hostCounts.get(doc.hostname) || 0;
    if (count < maxPerHost) {
      result.push(doc);
      hostCounts.set(doc.hostname, count + 1);
    }
  }

  return result;
}

/**
 * Check if hostname matches authority domain
 */
function hostMatches(hostname: string, base: string): boolean {
  return hostname === base || hostname.endsWith(`.${base}`);
}

/**
 * Generate rationale for selection
 */
function generateRationale(
  chosen: UnifiedSearchDoc[],
  totalCandidates: number
): string {
  const authorityCount = chosen.filter((doc) =>
    AUTHORITY_HOSTS.some((base) => hostMatches(doc.hostname, base))
  ).length;

  const recentCount = chosen.filter((doc) => {
    if (!doc.publishedAt) {
      return false;
    }
    const daysSince =
      (Date.now() - new Date(doc.publishedAt).getTime()) / MS_PER_DAY;
    return daysSince <= RECENT_DAYS_THRESHOLD;
  }).length;

  const hostDistribution = new Map<string, number>();
  for (const doc of chosen) {
    hostDistribution.set(
      doc.hostname,
      (hostDistribution.get(doc.hostname) || 0) + 1
    );
  }

  return `Selected ${chosen.length} sources from ${totalCandidates} candidates for comprehensive coverage. Selection criteria: ${authorityCount} authoritative sources, ${recentCount} recent publications, and diverse source coverage across ${hostDistribution.size} domains.`;
}
