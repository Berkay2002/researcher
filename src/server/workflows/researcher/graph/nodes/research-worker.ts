/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <> */
/** biome-ignore-all lint/style/noParameterAssign: <Accumulator pattern> */

import { searchAll } from "@/server/shared/services/search-gateway";
import type { UnifiedSearchDoc } from "../state";
import type { WorkerState } from "../worker-state";

// Constants for worker execution
const BATCH_SIZE = 5; // Exa rate limit
const BATCH_DELAY_MS = 1000;
const MAX_RESULTS_PER_QUERY = 10;
const TOP_DOCUMENTS_TO_SELECT = 5;
const MIN_PROVIDER_SCORE = 0.3;

// Scoring weights
const PROVIDER_SCORE_WEIGHT = 0.4;
const TITLE_RELEVANCE_WEIGHT = 0.2;
const EXCERPT_RELEVANCE_WEIGHT = 0.1;
const MAX_RELEVANCE_SCORE = 0.3;
const RECENCY_WEIGHT = 0.2;
const CONTENT_AVAILABILITY_BONUS = 0.1;
const DAYS_IN_YEAR = 365;
// biome-ignore lint/style/noMagicNumbers: <Mathematical constant for milliseconds per day>
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Confidence calculation weights
const DOCUMENT_COUNT_WEIGHT = 0.4;
const AVG_SCORE_WEIGHT = 0.3;
const CONTENT_AVAILABILITY_WEIGHT = 0.3;

// Display constants
const MAX_SOURCES_TO_SHOW = 3;

// Regex for URL normalization
const TRAILING_SLASH_REGEX = /\/+$/u;

/**
 * Research Worker Node
 *
 * Executes a single research task assigned by the orchestrator.
 * Following the Orchestrator-Worker pattern, each worker:
 * 1. Executes search queries for its assigned aspect
 * 2. Assesses and ranks candidates
 * 3. Selects top documents for enrichment
 * 4. Harvests full content
 * 5. Returns results to shared state
 *
 * Each worker operates independently on its task and writes results
 * to the shared 'workerResults' key in the parent state.
 */
