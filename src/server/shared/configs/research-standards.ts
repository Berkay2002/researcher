/**
 * Fixed Research Quality Standards for Academic Comparison
 *
 * These standards ensure both ReAct and Orchestrator-Worker systems
 * operate under identical quality expectations during experimental runs.
 *
 * Purpose: Fair comparison between single-agent (ReAct) and multi-agent
 * (Orchestrator-Worker) architectures on deep research tasks.
 *
 * @see docs/experiment-setup.md for full experiment documentation
 */

export const RESEARCH_STANDARDS = {
  // ============================================================================
  // Source Requirements
  // ============================================================================

  /** Minimum and maximum number of sources to cite */
  sourceCount: { min: 20, max: 30 },

  /** Preferred types of authoritative sources */
  sourceTypes: [
    ".edu (educational institutions)",
    ".gov (government agencies)",
    "peer-reviewed journals",
    "official reports and white papers",
  ],

  /** Prefer sources published within this many years */
  recencyYears: 3,

  // ============================================================================
  // Report Requirements
  // ============================================================================

  /** Target word count for research reports */
  wordCount: { min: 2000, max: 4000 },

  /** Required structural components */
  structure: [
    "Executive Summary",
    "Detailed Analysis",
    "Key Insights",
    "References (APA format)",
  ],

  // ============================================================================
  // Citation Requirements
  // ============================================================================

  /** Citation format to use in report body */
  citationFormat: "inline", // [1], [2], [3] format

  /** Reference list format */
  referenceFormat: "APA",

  /** Approximate citations per sentence (for evaluation) */
  citationDensity: 0.05, // ~1 citation per 20 sentences

  // ============================================================================
  // Search Requirements
  // ============================================================================

  /** Number of search queries to execute */
  queryCount: { min: 8, max: 12 },

  /** Query diversity requirement */
  queryDiversity: "high", // Use different phrasings, depths, and angles

  // ============================================================================
  // Quality Thresholds
  // ============================================================================

  /** Minimum confidence score for claims (0-1) */
  minConfidence: 0.7,

  /** Whether critical claims require cross-referencing with multiple sources */
  requireCrossReference: true,

  // ============================================================================
  // Evidence-First Language Guidelines
  // ============================================================================

  /** Phrases for indicating evidence strength */
  evidenceLanguage: {
    strong: [
      "Research consistently shows",
      "Multiple studies confirm",
      "Evidence strongly indicates",
    ],
    moderate: ["Studies suggest", "Evidence indicates", "Research shows"],
    limited: [
      "Preliminary research suggests",
      "Some studies have found",
      "Initial evidence indicates",
    ],
    conflicting: [
      "Research is mixed",
      "Studies show conflicting results",
      "Evidence is inconclusive",
    ],
    expert: [
      "Experts believe",
      "According to authorities",
      "Specialists indicate",
    ],
  },
} as const;

export type ResearchStandards = typeof RESEARCH_STANDARDS;

/**
 * Get a human-readable summary of research standards
 */
export function getStandardsSummary(): string {
  return `
Research Quality Standards (Fixed for Comparison):
- Sources: ${RESEARCH_STANDARDS.sourceCount.min}-${RESEARCH_STANDARDS.sourceCount.max} authoritative sources
- Source Types: ${RESEARCH_STANDARDS.sourceTypes.join(", ")}
- Recency: Prefer sources from last ${RESEARCH_STANDARDS.recencyYears} years
- Report Length: ${RESEARCH_STANDARDS.wordCount.min}-${RESEARCH_STANDARDS.wordCount.max} words
- Structure: ${RESEARCH_STANDARDS.structure.join(", ")}
- Citations: ${RESEARCH_STANDARDS.citationFormat} format ([1], [2]) with ${RESEARCH_STANDARDS.referenceFormat} references
- Search Queries: ${RESEARCH_STANDARDS.queryCount.min}-${RESEARCH_STANDARDS.queryCount.max} diverse queries
- Quality: Min ${RESEARCH_STANDARDS.minConfidence} confidence, cross-reference critical claims
	`.trim();
}

/**
 * Validate if a research output meets the standards
 */
export function validateResearchOutput(output: {
  sourceCount: number;
  wordCount: number;
  confidence: number;
}): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (
    output.sourceCount < RESEARCH_STANDARDS.sourceCount.min ||
    output.sourceCount > RESEARCH_STANDARDS.sourceCount.max
  ) {
    violations.push(
      `Source count ${output.sourceCount} outside range ${RESEARCH_STANDARDS.sourceCount.min}-${RESEARCH_STANDARDS.sourceCount.max}`
    );
  }

  if (
    output.wordCount < RESEARCH_STANDARDS.wordCount.min ||
    output.wordCount > RESEARCH_STANDARDS.wordCount.max
  ) {
    violations.push(
      `Word count ${output.wordCount} outside range ${RESEARCH_STANDARDS.wordCount.min}-${RESEARCH_STANDARDS.wordCount.max}`
    );
  }

  if (output.confidence < RESEARCH_STANDARDS.minConfidence) {
    violations.push(
      `Confidence ${output.confidence} below minimum ${RESEARCH_STANDARDS.minConfidence}`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
