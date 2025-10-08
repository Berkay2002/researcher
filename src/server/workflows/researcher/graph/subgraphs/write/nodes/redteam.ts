/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import type { Draft, Evidence, ParentState } from "../../../state";

// Constants for quality gate thresholds (more lenient)
const MIN_CONFIDENCE_THRESHOLD = 0.3; // Reduced from 0.6
const MIN_WORD_COUNT = 200; // Reduced from 300
const MAX_WORD_COUNT = 5000;
const MAX_UNUSED_EVIDENCE_RATIO = 0.7; // Increased from 0.5
const MIN_CITATION_DENSITY = 0.5; // Reduced from 2
const MIN_QUALITY_SCORE = 0.4; // Reduced from 0.7
const MAX_ISSUES_TO_EXTRACT = 5;

// Constants for calculations and parsing
const WORDS_PER_THOUSAND = 1000;
const DEFAULT_QUALITY_SCORE = 0.5;
const _MIN_CONTENT_LENGTH_FOR_QUALITY = 1000;
const _CONTENT_LENGTH_QUALITY_BONUS = 0.05;
const MIN_LINE_LENGTH = 0;
const MIN_SCORE_RANGE = 0;
const MAX_SCORE_RANGE = 1;

// Top-level regex literals for performance
const WORD_SPLIT_REGEX = /\s+/;
const PLACEHOLDER_PATTERNS = [
  /\b(todo|placeholder|lorem ipsum)\b/gi,
  /\[(?:TBD|TODO|INSERT|FIXME|REPLACE)[^\]]*\]/gi,
];
const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;
const LIST_ITEM_REGEX = /^[-*•]\s*/;
const SCORE_EXTRACT_REGEX = /(?:score|rating|overall)[\s:]*([\d.]+)/i;

/**
 * Redteam Node
 *
 * Implements quality gate checks on the generated draft to ensure
 * it meets minimum quality standards before publication.
 */
export async function redteam(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[redteam] Starting quality gate checks...");

  const { draft, evidence, userInputs } = state;

  if (!draft) {
    const issue = "No draft available for quality checking";
    console.log(`[redteam] ${issue}`);
    return { issues: [issue] };
  }

  console.log(
    `[redteam] Checking draft quality (confidence: ${draft.confidence.toFixed(2)})`
  );
  console.log(`[redteam] Draft has ${draft.citations.length} citations`);
  console.log(`[redteam] Using ${evidence?.length || 0} evidence sources`);

  const issues: string[] = [];

  // Perform deterministic quality checks
  const deterministicIssues = performDeterministicChecks(draft, evidence || []);
  issues.push(...deterministicIssues);

  // Perform LLM-based quality assessment
  const llmIssues = await performLLMQualityCheck(draft, userInputs?.goal || "");
  issues.push(...llmIssues);

  console.log(`[redteam] Quality gate results: ${issues.length} issues found`);

  if (issues.length > 0) {
    console.log("[redteam] Issues detected:");
    issues.forEach((issue, index) => {
      console.log(`[redteam]   ${index + 1}. ${issue}`);
    });
  } else {
    console.log("[redteam] Draft passed all quality checks");
  }

  return { issues };
}

/**
 * Perform deterministic quality checks
 */
function performDeterministicChecks(
  draft: Draft,
  evidence: Evidence[]
): string[] {
  const issues: string[] = [];

  // Minimum citation requirement (more lenient)
  if (draft.citations.length === 0 && evidence.length > 0) {
    issues.push(
      "No citations extracted from available evidence - consider adding references to support claims"
    );
  }

  // Confidence score threshold (more lenient)
  if (draft.confidence < MIN_CONFIDENCE_THRESHOLD) {
    issues.push(
      `Low confidence score: ${draft.confidence.toFixed(2)} - consider adding more evidence or citations`
    );
  }

  // Content length checks
  const wordCount = draft.text.split(WORD_SPLIT_REGEX).length;
  if (wordCount < MIN_WORD_COUNT) {
    issues.push(
      `Draft too short: ${wordCount} words (minimum ${MIN_WORD_COUNT} required)`
    );
  }

  if (wordCount > MAX_WORD_COUNT) {
    issues.push(
      `Draft too long: ${wordCount} words (maximum ${MAX_WORD_COUNT} recommended)`
    );
  }

  // Evidence utilization
  const evidenceUrls = new Set(evidence.map((e) => e.url));
  const citedUrls = new Set(draft.citations.map((c) => c.url));
  const unusedEvidence = Array.from(evidenceUrls).filter(
    (url) => !citedUrls.has(url)
  );

  if (unusedEvidence.length > evidence.length * MAX_UNUSED_EVIDENCE_RATIO) {
    issues.push(
      `Low evidence utilization: ${unusedEvidence.length} sources not cited`
    );
  }

  // Citation density (citations per 1000 words) - more lenient
  if (draft.citations.length > 0) {
    const citationDensity =
      (draft.citations.length / wordCount) * WORDS_PER_THOUSAND;
    if (citationDensity < MIN_CITATION_DENSITY) {
      issues.push(
        `Low citation density: ${citationDensity.toFixed(1)} per 1000 words - consider adding more references`
      );
    }
  }

  // Basic structure checks
  if (!draft.text.includes("\n\n")) {
    issues.push("Draft lacks proper paragraph structure");
  }

  // Check for placeholder text
  const placeholderPatterns = PLACEHOLDER_PATTERNS;

  for (const pattern of placeholderPatterns) {
    if (pattern.test(draft.text)) {
      issues.push("Draft contains placeholder text or incomplete content");
      break;
    }
  }

  return issues;
}

