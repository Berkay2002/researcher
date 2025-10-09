/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { getLLM } from "@/server/shared/configs/llm";
import type {
  Draft,
  Evidence,
  ParentState,
  QualityIssue,
} from "../../../state";

// Iteration limits for termination guarantees
const MAX_TOTAL_ITERATIONS = 9;

// Base quality thresholds (iteration 0 - more lenient to reduce cycles)
const BASE_MIN_CONFIDENCE_THRESHOLD = 0.4; // Lowered from 0.6
const BASE_MIN_CITATION_DENSITY = 1.0; // Lowered from 2.0
const BASE_MIN_QUALITY_SCORE = 0.5; // Lowered from 0.7

// Progressive leniency - how much to relax per iteration
const CONFIDENCE_RELAXATION_PER_ITERATION = 0.1; // Lowered from 0.15 for smoother progression
const CITATION_DENSITY_RELAXATION_PER_ITERATION = 0.5; // Lowered from 0.75 for smoother progression
const QUALITY_SCORE_RELAXATION_PER_ITERATION = 0.1; // Lowered from 0.15 for smoother progression

// Content length checks (constant across iterations)
const MIN_WORD_COUNT = 200;
const MAX_WORD_COUNT = 5000;
const MAX_UNUSED_EVIDENCE_RATIO = 0.7;

// Constants for calculations
const WORDS_PER_THOUSAND = 1000;
const _MIN_CONTENT_LENGTH_FOR_QUALITY = 1000;
const _CONTENT_LENGTH_QUALITY_BONUS = 0.05;

// Top-level regex literals for performance
const WORD_SPLIT_REGEX = /\s+/;
const PLACEHOLDER_PATTERNS = [
  /\b(todo|placeholder|lorem ipsum)\b/gi,
  /\[(?:TBD|TODO|INSERT|FIXME|REPLACE)[^\]]*\]/gi,
];

/**
 * Structured schema for LLM quality assessment
 * LLM directly classifies each issue type instead of using heuristics
 */
const QualityAssessmentSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall quality score from 0 to 1"),
  issues: z
    .array(
      z.object({
        description: z
          .string()
          .describe("Clear description of the quality issue"),
        type: z
          .enum(["needs_research", "needs_revision"])
          .describe(
            "needs_research: Missing evidence/sources/citations for claims. needs_revision: Writing quality, clarity, structure, or analysis depth issues."
          ),
        severity: z
          .enum(["error", "warning"])
          .describe("error: Must be fixed. warning: Nice to have."),
      })
    )
    .describe("List of quality issues found"),
  strengths: z
    .array(z.string())
    .describe("Positive aspects of the draft (for logging)"),
});

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

  console.log(
    `[redteam] Iteration ${currentIteration + 1}/${MAX_TOTAL_ITERATIONS}`
  );

  // Early exit if already force-approved (defensive check)
  // This prevents redundant evaluation if the graph somehow reaches this node again
  if (forceApproved) {
    console.log(
      "[redteam] Draft already force-approved, skipping quality checks"
    );
    return { issues: [], forceApproved: true };
  }

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
    const warnings = allIssues.map((issue) => ({
      ...issue,
      severity: "warning" as const,
    }));

    return {
      issues: warnings,
      forceApproved: true,
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

  // Minimum citation requirement - ONLY if no citations at all
  if (draft.citations.length === 0 && evidence.length > 0) {
    issues.push({
      type: "needs_revision",
      description:
        "No citations extracted from available evidence - review existing sources and add citations",
      severity: "error",
    });
  }

  // Confidence score threshold - be lenient, only flag if extremely low
  if (draft.confidence < thresholds.minConfidence) {
    issues.push({
      type: "needs_revision",
      description: `Confidence score ${draft.confidence.toFixed(2)} below threshold ${thresholds.minConfidence.toFixed(2)} - strengthen analysis with existing sources`,
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

  // Citation density (citations per 1000 words) - only flag if critically low
  if (draft.citations.length > 0 && wordCount >= MIN_WORD_COUNT) {
    const citationDensity =
      (draft.citations.length / wordCount) * WORDS_PER_THOUSAND;
    if (citationDensity < thresholds.minCitationDensity) {
      issues.push({
        type: "needs_revision",
        description: `Citation density ${citationDensity.toFixed(1)} per 1000 words is below threshold ${thresholds.minCitationDensity.toFixed(1)} - add more citations from existing evidence`,
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
 * Uses structured output to directly classify issues (no heuristics)
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

  const systemPrompt = `You are a quality assurance reviewer for research reports. Evaluate the draft and identify quality issues.

Evaluate based on:
1. **Relevance**: Does it address the research goal?
2. **Coherence**: Is it well-structured and logical?
3. **Writing Quality**: Clear, professional, well-organized?
4. **Citation Support**: Are major claims supported by citations?

CLASSIFICATION RULES:
- **needs_research**: Claims are COMPLETELY UNSUPPORTED or major gaps in evidence/sources/citations
- **needs_revision**: Writing quality, clarity, structure, depth of analysis, or organization issues

IMPORTANT:
- Be lenient - this is research in progress, not a publication
- Only flag CRITICAL issues that significantly impact the report
- If analysis is shallow but citations exist → needs_revision (analyze existing sources better)
- If writing needs improvement → needs_revision
- Minor improvements are acceptable - don't be overly strict

Provide a structured assessment with each issue properly classified.`;

  const humanPrompt = `Research Goal: ${goal}

Draft Report:
${draft.text}

Citations: ${draft.citations.length}
Confidence Score: ${draft.confidence}

Evaluate this draft and identify any critical quality issues.`;

  try {
    const llmWithStructuredOutput = llm.withStructuredOutput(
      QualityAssessmentSchema
    );

    const assessment = await llmWithStructuredOutput.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ]);

    console.log("[redteam] LLM quality assessment completed");

    const issues: QualityIssue[] = [];

    // Add issues based on overall score
    if (assessment.overallScore < thresholds.minQualityScore) {
      issues.push({
        type: "needs_revision",
        description: `Quality score ${assessment.overallScore.toFixed(2)} below threshold ${thresholds.minQualityScore.toFixed(2)} - needs improvement in clarity or detail`,
        severity: "error",
      });
    }

    // Use LLM's direct classification (no heuristics!)
    for (const issue of assessment.issues) {
      // Only include error-severity issues (ignore warnings for now)
      if (issue.severity === "error") {
        issues.push({
          type: issue.type,
          description: issue.description,
          severity: issue.severity,
        });
      }
    }

    // Log strengths for debugging
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
