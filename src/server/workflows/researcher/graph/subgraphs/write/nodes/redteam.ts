/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLM } from "@/server/shared/configs/llm";
import type { Draft, Evidence, ParentState, QualityIssue } from "../../../state";

// Iteration limits for termination guarantees
const MAX_TOTAL_ITERATIONS = 3;

// Base quality thresholds (iteration 0 - strictest)
const BASE_MIN_CONFIDENCE_THRESHOLD = 0.6;
const BASE_MIN_CITATION_DENSITY = 2.0;
const BASE_MIN_QUALITY_SCORE = 0.7;

// Progressive leniency - how much to relax per iteration
const CONFIDENCE_RELAXATION_PER_ITERATION = 0.15;
const CITATION_DENSITY_RELAXATION_PER_ITERATION = 0.75;
const QUALITY_SCORE_RELAXATION_PER_ITERATION = 0.15;

// Content length checks (constant across iterations)
const MIN_WORD_COUNT = 200;
const MAX_WORD_COUNT = 5000;
const MAX_UNUSED_EVIDENCE_RATIO = 0.7;
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
 * Get progressive quality thresholds based on iteration count
 * Thresholds become MORE lenient with each iteration to ensure eventual termination
 */
function getProgressiveThresholds(totalIterations: number) {
  return {
    minConfidence:
      BASE_MIN_CONFIDENCE_THRESHOLD -
      totalIterations * CONFIDENCE_RELAXATION_PER_ITERATION,
    minCitationDensity:
      BASE_MIN_CITATION_DENSITY -
      totalIterations * CITATION_DENSITY_RELAXATION_PER_ITERATION,
    minQualityScore:
      BASE_MIN_QUALITY_SCORE -
      totalIterations * QUALITY_SCORE_RELAXATION_PER_ITERATION,
  };
}

/**
 * Redteam Node
 *
 * Implements quality gate checks on the generated draft with progressive leniency.
 * Thresholds automatically relax with each iteration to ensure eventual approval.
 * Forces approval on final iteration to guarantee termination.
 */
export async function redteam(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[redteam] Starting quality gate checks...");

  const { draft, evidence, userInputs, totalIterations, forceApproved } = state;
  const currentIteration = totalIterations || 0;

  console.log(`[redteam] Iteration ${currentIteration + 1}/${MAX_TOTAL_ITERATIONS}`);

  // Get progressive thresholds for this iteration
  const thresholds = getProgressiveThresholds(currentIteration);
  console.log("[redteam] Quality thresholds:", thresholds);

  if (!draft) {
    const issue: QualityIssue = {
      type: "needs_revision",
      description: "No draft available for quality checking",
      severity: "error",
    };
    console.log(`[redteam] ${issue.description}`);
    return { issues: [issue] };
  }

  console.log(
    `[redteam] Checking draft quality (confidence: ${draft.confidence.toFixed(2)})`
  );
  console.log(`[redteam] Draft has ${draft.citations.length} citations`);
  console.log(`[redteam] Using ${evidence?.length || 0} evidence sources`);

  // FORCE APPROVAL on final iteration to guarantee termination
  if (currentIteration >= MAX_TOTAL_ITERATIONS - 1) {
    console.warn(
      "[redteam] FINAL ITERATION - forcing approval with quality warnings"
    );

    // Still run checks to log warnings, but convert to warning severity
    const deterministicIssues = performDeterministicChecks(
      draft,
      evidence || [],
      thresholds
    );
    const llmIssues = await performLLMQualityCheck(
      draft,
      userInputs?.goal || "",
      thresholds
    );

    const allIssues = [...deterministicIssues, ...llmIssues];

    // Log warnings but don't block
    if (allIssues.length > 0) {
      console.warn("[redteam] Quality warnings (not blocking):");
      for (const issue of allIssues) {
        console.warn(`[redteam]   - ${issue.description}`);
      }
    }

    // Convert all issues to warnings and set force approval
    const warnings = allIssues.map(issue => ({
      ...issue,
      severity: "warning" as const,
    }));

    return {
      issues: warnings,
      forceApproved: true,
      totalIterations: currentIteration + 1,
    };
  }

  const issues: QualityIssue[] = [];

  // Perform deterministic quality checks with progressive thresholds
  const deterministicIssues = performDeterministicChecks(
    draft,
    evidence || [],
    thresholds
  );
  issues.push(...deterministicIssues);

  // Perform LLM-based quality assessment with progressive thresholds
  const llmIssues = await performLLMQualityCheck(
    draft,
    userInputs?.goal || "",
    thresholds
  );
  issues.push(...llmIssues);

  console.log(`[redteam] Quality gate results: ${issues.length} issues found`);

  if (issues.length > 0) {
    console.log("[redteam] Issues detected:");
    for (const issue of issues) {
      console.log(`[redteam]   [${issue.type}] ${issue.description}`);
    }
  } else {
    console.log("[redteam] Draft passed all quality checks");
  }

  return {
    issues,
    totalIterations: currentIteration + 1,
  };
}