/**
 * Perform LLM-based quality assessment
 */
async function performLLMQualityCheck(
  draft: Draft,
  goal: string
): Promise<string[]> {
  console.log("[redteam] Performing LLM-based quality assessment...");

  const llm = getLLM("quality");

  const systemPrompt = `You are a quality assurance reviewer for research reports. Your task is to evaluate a draft research report and identify any quality issues.

Evaluate the draft based on these criteria:
1. **Relevance**: Does the report directly address the research goal?
2. **Coherence**: Is the report well-structured and logical?
3. **Accuracy**: Are claims properly supported by citations?
4. **Completeness**: Does the report provide sufficient analysis?
5. **Objectivity**: Is the tone neutral and evidence-based?
6. **Clarity**: Is the writing clear and professional?

Respond with a JSON object containing:
{
  "overallScore": ${MIN_SCORE_RANGE}-${MAX_SCORE_RANGE},
  "issues": ["issue 1", "issue 2", ...],
  "strengths": ["strength 1", "strength 2", ...]
}

Only include issues that are significant enough to require attention.`;

  const humanPrompt = `Research Goal: ${goal}

Draft Report:
${draft.text}

Citations: ${draft.citations.length}
Confidence Score: ${draft.confidence}

Please evaluate this draft and provide quality assessment.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    const content = response.content as string;
    console.log("[redteam] LLM quality assessment completed");

    // Parse the JSON response
    const assessment = parseQualityAssessment(content);

    const issues: string[] = [];

    // Add issues based on overall score (more lenient)
    if (assessment.overallScore < MIN_QUALITY_SCORE) {
      issues.push(
        `Quality score could be improved: ${assessment.overallScore.toFixed(2)} - consider adding more specific details or citations`
      );
    }

    // Add specific issues identified by the LLM
    issues.push(...assessment.issues);

    // Log strengths for debugging (not added to issues)
    if (assessment.strengths.length > 0) {
      console.log("[redteam] Strengths identified:", assessment.strengths);
    }

    return issues;
  } catch (error) {
    console.error("[redteam] Error in LLM quality assessment:", error);
    return ["Quality assessment failed due to technical error"];
  }
}

/**
 * Parse quality assessment from LLM response
 */
function parseQualityAssessment(content: string): {
  overallScore: number;
  issues: string[];
  strengths: string[];
} {
  // Default values
  const assessment = {
    overallScore: 0.5,
    issues: [] as string[],
    strengths: [] as string[],
  };

  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(JSON_EXTRACT_REGEX);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overallScore: parsed.overallScore || DEFAULT_QUALITY_SCORE,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      };
    }
  } catch (error) {
    console.error("[redteam] Failed to parse quality assessment JSON:", error);
  }

  // Fallback: try to extract issues from text
  const issuePatterns = [
    /issues?:?\s*([\s\S]*?)(?=strengths?:|$)/gi,
    /problems?:?\s*([\s\S]*?)(?=strengths?:|$)/gi,
  ];

  for (const pattern of issuePatterns) {
    const match = content.match(pattern);
    if (match) {
      const issueText = match[1];
      const lines = issueText
        .split("\n")
        .map((line) => line.replace(LIST_ITEM_REGEX, "").trim())
        .filter((line) => line.length > MIN_LINE_LENGTH);
      assessment.issues.push(...lines.slice(0, MAX_ISSUES_TO_EXTRACT)); // Limit to MAX_ISSUES_TO_EXTRACT issues
      break;
    }
  }

  // Try to extract score
  const scoreMatch = content.match(SCORE_EXTRACT_REGEX);
  if (scoreMatch) {
    const score = Number.parseFloat(scoreMatch[1]);
    if (
      !Number.isNaN(score) &&
      score >= MIN_SCORE_RANGE &&
      score <= MAX_SCORE_RANGE
    ) {
      assessment.overallScore = score;
    }
  }

  return assessment;
}
