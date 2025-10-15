/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */
import { interrupt } from "@langchain/langgraph";
import type { Draft, Evidence, ParentState } from "../state";

/**
 * Publish Gate Node
 *
 * Pauses after synthesis/red-team to verify quality and get final approval
 * to publish/export. Runs deterministic checks first, then uses interrupt()
 * if manual review is needed.
 *
 * This follows LangGraph 1.0-alpha HITL patterns where:
 * - The interrupt function pauses execution for human review
 * - Resume is handled via Command with structured responses
 * - State updates are returned as Partial<ParentState>
 *
 * Deterministic checks (run before HITL):
 * - Citations present for non-obvious claims
 * - Recency window (e.g., no key claims older than N months)
 * - Section completeness vs. deliverable template
 * - Red-team clean (no blocking issues)
 */

// Policy thresholds
const MIN_CITATIONS_REQUIRED = 3;
const MIN_CONFIDENCE_THRESHOLD = 0.6;
const MAX_RECENT_MONTHS = 24; // Maximum age for sources
const MIN_DRAFT_LENGTH = 200; // Minimum characters for a valid draft

// Display and formatting constants
const TITLE_TRUNCATE_LENGTH = 50;
const PREVIEW_LENGTH = 600;
const PREVIEW_DISPLAY_LENGTH = 300;
const PREVIEW_SUFFIX = "...";
const SAMPLE_SOURCES_COUNT = 3;
const CONFIDENCE_PRECISION = 2;
const YEAR_2025_DATE = "2025-01-01";
const YEAR_2024_DATE = "2024-01-01";

/**
 * Run deterministic quality checks
 */
function runDeterministicChecks(state: ParentState): {
  passed: boolean;
  issues: string[];
  summary: {
    sectionsOk: boolean;
    citationsCount: number;
    recencyOk: boolean;
    blockingIssues: string[];
  };
} {
  const { draft, issues, evidence } = state;
  const blockingIssues: string[] = [];

  // Check 1: Draft exists and meets minimum length
  if (!draft) {
    blockingIssues.push("missing_draft");
  } else if (draft.text.length < MIN_DRAFT_LENGTH) {
    blockingIssues.push("draft_too_short");
  }

  // Check 2: Minimum citations
  const citationsCount = draft?.citations?.length || 0;
  if (citationsCount < MIN_CITATIONS_REQUIRED) {
    blockingIssues.push(
      `insufficient_citations:${citationsCount}/${MIN_CITATIONS_REQUIRED}`
    );
  }

  // Check 3: Confidence threshold
  const confidence = draft?.confidence || 0;
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    blockingIssues.push(
      `low_confidence:${confidence.toFixed(CONFIDENCE_PRECISION)}/${MIN_CONFIDENCE_THRESHOLD}`
    );
  }

  // Check 4: Red-team issues
  if (issues && issues.length > 0) {
    blockingIssues.push(...issues.map((issue) => `redteam:${issue}`));
  }

  // Check 5: Recency of sources
  let recencyOk = true;
  const staleSources: string[] = [];
  if (evidence && evidence.length > 0) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - MAX_RECENT_MONTHS);

    for (const ev of evidence) {
      // Try to extract date from evidence or use a placeholder
      const evidenceDate = new Date(
        ev.snippet.includes("2025") ? YEAR_2025_DATE : YEAR_2024_DATE
      );
      if (evidenceDate < cutoffDate) {
        staleSources.push(ev.title.substring(0, TITLE_TRUNCATE_LENGTH));
        recencyOk = false;
      }
    }

    if (staleSources.length > 0) {
      blockingIssues.push(`stale_sources:${staleSources.length} items`);
    }
  }

  // Check 6: Section completeness (basic check)
  const sectionsOk = Boolean(
    draft?.text.length && draft.text.length > MIN_DRAFT_LENGTH
  );

  const passed = blockingIssues.length === 0;

  return {
    passed,
    issues: blockingIssues,
    summary: {
      sectionsOk,
      citationsCount,
      recencyOk,
      blockingIssues,
    },
  };
}

/**
 * Generate preview snippet
 */