export async function researchWorker(
  state: WorkerState
): Promise<Partial<WorkerState>> {
  const { task } = state;

  if (!task) {
    console.error("[researchWorker] No task assigned to worker");
    return {
      status: "failed",
      error: "No task assigned to worker",
    };
  }

  console.log(`[researchWorker] Starting task ${task.id}: ${task.aspect}`);
  console.log(`[researchWorker] Queries: ${task.queries.join(", ")}`);

  try {
    // Update status to running
    const updates: Partial<WorkerState> = {
      status: "running",
    };

    // Step 1: Execute search queries
    console.log(`[researchWorker] Executing ${task.queries.length} queries...`);
    const discoveredDocs = await executeSearchQueries(task.queries);
    console.log(`[researchWorker] Found ${discoveredDocs.length} documents`);

    updates.discoveredDocs = discoveredDocs;

    // Step 2: Assess and select top candidates
    console.log("[researchWorker] Assessing candidates...");
    const selectedDocs = assessAndSelectCandidates(discoveredDocs, task.aspect);
    console.log(
      `[researchWorker] Selected ${selectedDocs.length} documents for enrichment`
    );

    const selectedDocIds = selectedDocs.map((doc) => doc.id);
    updates.selectedDocIds = selectedDocIds;

    // Step 3: Harvest full content (simulate - in real implementation would fetch)
    // For now, we'll use the discovered docs with their existing content
    console.log("[researchWorker] Harvesting content...");
    const enrichedDocs = selectedDocs.map((doc) => ({
      ...doc,
      // In real implementation, this would fetch full content
      content: doc.content || doc.excerpt || "",
    }));

    updates.enrichedDocs = enrichedDocs;

    // Step 4: Generate summary of findings
    const summary = generateWorkerSummary(task.aspect, enrichedDocs);

    // Step 5: Calculate confidence based on result quality
    const confidence = calculateWorkerConfidence(enrichedDocs);

    // Step 6: Create worker result
    const workerResult = {
      taskId: task.id,
      aspect: task.aspect,
      documents: enrichedDocs,
      summary,
      confidence,
      queriesExecuted: task.queries.length,
      documentsFound: discoveredDocs.length,
      documentsSelected: selectedDocs.length,
    };

    console.log(
      `[researchWorker] Task ${task.id} completed with confidence ${confidence.toFixed(2)}`
    );

    updates.workerResults = [workerResult];
    updates.status = "completed";

    return updates;
  } catch (error) {
    console.error(`[researchWorker] Error executing task ${task.id}:`, error);
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Execute search queries in batches to respect rate limits
 */
async function executeSearchQueries(
  queries: string[]
): Promise<UnifiedSearchDoc[]> {
  const allResults: UnifiedSearchDoc[] = [];

  // Execute queries in batches
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((query) =>
        searchAll({
          query,
          maxResults: MAX_RESULTS_PER_QUERY,
          includeDomains: [],
          excludeDomains: [],
        })
      )
    );

    // Collect successful results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      }
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < queries.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((doc) => {
    const key = doc.url.toLowerCase().replace(TRAILING_SLASH_REGEX, "");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Assess candidates and select top documents
 */
function assessAndSelectCandidates(
  docs: UnifiedSearchDoc[],
  aspect: string
): UnifiedSearchDoc[] {
  // Score documents based on multiple factors
  const scoredDocs = docs.map((doc) => {
    let score = 0;

    // Factor 1: Provider score (if available)
    if (doc.providerScore) {
      score += doc.providerScore * PROVIDER_SCORE_WEIGHT;
    } else if (doc.score) {
      score += doc.score * PROVIDER_SCORE_WEIGHT;
    } else {
      score += MIN_PROVIDER_SCORE;
    }

    // Factor 2: Relevance to aspect (simple keyword matching)
    const aspectKeywords = aspect.toLowerCase().split(" ");
    const titleText = (doc.title || "").toLowerCase();
    const excerptText = (doc.excerpt || "").toLowerCase();
    let relevanceScore = 0;
    for (const keyword of aspectKeywords) {
      if (titleText.includes(keyword)) {
        relevanceScore += TITLE_RELEVANCE_WEIGHT;
      }
      if (excerptText.includes(keyword)) {
        relevanceScore += EXCERPT_RELEVANCE_WEIGHT;
      }
    }
    score += Math.min(relevanceScore, MAX_RELEVANCE_SCORE);

    // Factor 3: Recency (if available)
    if (doc.publishedAt) {
      const publishDate = new Date(doc.publishedAt);
      const now = new Date();
      const daysSincePublish =
        (now.getTime() - publishDate.getTime()) / MS_PER_DAY;
      const recencyScore = Math.max(0, 1 - daysSincePublish / DAYS_IN_YEAR);
      score += recencyScore * RECENCY_WEIGHT;
    }

    // Factor 4: Content availability
    if (doc.content) {
      score += CONTENT_AVAILABILITY_BONUS;
    }

    return { ...doc, score };
  });

  // Sort by score and select top documents
  return scoredDocs
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, TOP_DOCUMENTS_TO_SELECT);
}

/**
 * Generate summary of worker findings
 */
function generateWorkerSummary(
  aspect: string,
  docs: UnifiedSearchDoc[]
): string {
  if (docs.length === 0) {
    return `No relevant documents found for ${aspect}`;
  }

  const sources = docs.map((doc) => doc.hostname).filter(Boolean);
  const uniqueSources = [...new Set(sources)];

  return `Found ${docs.length} relevant documents for ${aspect} from ${uniqueSources.length} sources including ${uniqueSources.slice(0, MAX_SOURCES_TO_SHOW).join(", ")}`;
}

/**
 * Calculate confidence score for worker results
 */
function calculateWorkerConfidence(docs: UnifiedSearchDoc[]): number {
  if (docs.length === 0) {
    return 0;
  }

  // Base confidence on number of documents found
  let confidence =
    Math.min(docs.length / TOP_DOCUMENTS_TO_SELECT, 1) * DOCUMENT_COUNT_WEIGHT;

  // Factor in document quality (scores)
  const avgScore =
    docs.reduce((sum, doc) => sum + (doc.score || 0), 0) / docs.length;
  confidence += avgScore * AVG_SCORE_WEIGHT;

  // Factor in content availability
  const docsWithContent = docs.filter((doc) => doc.content).length;
  confidence += (docsWithContent / docs.length) * CONTENT_AVAILABILITY_WEIGHT;

  return Math.min(confidence, 1);
}
