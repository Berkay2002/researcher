/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex synthesis logic> */

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
// import { createHash } from "crypto";
import { getLLM } from "@/server/shared/configs/llm";
import type { Citation, Draft, ParentState, UnifiedSearchDoc } from "../state";

// Constants for synthesis
const MAX_SOURCES_FOR_SYNTHESIS = 20;
const BASE_CONFIDENCE = 0.5;
const WORKER_DIVERSITY_WEIGHT = 0.2;
const DOCUMENT_QUALITY_WEIGHT = 0.3;
const ESTIMATED_CHARS_PER_CITATION = 2000;
const MAX_EXCERPT_LENGTH = 200;
const CONTENT_PREVIEW_LENGTH = 1000;
const CITATION_DENSITY_WEIGHT = 0.2;
const WORKER_CONFIDENCE_BOOST = 0.1;
const RECENCY_BOOST_WEIGHT = 0.1;
const CONTENT_BONUS = 0.1;
const DAYS_IN_YEAR = 365;
// biome-ignore lint/style/noMagicNumbers: <Mathematical constant for milliseconds per day>
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CHARS_PER_THOUSAND = 1000;

// Regex constants (defined at top level for performance)
const URL_NORMALIZE_REGEX = /\/+$/u;

/**
 * Synthesizer Node
 *
 * Aggregates and synthesizes results from all parallel research workers.
 * Following the Orchestrator-Worker pattern:
 * 1. Collect results from all workers (from shared workerResults key)
 * 2. Deduplicate documents across workers
 * 3. Rank by quality, relevance, and recency
 * 4. Generate comprehensive report with citations
 *
 * This node demonstrates the synthesis phase of the Orchestrator-Worker pattern
 * where all worker outputs are combined into a final deliverable.
 */
export async function synthesizer(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[synthesizer] Aggregating results from all workers...");

  const {
    workerResults,
    userInputs,
    plan,
    issues,
    draft: previousDraft,
  } = state;

  if (!userInputs?.goal) {
    throw new Error("No goal provided in userInputs");
  }

  // Check if this is a revision iteration (redteam found issues)
  const isRevision = issues && issues.length > 0 && previousDraft;

  if (isRevision) {
    console.log(
      `[synthesizer] REVISION MODE: Addressing ${issues.length} issues from redteam`
    );
    console.log("[synthesizer] Issues to address:", issues);
  } else {
    console.log("[synthesizer] INITIAL SYNTHESIS: Generating first draft");
  }

  if (!workerResults || workerResults.length === 0) {
    console.warn("[synthesizer] No worker results to synthesize");
    return {
      draft: {
        text: `No research results found for: ${userInputs.goal}`,
        citations: [],
        confidence: 0,
      },
      issues: [], // Clear issues
    };
  }

  console.log(
    `[synthesizer] Processing results from ${workerResults.length} workers`
  );

  // Step 1: Aggregate and deduplicate documents from all workers
  const allDocuments = workerResults.flatMap((result) => result.documents);
  console.log(
    `[synthesizer] Total documents from workers: ${allDocuments.length}`
  );

  const deduplicatedDocs = deduplicateDocuments(allDocuments);
  console.log(
    `[synthesizer] Deduplicated to ${deduplicatedDocs.length} unique documents`
  );

  // Step 2: Rank and select best documents
  const rankedDocs = rankDocuments(deduplicatedDocs, workerResults);
  const selectedDocs = rankedDocs.slice(0, MAX_SOURCES_FOR_SYNTHESIS);
  console.log(
    `[synthesizer] Selected ${selectedDocs.length} documents for synthesis`
  );

  // Step 3: Prepare evidence context
  const evidenceContext = prepareEvidenceContext(selectedDocs);

  // Step 4: Generate synthesis using LLM
  console.log("[synthesizer] Generating comprehensive report...");
  const synthesizedText = await generateSynthesis(
    userInputs.goal,
    plan?.deliverable || "comprehensive research report",
    evidenceContext,
    workerResults
  );

  // Step 5: Extract citations
  const citations = extractCitations(synthesizedText, selectedDocs);
  console.log(`[synthesizer] Extracted ${citations.length} citations`);

  // Step 6: Calculate overall confidence
  const confidence = calculateSynthesisConfidence(
    workerResults,
    selectedDocs,
    citations
  );
  console.log(`[synthesizer] Overall confidence: ${confidence.toFixed(2)}`);

  const draft: Draft = {
    text: synthesizedText,
    citations,
    confidence,
  };

  // Step 7: Append AI response to messages for LangSmith chat support
  const aiMessage = new AIMessage({
    content: synthesizedText,
    additional_kwargs: {
      citations: citations.map((c) => ({
        id: c.id,
        url: c.url,
        title: c.title,
      })),
      confidence,
    },
  });

  return {
    draft,
    messages: [aiMessage],
  };
}

/**
 * Deduplicate documents by URL and content hash
 */
function deduplicateDocuments(docs: UnifiedSearchDoc[]): UnifiedSearchDoc[] {
  const seen = new Map<string, UnifiedSearchDoc>();

  for (const doc of docs) {
    // Create deduplication key from URL (normalized)
    const urlKey = doc.url.toLowerCase().replace(URL_NORMALIZE_REGEX, "");

    // If we haven't seen this URL, or the new doc has better content/score
    if (seen.has(urlKey)) {
      const existing = seen.get(urlKey);
      // biome-ignore lint/style/noNonNullAssertion: Map.has check ensures value exists
      const existingScore = existing!.score || 0;
      const newScore = doc.score || 0;

      // Replace if new doc has better score or more content
      if (newScore > existingScore || (doc.content && !existing?.content)) {
        seen.set(urlKey, doc);
      }
    } else {
      seen.set(urlKey, doc);
    }
  }

  return Array.from(seen.values());
}

