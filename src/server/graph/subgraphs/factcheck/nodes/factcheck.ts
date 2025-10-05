/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */
import type { ParentState } from "../../../state";

// Constants for fact-checking thresholds
const MIN_EVIDENCE_SOURCES = 3;
const MIN_CONFIDENCE_SCORE = 0.5;

// Constants for context window sizes
const CLAIM_CONTEXT_WINDOW = 50;
const CITATION_CONTEXT_WINDOW = 200;

// Constants for paragraph analysis
const MIN_PARAGRAPH_LENGTH = 50;
const MAX_SHORT_PARAGRAPH_RATIO = 0.3;

// Constants for excerpt display
const MAX_EXCERPT_DISPLAY_LENGTH = 100;

/**
 * Fact-check Node
 *
 * Performs deterministic fact-checking by verifying that claims in the draft
 * have supporting evidence in the research results.
 */
export async function factcheck(
  state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[factcheck] Starting fact-checking process...");

  const { draft, evidence } = state;

  // If no draft exists, skip fact-checking
  if (!draft) {
    console.log("[factcheck] No draft found, skipping fact-checking");
    return { issues: [] };
  }

  console.log(
    `[factcheck] Fact-checking draft with ${draft.citations.length} citations`
  );
  console.log(
    `[factcheck] Available evidence: ${evidence?.length || 0} sources`
  );

  const issues: string[] = [];

  // Check if draft has citations
  if (!draft.citations || draft.citations.length === 0) {
    issues.push("Draft contains no citations or supporting evidence");
  }

  // Verify each citation has corresponding evidence
  if (draft.citations.length > 0 && evidence) {
    for (const citation of draft.citations) {
      const hasSupportingEvidence = evidence.some(
        (e) => e.url === citation.url || e.title === citation.title
      );

      if (!hasSupportingEvidence) {
        issues.push(
          `Citation "${citation.title}" has no corresponding evidence in research results`
        );
      }
    }
  }

  // Check for sufficient evidence coverage
  if (evidence && evidence.length < MIN_EVIDENCE_SOURCES) {
    issues.push(
      `Insufficient evidence sources (less than ${MIN_EVIDENCE_SOURCES}) for comprehensive fact-checking`
    );
  }

  // Check confidence score
  if (draft.confidence < MIN_CONFIDENCE_SCORE) {
    issues.push(`Low confidence score: ${draft.confidence.toFixed(2)}`);
  }

  // Sample claim extraction and validation (simplified)
  const claimIssues = validateClaims(draft.text);
  issues.push(...claimIssues);

  console.log(`[factcheck] Found ${issues.length} issues:`);
  if (issues.length > 0) {
    issues.forEach((issue, index) => {
      console.log(`[factcheck]   ${index + 1}. ${issue}`);
    });
  } else {
    console.log("[factcheck] No issues found - draft appears well-supported");
  }

  return { issues };
}

/**
 * Validate claims in draft text against available evidence
 *
 * For now, this is a simplified implementation that checks for:
 * - Claims that appear to need citations
 * - Basic textual consistency
 *
 * In future versions, this could use NLP techniques for more sophisticated claim extraction
 */
function validateClaims(
  draftText: string,
  _evidence?: Array<{ url: string; title: string; content: string }>
): string[] {
  const issues: string[] = [];

  // Simple heuristic: look for sentences that contain specific claim patterns
  const claimPatterns = [
    /\b(studies show|research indicates|data suggests|according to|experts agree)\b/gi,
    /\b(\d+%|\d+ percent|\d+ out of \d+)\b/gi,
    /\b(significant|major|dramatic|substantial)\s+(increase|decrease|change|impact)\b/gi,
  ];

  const matches: Array<{ pattern: RegExp; text: string }> = [];

  claimPatterns.forEach((pattern) => {
    const found = draftText.match(pattern);
    if (found) {
      found.forEach((match) => {
        const index = draftText.indexOf(match);
        const start = Math.max(0, index - CLAIM_CONTEXT_WINDOW);
        const end = Math.min(draftText.length, index + match.length + CLAIM_CONTEXT_WINDOW);
        const context = draftText.substring(start, end).trim();
        matches.push({ pattern, text: context });
      });
    }
  });

  // Check if claims have nearby citations
  for (const match of matches) {
    const hasCitation = checkForNearbyCitation(match.text, draftText);
    if (!hasCitation) {
      issues.push(
        `Potential uncited claim found: "${match.text.substring(0, MAX_EXCERPT_DISPLAY_LENGTH)}..."`
      );
    }
  }

  // Check for very short or very long paragraphs (potential issues)
  const paragraphs = draftText.split("\n\n").filter((p) => p.trim().length > 0);
  const shortParagraphs = paragraphs.filter((p) => p.trim().length < MIN_PARAGRAPH_LENGTH);
  if (shortParagraphs.length > paragraphs.length * MAX_SHORT_PARAGRAPH_RATIO) {
    issues.push(
      "High proportion of very short paragraphs may indicate insufficient development"
    );
  }

  return issues;
}

/**
 * Check if a given text segment has a citation marker nearby
 */
function checkForNearbyCitation(text: string, fullText: string): boolean {
  const index = fullText.indexOf(text);
  const start = Math.max(0, index - CITATION_CONTEXT_WINDOW);
  const end = Math.min(fullText.length, index + text.length + CITATION_CONTEXT_WINDOW);
  const context = fullText.substring(start, end);

  // Look for citation patterns [1], [source], etc.
  const citationPatterns = [
    /\[\d+\]/g, // [1], [2], etc.
    /\[.*?\]/g, // [Source Name], etc.
    /\(.*?\d{4}.*?\)/g, // (Author, 2024), etc.
  ];

  return citationPatterns.some((pattern) => pattern.test(context));
}
