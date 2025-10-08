/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import type {
  Citation,
  Draft,
  Evidence,
  ParentState,
  Plan,
} from "../../../state";

// Constants for synthesis
const MAX_CHUNKS_PER_EVIDENCE = 3;
const MAX_CHUNK_CONTENT_LENGTH = 500;
const _MIN_WORDS_FOR_CITATION = 50;
const BASE_CONFIDENCE = 0.5;
const EVIDENCE_DIVERSITY_WEIGHT = 0.3;
const CITATION_COVERAGE_WEIGHT = 0.3;
const SOURCE_QUALITY_WEIGHT = 0.2;
const CITATION_DENSITY_WEIGHT = 0.2;
const MAX_EVIDENCE_SOURCES = 10;
const MAX_CITATIONS = 5;
const CITATIONS_PER_THOUSAND_CHARS = 2;
const ESTIMATED_TEXT_LENGTH = 2000;
const CONTEXT_WINDOW = 200;
const EXCERPT_LENGTH = 200;
const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORDS = 10;
const REPUTABLE_DOMAIN_BONUS = 0.1;
const CONTENT_LENGTH_THRESHOLD = 1000;
const CONTENT_LENGTH_BONUS = 0.05;
const BASE_QUALITY_SCORE = 0.5;
const MAX_SCORE_VALUE = 1.0;
const THOUSAND_CHARS_DIVISOR = 1000;

// Top-level regex literals for performance
const _CITATION_NEEDED_REGEX = /\[(\d+)\]/g;
const WORD_SPLIT_REGEX = /\s+/;
const KEYWORD_FILTER_REGEX = /\[source \d+\]/gi;
const SENTENCE_SPLIT_REGEX = /[.!?]+/;

// Constants for citation extraction
const MIN_SENTENCE_LENGTH_FOR_CITATION = 20;
const MAX_AUTO_SENTENCES = 5;
const MIN_WORD_LENGTH_FOR_CITATION = 4;
const MIN_KEYWORD_MATCH_RATIO = 0.3;

/**
 * Synthesize Node
 *
 * Generates a comprehensive research report using the gathered evidence.
 * Uses Gemini 2.5 Flash for well-defined synthesis task.
 */