/**
 * Rank documents by quality, relevance, and diversity
 */
function rankDocuments(
  docs: UnifiedSearchDoc[],
  workerResults: ParentState["workerResults"]
): UnifiedSearchDoc[] {
  // Score each document
  const scoredDocs = docs.map((doc) => {
    let score = doc.score || 0;

    // Boost score if document appeared in high-confidence worker results
    for (const result of workerResults) {
      const inThisWorker = result.documents.some((d) => d.url === doc.url);
      if (inThisWorker) {
        score += result.confidence * WORKER_CONFIDENCE_BOOST;
      }
    }

    // Boost score for recency
    if (doc.publishedAt) {
      const publishDate = new Date(doc.publishedAt);
      const now = new Date();
      const daysSincePublish =
        (now.getTime() - publishDate.getTime()) / MS_PER_DAY;
      const recencyBoost =
        Math.max(0, 1 - daysSincePublish / DAYS_IN_YEAR) * RECENCY_BOOST_WEIGHT;
      score += recencyBoost;
    }

    // Boost for content availability
    if (doc.content) {
      score += CONTENT_BONUS;
    }

    return { doc, score };
  });

  // Sort by score (descending)
  return scoredDocs.sort((a, b) => b.score - a.score).map((item) => item.doc);
}

/**
 * Prepare evidence context for LLM
 */
function prepareEvidenceContext(docs: UnifiedSearchDoc[]): string {
  return docs
    .map((doc, index) => {
      const content = doc.content || doc.excerpt || "";
      const preview = content.substring(0, CONTENT_PREVIEW_LENGTH);
      return `[Source ${index + 1}] ${doc.title || "Untitled"}
URL: ${doc.url}
Published: ${doc.publishedAt || "Unknown"}
Content Preview: ${preview}
---`;
    })
    .join("\n\n");
}

/**
 * Generate synthesis using LLM
 */
async function generateSynthesis(
  goal: string,
  deliverable: string,
  evidenceContext: string,
  workerResults: ParentState["workerResults"]
): Promise<string> {
  const llm = getLLM("generation"); // Use Gemini 2.5 Flash for synthesis

  // Prepare worker summaries
  const workerSummaries = workerResults
    .map(
      (result, index) =>
        `Worker ${index + 1} (${result.aspect}): ${result.summary} [Confidence: ${result.confidence.toFixed(2)}]`
    )
    .join("\n");

  const systemPrompt = `You are a research synthesis expert. Your task is to write a ${deliverable} based on the research findings from multiple parallel research workers.

Your report should:
1. Synthesize insights from all research aspects
2. Present a cohesive narrative that addresses the research goal
3. Use inline citations [1], [2], etc. to reference sources
4. Be comprehensive yet concise
5. Highlight key findings and insights
6. Address different perspectives when relevant

Use markdown formatting for structure and readability.`;

  const humanPrompt = `Research Goal: ${goal}

Worker Summaries:
${workerSummaries}

Sources:
${evidenceContext}

Please write a comprehensive ${deliverable} that synthesizes these research findings. Use inline citations [1], [2], etc. to reference the sources above.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    return String(response.content);
  } catch (error) {
    console.error("[synthesizer] Error generating synthesis:", error);
    throw new Error(
      `Synthesis failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Extract citations from synthesized text
 */
function extractCitations(text: string, docs: UnifiedSearchDoc[]): Citation[] {
  const citations: Citation[] = [];
  const citationRegex = /\[(\d+)\]/g;
  const matches = text.matchAll(citationRegex);

  const citedIndices = new Set<number>();
  for (const match of matches) {
    const index = Number.parseInt(match[1], 10) - 1; // Convert to 0-based
    citedIndices.add(index);
  }

  // Create citation objects for cited sources
  for (const index of citedIndices) {
    if (index >= 0 && index < docs.length) {
      const doc = docs[index];
      const excerpt = (doc.excerpt || doc.content || "").substring(
        0,
        MAX_EXCERPT_LENGTH
      );

      citations.push({
        id: `${index + 1}`,
        url: doc.url,
        title: doc.title || "Untitled",
        excerpt: excerpt || "No excerpt available",
      });
    }
  }

  return citations;
}

/**
 * Calculate overall synthesis confidence
 */
function calculateSynthesisConfidence(
  workerResults: ParentState["workerResults"],
  selectedDocs: UnifiedSearchDoc[],
  citations: Citation[]
): number {
  // Start with base confidence
  let confidence = BASE_CONFIDENCE;

  // Factor 1: Worker diversity (did we get results from multiple aspects?)
  const workerCount = workerResults.length;
  const workersWithResults = workerResults.filter(
    (r) => r.documentsSelected > 0
  ).length;
  const diversityScore = workersWithResults / Math.max(workerCount, 1);
  confidence += diversityScore * WORKER_DIVERSITY_WEIGHT;

  // Factor 2: Document quality (average confidence from workers)
  const avgWorkerConfidence =
    workerResults.reduce((sum, r) => sum + r.confidence, 0) /
    Math.max(workerResults.length, 1);
  confidence += avgWorkerConfidence * DOCUMENT_QUALITY_WEIGHT;

  // Factor 3: Citation density (did we actually use the sources?)
  const expectedCitations = Math.ceil(
    selectedDocs.length / (ESTIMATED_CHARS_PER_CITATION / CHARS_PER_THOUSAND)
  );
  const citationScore = Math.min(
    citations.length / Math.max(expectedCitations, 1),
    1
  );
  confidence += citationScore * CITATION_DENSITY_WEIGHT;

  return Math.min(confidence, 1);
}