/**
 * Perform deterministic quality checks with progressive thresholds
 */
function performDeterministicChecks(
  draft: Draft,
  evidence: Evidence[],
  thresholds: {
    minConfidence: number;
    minCitationDensity: number;
    minQualityScore: number;
  }
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Minimum citation requirement
  if (draft.citations.length === 0 && evidence.length > 0) {
    issues.push({
      type: "needs_research",
      description:
        "No citations extracted from available evidence - additional sources may be needed",
      severity: "error",
    });
  }

  // Confidence score threshold
  if (draft.confidence < thresholds.minConfidence) {
    issues.push({
      type: "needs_research",
      description: `Low confidence score: ${draft.confidence.toFixed(2)} (threshold: ${thresholds.minConfidence.toFixed(2)}) - may need more evidence`,
      severity: "error",
    });
  }

  // Content length checks
  const wordCount = draft.text.split(WORD_SPLIT_REGEX).length;
  if (wordCount < MIN_WORD_COUNT) {
    issues.push({
      type: "needs_revision",
      description: `Draft too short: ${wordCount} words (minimum ${MIN_WORD_COUNT} required)`,
      severity: "error",
    });
  }

  if (wordCount > MAX_WORD_COUNT) {
    issues.push({
      type: "needs_revision",
      description: `Draft too long: ${wordCount} words (maximum ${MAX_WORD_COUNT} recommended)`,
      severity: "error",
    });
  }

  // Evidence utilization
  const evidenceUrls = new Set(evidence.map((e) => e.url));
  const citedUrls = new Set(draft.citations.map((c) => c.url));
  const unusedEvidence = Array.from(evidenceUrls).filter(
    (url) => !citedUrls.has(url)
  );

  if (unusedEvidence.length > evidence.length * MAX_UNUSED_EVIDENCE_RATIO) {
    issues.push({
      type: "needs_revision",
      description: `Low evidence utilization: ${unusedEvidence.length} sources not cited - consider using more available evidence`,
      severity: "error",
    });
  }

  // Citation density (citations per 1000 words)
  if (draft.citations.length > 0) {
    const citationDensity =
      (draft.citations.length / wordCount) * WORDS_PER_THOUSAND;
    if (citationDensity < thresholds.minCitationDensity) {
      issues.push({
        type: "needs_research",
        description: `Low citation density: ${citationDensity.toFixed(1)} per 1000 words (threshold: ${thresholds.minCitationDensity.toFixed(1)}) - may need more sources`,
        severity: "error",
      });
    }
  }

  // Basic structure checks
  if (!draft.text.includes("\n\n")) {
    issues.push({
      type: "needs_revision",
      description: "Draft lacks proper paragraph structure",
      severity: "error",
    });
  }

  // Check for placeholder text
  const placeholderPatterns = PLACEHOLDER_PATTERNS;

  for (const pattern of placeholderPatterns) {
    if (pattern.test(draft.text)) {
      issues.push({
        type: "needs_revision",
        description: "Draft contains placeholder text or incomplete content",
        severity: "error",
      });
      break;
    }
  }

  return issues;
}

/**
 * Perform LLM-based quality assessment with progressive thresholds
 */
async function performLLMQualityCheck(
  draft: Draft,
  goal: string,
  thresholds: {
    minConfidence: number;
    minCitationDensity: number;
    minQualityScore: number;
  }
): Promise<QualityIssue[]> {
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

    const issues: QualityIssue[] = [];

    // Add issues based on overall score
    if (assessment.overallScore < thresholds.minQualityScore) {
      issues.push({
        type: "needs_revision",
        description: `Quality score ${assessment.overallScore.toFixed(2)} below threshold ${thresholds.minQualityScore.toFixed(2)} - needs improvement in clarity or detail`,
        severity: "error",
      });
    }

    // Convert string issues to QualityIssue objects
    // Classify as needs_revision by default (LLM issues are usually about writing quality)
    for (const issueText of assessment.issues) {
      // Heuristic: if issue mentions "evidence", "sources", "citations", "data" → needs_research
      const needsResearch = /\b(evidence|source|citation|data|reference)\b/i.test(
        issueText
      );

      issues.push({
        type: needsResearch ? "needs_research" : "needs_revision",
        description: issueText,
        severity: "error",
      });
    }

    // Log strengths for debugging (not added to issues)
    if (assessment.strengths.length > 0) {
      console.log("[redteam] Strengths identified:", assessment.strengths);
    }

    return issues;
  } catch (error) {
    console.error("[redteam] Error in LLM quality assessment:", error);
    return [
      {
        type: "needs_revision",
        description: "Quality assessment failed due to technical error",
        severity: "warning",
      },
    ];
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