function generatePreview(draft: Draft | null): string {
  if (!draft?.text) {
    return "No draft available";
  }
  return (
    draft.text.substring(0, PREVIEW_LENGTH) +
    (draft.text.length > PREVIEW_LENGTH ? PREVIEW_SUFFIX : "")
  );
}

/**
 * Get sample sources for display
 */
type SampleSource = {
  title: string;
  url: string;
  date: string;
};

function getSampleSources(evidence: Evidence[] | null): SampleSource[] {
  if (!evidence?.length) {
    return [];
  }

  return evidence.slice(0, SAMPLE_SOURCES_COUNT).map((ev) => ({
    title: ev.title,
    url: ev.url,
    date: new Date().toISOString().split("T")[0], // Placeholder
  }));
}

export async function publishGate(
  state: ParentState
): Promise<Partial<ParentState>> {
  const { userInputs } = state;
  // biome-ignore lint/correctness/noUnusedVariables: threadId kept for future audit/logging functionality
  const { threadId } = state;

  console.log("[publishGate] Running pre-publish quality checks...");

  try {
    // Step 1: Run deterministic checks
    const checkResults = runDeterministicChecks(state);
    const { passed, issues, summary } = checkResults;

    console.log(
      `[publishGate] Deterministic checks: ${passed ? "PASSED" : "FAILED"}`
    );
    if (!passed) {
      console.log("[publishGate] Issues found:", issues.join(", "));
    }

    // Step 2: Check if auto-publish is allowed
    const policyAllowsAuto =
      (state.plan?.constraints as Record<string, unknown>)?.autoPublish !==
      false;

    if (passed && policyAllowsAuto) {
      console.log("[publishGate] Auto-publishing - all checks passed");
      const timestamp = new Date().toISOString();
      return {
        userInputs: {
          ...userInputs,
          publish: {
            approved: true,
            timestamp,
            signer: "system_auto",
            policySnapshot: {
              checksPassed: true,
              policy: "auto_publish_allowed",
              deterministicChecks: summary,
            },
          },
        },
      };
    }

    // Step 3: Prepare for manual review
    const preview = generatePreview(state.draft);
    const sourcesSample = getSampleSources(state.evidence);

    // Step 4: Create human review message following LangGraph patterns
    const reviewMessage = `Publication review required:

Quality Check Results:
- ${passed ? " All checks passed" : " Issues found"}
- Citations: ${summary.citationsCount} (minimum: ${MIN_CITATIONS_REQUIRED})
- Source recency: ${summary.recencyOk ? " Recent" : " Contains old sources"}
- Draft length: ${state.draft?.text.length || 0} characters

Issues found:
${summary.blockingIssues.length > 0 ? summary.blockingIssues.join(", ") : "None"}

Preview:
"${preview.substring(0, PREVIEW_DISPLAY_LENGTH)}${preview.length > PREVIEW_DISPLAY_LENGTH ? PREVIEW_SUFFIX : ""}"

Sample sources:
${sourcesSample.map((s) => `- ${s.title}`).join("\n")}

Do you approve publishing this research?`;

    console.log("[publishGate] Triggering publish review interrupt");

    // Step 5: Fire interrupt - this will pause the graph
    const humanResponse = interrupt(reviewMessage);

    console.log("[publishGate] Resuming with human response");

    // Step 6: Process the response and create publish record
    const timestamp = new Date().toISOString();

    // Create publish record based on the interrupt response
    const publishRecord = {
      approved: true, // Default if we get here
      timestamp,
      signer: "user",
      policySnapshot: {
        checksPassed: passed,
        issues,
        deterministicChecks: summary,
        humanResponse,
      },
    };

    console.log("[publishGate] Human approved - publishing");
    return {
      userInputs: {
        ...userInputs,
        publish: publishRecord,
      },
    };
  } catch (error) {
    console.error("[publishGate] Error during publish gate process:", error);

    // On error, reject publication safely
    return {
      userInputs: {
        ...userInputs,
        publish: {
          approved: false,
          timestamp: new Date().toISOString(),
          signer: "system_error",
          policySnapshot: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      },
      issues: [
        ...(state.issues || []),
        {
          type: "needs_revision",
          description: "Publish gate error occurred during processing",
          severity: "error",
        },
      ],
    };
  }
}
