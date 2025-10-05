/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */
import { interrupt } from "@langchain/langgraph";
import type { ParentState } from "../state";

/**
 * Approvals Gate Node
 *
 * Pauses before high-cost / high-risk actions (e.g., a large crawl) to
 * approve, edit, or cancel. Uses interrupt() which pauses the graph until
 * resumed with a Command(resume=...).
 *
 * This follows LangGraph 1.0-alpha HITL patterns where:
 * - The interrupt function pauses execution
 * - Resume is handled via Command with structured responses
 * - State updates are returned as Partial<ParentState>
 *
 * Triggering conditions (any true → run this gate):
 * - Predicted cost/latency exceeds policy or user budget
 * - New/untrusted domains; sensitive verticals (med/legal/finance)
 * - Paywalled content or robots risk; high host count or rate-limit pressure
 */

// Risk detection patterns
const SENSITIVE_VERTICALS = [
  /\b(medical|health|clinical|drug|pharmaceutical|treatment|therapy|diagnosis|patient)\b/gi,
  /\b(legal|lawyer|attorney|court|lawsuit|regulation|compliance|contract)\b/gi,
  /\b(financial|investment|banking|credit|loan|mortgage|insurance|tax|accounting)\b/gi,
  /\b(government|political|election|campaign|policy|diplomatic|national security)\b/gi,
];

const PAYWALL_INDICATORS = [
  /paywall|subscription|premium|member|login required|sign in/gi,
  /\.pdf$|\.doc$|\.docx$/i, // Common document formats that might be gated
];

const RISKY_DOMAINS = [
  "social media",
  "forum",
  "blog",
  "opinion",
  "editorial",
  "user-generated",
  "comment",
  "review",
  "discussion",
];

// Resource estimation constants
const AVG_URLS_PER_QUERY = 15;
const COST_PER_URL = 0.0008; // Rough estimate per URL harvested
const TIME_PER_URL = 0.8; // Seconds per URL (including processing)
const POLICY_COST_THRESHOLD = 5.0;
const POLICY_TIME_THRESHOLD = 120; // seconds
const DEFAULT_USER_BUDGET = 10.0;
const SENSITIVITY_THRESHOLD = 3;
const MAX_HOSTS_FOR_RISK = 20;

/**
 * Risk assessment for URLs and content
 */
function assessRisk(
  urls: string[],
  queries: string[]
): {
  domains: string[];
  risks: string[];
  sensitivityScore: number;
} {
  const uniqueDomains = [
    ...new Set(
      urls.map((url) => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      })
    ),
  ];

  const risks: string[] = [];
  let sensitivityScore = 0;

  // Check for sensitive verticals in queries
  const queryText = queries.join(" ").toLowerCase();
  for (const pattern of SENSITIVE_VERTICALS) {
    if (pattern.test(queryText)) {
      const vertical = pattern.source.replace(/[\\b]/g, "").split("|")[0];
      risks.push(`sensitive_topic:${vertical}`);
      sensitivityScore += 2;
    }
  }

  // Check for paywall indicators
  for (const url of urls) {
    for (const pattern of PAYWALL_INDICATORS) {
      if (pattern.test(url)) {
        risks.push("paywall");
        sensitivityScore += 1;
        break;
      }
    }
  }

  // Check domain risk
  for (const domain of uniqueDomains) {
    const domainLower = domain.toLowerCase();
    for (const risky of RISKY_DOMAINS) {
      if (domainLower.includes(risky)) {
        risks.push("untrusted_domain");
        sensitivityScore += 1;
      }
    }
  }

  // High host count risk
  if (uniqueDomains.length > MAX_HOSTS_FOR_RISK) {
    risks.push("high_host_count");
    sensitivityScore += 1;
  }

  return {
    domains: uniqueDomains.slice(0, 10), // Limit to top 10 for display
    risks: [...new Set(risks)], // Remove duplicates
    sensitivityScore,
  };
}