export async function synthesize(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[synthesize] Starting report synthesis...");

  const { userInputs, plan, evidence } = state;

  if (!userInputs?.goal) {
    throw new Error("No goal provided in userInputs");
  }

  if (!evidence || evidence.length === 0) {
    throw new Error("No evidence available for synthesis");
  }

  console.log(`[synthesize] Synthesizing report for goal: ${userInputs.goal}`);
  console.log(`[synthesize] Using ${evidence.length} evidence sources`);

  // Initialize the LLM with Gemini 2.5 Flash for synthesis
  const llm = getLLM("generation");

  // Prepare evidence context
  const evidenceContext = prepareEvidenceContext(evidence);

  // Prepare system prompt for synthesis
  const systemPrompt = createSynthesisPrompt(plan);

  // Prepare human prompt with goal and evidence
  const humanPrompt = createHumanPrompt(userInputs.goal, evidenceContext);

  console.log("[synthesize] Generating synthesis with LLM...");

  try {
    // Generate the synthesis
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const synthesizedText = normalizeLLMContent(response.content);

    console.log(
      "[synthesize] LLM content type:",
      Array.isArray(response.content) ? "array" : typeof response.content
    );

    const normalizedText = normalizeCitationMarkers(synthesizedText);

    console.log(
      `[synthesize] Generated ${normalizedText.length} characters of synthesis`
    );

    // Extract citations from the synthesized text
    const citations = extractCitations(normalizedText, evidence);

    console.log(`[synthesize] Extracted ${citations.length} citations`);

    // Calculate confidence score based on evidence quality and coverage
    const confidence = calculateConfidence(evidence, citations);

    console.log(
      `[synthesize] Calculated confidence score: ${confidence.toFixed(2)}`
    );

    const draft: Draft = {
      text: normalizedText,
      citations,
      confidence,
    };

    return { draft };
  } catch (error) {
    console.error("[synthesize] Error during synthesis:", error);
    throw new Error(
      `Synthesis failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Prepare evidence context for the LLM
 */
function prepareEvidenceContext(evidence: Evidence[]): string {
  return evidence
    .map((e, index) => {
      const chunks = e.chunks
        .slice(0, MAX_CHUNKS_PER_EVIDENCE)
        .map((c) => c.content.substring(0, MAX_CHUNK_CONTENT_LENGTH))
        .join("\n...\n");
      return `Source ${index + 1}: ${e.title}\nURL: ${e.url}\nContent: ${chunks}\n---`;
    })
    .join("\n\n");
}

/**
 * Create system prompt for synthesis
 */
function createSynthesisPrompt(plan: Plan | null): string {
  return `You are a research analyst tasked with synthesizing a comprehensive research report. Your report must:

1. Be well-structured with clear headings and logical flow
2. Present information objectively and analytically
3. Incorporate multiple perspectives from the evidence
4. Include proper citations using the format [Source X] where X is the source number
5. Be comprehensive but concise, focusing on the most relevant information
6. Maintain a formal, academic tone

The report should include:
- Executive Summary (brief overview)
- Main Analysis (detailed findings with citations)
- Key Insights or Implications (if applicable)
- Conclusion (summary of findings)

${plan?.deliverable ? `Deliverable Type: ${plan.deliverable}` : ""}

Important:
- Use citations [Source X] to reference specific evidence sources (this exact format is required)
- If you cannot cite using [Source X], explain why instead of switching formats
- Each factual claim should be supported by at least one citation
- Do not invent information not present in the provided evidence`;
}

/**
 * Create human prompt with goal and evidence
 */
function createHumanPrompt(goal: string, evidenceContext: string): string {
  return `Research Goal: ${goal}

Available Evidence:
${evidenceContext}

Please synthesize a comprehensive research report based on the provided evidence that directly addresses the research goal. Ensure all claims are properly cited using the [Source X] format.`;
}

/**
 * Normalize LLM content payloads into plain text
 */
function normalizeLLMContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          const maybeText = (part as { text?: unknown }).text;
          return typeof maybeText === "string" ? maybeText : "";
        }
        return "";
      })
      .join("");
  }

  if (content && typeof content === "object" && "text" in content) {
    const maybeText = (content as { text?: unknown }).text;
    if (typeof maybeText === "string") {
      return maybeText;
    }
  }

  return String(content ?? "");
}

/**
 * Coerce common citation styles into the `[Source n]` format
 */
function normalizeCitationMarkers(text: string): string {
  let normalized = text;

  normalized = normalized.replace(
    /<sup>(\d+)<\/sup>/gi,
    (_match, group1: string) => `[Source ${group1}]`
  );

  normalized = normalized.replace(
    /\(Source\s+(\d+)\)/gi,
    (_match, group1: string) => `[Source ${group1}]`
  );

  normalized = normalized.replace(
    /Source\s*\[(\d+)\]/gi,
    (_match, group1: string) => `[Source ${group1}]`
  );

  normalized = normalized.replace(
    /Source\s+(\d+)/gi,
    (match, group1: string, offset, original) => {
      const start = offset as number;
      const end = start + match.length;
      const prevChar = start > 0 ? original.charAt(start - 1) : "";
      const nextChar = original.charAt(end);

      if (prevChar === "[" && nextChar === "]") {
        return match;
      }

      return `[Source ${group1}]`;
    }
  );

  return normalized;
}

/**
 * Extract citations from synthesized text
 */
function extractCitations(text: string, evidence: Evidence[]): Citation[] {
  const citations: Citation[] = [];

  // Try multiple citation formats
  const citationPatterns = [
    { regex: /\[Source (\d+)\]/g, name: "Source X" },
    { regex: /\[(\d+)\]/g, name: "[X]" },
    { regex: /\[source (\d+)\]/g, name: "source X" },
    { regex: /\((\d+)\)/g, name: "(X)" },
    { regex: /\[([A-Za-z]+)\]/g, name: "[Author]" },
  ];

  // Try each pattern until we find citations
  for (const pattern of citationPatterns) {
    for (const match of text.matchAll(pattern.regex)) {
      let sourceIndex = -1;

      // Handle different extraction methods based on pattern
      if (pattern.name === "[Author]") {
        // For author patterns, try to find a matching source by title/URL
        const author = match[1].toLowerCase();
        sourceIndex = evidence.findIndex(
          (e) =>
            e.title.toLowerCase().includes(author) ||
            e.url.toLowerCase().includes(author)
        );
      } else {
        // For numeric patterns, extract the number
        sourceIndex = Number.parseInt(match[1], 10) - 1;
      }

      if (sourceIndex >= 0 && sourceIndex < evidence.length) {
        const source = evidence[sourceIndex];

        // Find relevant excerpt from the source content
        const excerpt = findRelevantExcerpt(match[0], text, source);

        const citation: Citation = {
          id: `source-${sourceIndex + 1}`,
          url: source.url,
          title: source.title,
          excerpt:
            excerpt ||
            `${source.chunks[0]?.content.substring(0, EXCERPT_LENGTH)}...`,
        };

        // Avoid duplicate citations
        if (!citations.some((c) => c.id === citation.id)) {
          citations.push(citation);
        }
      }
    }

    // If we found citations with this pattern, don't try others
    if (citations.length > 0) {
      break;
    }
  }

  // If still no citations found, try to auto-generate them based on content similarity
  if (citations.length === 0 && evidence.length > 0) {
    console.log("[synthesize] No citations found, attempting auto-generation");

    // Split text into sentences/paragraphs
    const sentences = text
      .split(SENTENCE_SPLIT_REGEX)
      .filter((s) => s.trim().length > MIN_SENTENCE_LENGTH_FOR_CITATION);

    // For each sentence, find the most relevant evidence
    for (const sentence of sentences.slice(0, MAX_AUTO_SENTENCES)) {
      let bestMatch = -1;
      let bestScore = 0;

      for (let i = 0; i < evidence.length; i++) {
        const source = evidence[i];
        const sourceContent = source.chunks
          .map((c) => c.content)
          .join(" ")
          .toLowerCase();
        const sentenceLower = sentence.toLowerCase();

        // Simple keyword matching score
        const sentenceWords = sentenceLower.split(WORD_SPLIT_REGEX);
        const matchingWords = sentenceWords.filter(
          (word) =>
            word.length > MIN_WORD_LENGTH_FOR_CITATION &&
            sourceContent.includes(word)
        );

        const score = matchingWords.length / sentenceWords.length;

        if (score > bestScore && score > MIN_KEYWORD_MATCH_RATIO) {
          bestScore = score;
          bestMatch = i;
        }
      }

      if (bestMatch >= 0) {
        const source = evidence[bestMatch];
        const citation: Citation = {
          id: `source-${bestMatch + 1}`,
          url: source.url,
          title: source.title,
          excerpt: `${source.chunks[0]?.content.substring(0, EXCERPT_LENGTH)}...`,
        };

        if (!citations.some((c) => c.id === citation.id)) {
          citations.push(citation);
        }
      }
    }
  }

  return citations;
}

/**
 * Find relevant excerpt from source content based on context
 */
function findRelevantExcerpt(
  citationMarker: string,
  fullText: string,
  source: Evidence
): string {
  const markerIndex = fullText.indexOf(citationMarker);
  const start = Math.max(0, markerIndex - CONTEXT_WINDOW);
  const end = Math.min(
    fullText.length,
    markerIndex + citationMarker.length + CONTEXT_WINDOW
  );
  const context = fullText.substring(start, end);

  // Combine all chunks from source for better search
  const sourceContent = source.chunks.map((chunk) => chunk.content).join(" ");

  // Simple heuristic: find the most relevant sentence from source content
  // that contains keywords from the context
  const keywords = context
    .toLowerCase()
    .replace(KEYWORD_FILTER_REGEX, "")
    .split(WORD_SPLIT_REGEX)
    .filter((word) => word.length > MIN_KEYWORD_LENGTH)
    .slice(0, MAX_KEYWORDS);

  const sentences = sourceContent
    .split(SENTENCE_SPLIT_REGEX)
    .filter((s) => s.trim().length > MIN_SENTENCE_LENGTH_FOR_CITATION);

  let bestSentence = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    const score = keywords.reduce(
      (acc, keyword) =>
        acc + (sentence.toLowerCase().includes(keyword) ? 1 : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence.trim();
    }
  }

  return bestSentence || `${sourceContent.substring(0, EXCERPT_LENGTH)}...`;
}

/**
 * Calculate confidence score based on evidence quality and citation coverage
 */
function calculateConfidence(
  evidence: Evidence[],
  citations: Citation[]
): number {
  let confidence = BASE_CONFIDENCE; // Base confidence

  // Evidence diversity (more sources = higher confidence)
  const evidenceScore =
    Math.min(evidence.length / MAX_EVIDENCE_SOURCES, MAX_SCORE_VALUE) *
    EVIDENCE_DIVERSITY_WEIGHT;
  confidence += evidenceScore;

  // Citation coverage (more citations = higher confidence)
  const citationScore =
    Math.min(citations.length / MAX_CITATIONS, MAX_SCORE_VALUE) *
    CITATION_COVERAGE_WEIGHT;
  confidence += citationScore;

  // Source quality (simplified check for reputable sources)
  const qualityScore = calculateSourceQuality(evidence) * SOURCE_QUALITY_WEIGHT;
  confidence += qualityScore;

  // Citation density (citations per 1000 characters)
  const citationDensity =
    citations.length / (ESTIMATED_TEXT_LENGTH / THOUSAND_CHARS_DIVISOR);
  const densityScore =
    Math.min(citationDensity / CITATIONS_PER_THOUSAND_CHARS, MAX_SCORE_VALUE) *
    CITATION_DENSITY_WEIGHT;
  confidence += densityScore;

  return Math.min(confidence, MAX_SCORE_VALUE);
}

/**
 * Calculate source quality score (simplified heuristic)
 */
function calculateSourceQuality(evidence: Evidence[]): number {
  let qualityScore = BASE_QUALITY_SCORE;

  // Constants for reputable domains
  const REPUTABLE_DOMAINS = [
    "edu",
    "gov",
    "org",
    "research",
    "journal",
    "academic",
    "university",
    "institution",
    "study",
    "publication",
  ] as const;

  for (const source of evidence) {
    // Check for common reputable domain patterns
    const hasReputableDomain = REPUTABLE_DOMAINS.some((domain) =>
      source.url.toLowerCase().includes(domain)
    );

    if (hasReputableDomain) {
      qualityScore += REPUTABLE_DOMAIN_BONUS;
    }

    // Check content length (longer content often indicates more thorough analysis)
    const totalContentLength = source.chunks.reduce(
      (sum, chunk) => sum + chunk.content.length,
      0
    );
    if (totalContentLength > CONTENT_LENGTH_THRESHOLD) {
      qualityScore += CONTENT_LENGTH_BONUS;
    }
  }

  return Math.min(qualityScore, MAX_SCORE_VALUE);
}