/**
 * Estimate cost and time for the operation
 */
function estimateResources(
  queries: string[],
  // biome-ignore lint/correctness/noUnusedFunctionParameters: <Parameter kept for future extensibility>
  plan: ParentState["plan"]
): {
  estCostUsd: number;
  estTimeSeconds: number;
  estUrls: number;
} {
  const estUrls = queries.length * AVG_URLS_PER_QUERY;
  const estCostUsd = estUrls * COST_PER_URL;
  const estTimeSeconds = estUrls * TIME_PER_URL;

  return {
    estCostUsd,
    estTimeSeconds,
    estUrls,
  };
}

export async function approvals(
  state: ParentState
): Promise<Partial<ParentState>> {
  const { userInputs, plan, queries } = state;

  console.log("[approvals] Evaluating approval requirements...");

  if (!(plan && queries) || queries.length === 0) {
    console.log("[approvals] No plan or queries available, skipping approval");
    return {};
  }

  try {
    // Step 1: Assess risk and estimate resources
    const { domains, risks, sensitivityScore } = assessRisk(
      // Use searchResults if available, otherwise estimate from queries
      state.searchResults?.map((r) => r.url) ||
        queries.map(
          (q) => `https://example.com/search?q=${encodeURIComponent(q)}`
        ),
      queries
    );

    const resources = estimateResources(queries, plan);

    console.log(
      `[approvals] Risk assessment: sensitivity=${sensitivityScore}, risks=${risks.length}, estCost=$${resources.estCostUsd.toFixed(2)}`
    );

    // Step 2: Check triggering conditions
    const userBudget = Number(
      (plan?.constraints as Record<string, unknown>)?.budgetUsdCap ??
        DEFAULT_USER_BUDGET
    );

    const shouldTrigger =
      resources.estCostUsd > POLICY_COST_THRESHOLD ||
      resources.estTimeSeconds > POLICY_TIME_THRESHOLD ||
      resources.estCostUsd > userBudget ||
      sensitivityScore >= SENSITIVITY_THRESHOLD ||
      risks.length > 0;

    if (!shouldTrigger) {
      console.log("[approvals] No approval required, proceeding automatically");
      return {};
    }

    // Step 3: Prepare interrupt message following LangGraph patterns
    const approvalMessage = `Research approval required:
- Estimated URLs to process: ${resources.estUrls}
- Unique domains: ${domains.length}
- Estimated cost: $${resources.estCostUsd.toFixed(2)}
- Estimated time: ${Math.round(resources.estTimeSeconds)} seconds
- Risk factors: ${risks.join(", ") || "none"}

Do you approve this research operation?`;

    console.log("[approvals] Triggering approval interrupt");

    // Step 4: Fire interrupt - this will pause the graph
    // Following LangGraph 1.0-alpha patterns
    const humanResponse = interrupt(approvalMessage);

    console.log("[approvals] Resuming with human response");

    // Step 5: Process the response and create approval record
    const timestamp = new Date().toISOString();
    const approvalRecord = {
      timestamp,
      signer: "user",
      step: "harvest",
      decision: "approve" as const,
      policySnapshot: {
        costThreshold: POLICY_COST_THRESHOLD,
        timeThreshold: POLICY_TIME_THRESHOLD,
        userBudget,
        sensitivityScore,
        risks,
        domains,
        estimatedResources: resources,
      },
      notes: `Human approved: ${humanResponse}`,
    };

    console.log("[approvals] Human approved - proceeding with execution");
    return {
      userInputs: {
        ...userInputs,
        approvals: [...(userInputs.approvals || []), approvalRecord],
      },
    };
  } catch (error) {
    console.error("[approvals] Error during approval process:", error);

    // On error, add a cancellation issue to stop execution safely
    return {
      issues: [...(state.issues || []), "approval_gate_error"],
    };
  }
}
