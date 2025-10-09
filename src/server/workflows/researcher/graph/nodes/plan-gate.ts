/** biome-ignore-all lint/suspicious/noConsole: <For development> */
/** biome-ignore-all lint/complexity/noForEach: <No forEach loops allowed> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Complex validation logic> */
/** biome-ignore-all lint/suspicious/useAwait: <Complex validation logic> */
import type { ParentState } from "../state";

/**
 * Plan Gate Node
 *
 * Determines whether to use Auto mode or Plan mode based on:
 * - User's explicit mode override
 * - Auto-gate heuristics (clarity, coherence, cost)
 *
 * Thresholds:
 * - τ₁ (clarity): 0.6 - minimum clarity score for Auto mode
 * - τ₂ (coherence): 0.5 - minimum coherence score for Auto mode
 * - Default budget: $5.00 USD for Auto mode
 */

// Threshold constants
const CLARITY_THRESHOLD = 0.6; // τ₁
const COHERENCE_THRESHOLD = 0.5; // τ₂
const DEFAULT_BUDGET_USD = 5.0;

// Cost estimation constants (rough estimates)
const COST_PER_QUERY = 0.002; // ~$0.002 per search query
const COST_PER_TOKEN = 0.000_000_4; // ~$0.40 per 1M tokens (GPT-4-mini)
const AVG_TOKENS_PER_RESPONSE = 500; // Average tokens per LLM response
const AVG_QUERIES_PER_GOAL = 5; // Average number of queries generated

// Regex patterns (moved to top level for performance)
const WORD_SPLIT_REGEX = /\s+/;
const TIME_PATTERNS = [
  /\b(2024|2025|2026|last year|this year|next year|recent|current|latest)\b/gi,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
  /\b(q1|q2|q3|q4|quarter|half|h1|h2)\b/gi,
  /\b(past|future|next|last|previous|upcoming|coming)\s+\d+\s+(years?|months?|weeks?|days?)\b/gi,
];
const INTENT_PATTERNS = [
  /\b(analyze|compare|evaluate|summarize|research|investigate|examine|assess)\b/gi,
  /\b(what|how|why|when|where|which|who)\b/gi,
  /\b(benefits|drawbacks|advantages|disadvantages|pros|cons|impact|effect)\b/gi,
];
const VAGUE_PATTERNS = [
  /\b(something|anything|everything|nothing|stuff|things|information|data)\b/gi,
  /\b(general|overview|summary|basics|introduction)\b/gi,
];
const TOPIC_PATTERNS = [
  /\b(technology|science|research|study|report|analysis|market|business|finance|economics)\b/gi,
  /\b(health|medical|clinical|trial|treatment|drug|therapy|disease)\b/gi,
  /\b(policy|government|regulation|law|legal|compliance)\b/gi,
  /\b(education|university|research|academic|journal|paper)\b/gi,
];
const NICHE_PATTERNS = [
  /\b(personal|private|individual|specific|unique|custom|specialized)\b/gi,
  /\b(my|our|specific|particular|certain|exact)\b/gi,
];

// Scoring constants
const BASE_CLARITY_SCORE = 0.3;
const BASE_COHERENCE_SCORE = 0.5;
const WORD_COUNT_THRESHOLD_SHORT = 20;
const WORD_COUNT_THRESHOLD_LONG = 50;
const SHORT_WORD_BONUS = 0.2;
const LONG_WORD_BONUS = 0.1;
const TIME_SCOPE_BONUS = 0.2;
const INTENT_MATCH_MULTIPLIER = 0.05;
const MAX_INTENT_BONUS = 0.2;
const VAGUE_PENALTY_MULTIPLIER = 0.05;
const TOPIC_MATCH_MULTIPLIER = 0.1;
const MAX_TOPIC_BONUS = 0.3;
const NICHE_PENALTY_MULTIPLIER = 0.05;
const WORD_COUNT_DIVISOR = 100;
const COMPLEXITY_BASE_MULTIPLIER = 1;

// Display formatting constants
const CLARITY_PRECISION = 3;
const COHERENCE_PRECISION = 3;
const COST_PRECISION = 2;
const GOAL_PREVIEW_LENGTH = 100;
const TRUNCATE_SUFFIX = "...";

/**
 * Calculate clarity score based on IR-style heuristics
 * Higher scores for longer, time-scoped, single-intent prompts
 */
function calculateClarity(goal: string): number {
  let score = BASE_CLARITY_SCORE;

  // Length bonus (longer prompts are often more specific)
  const wordCount = goal.trim().split(WORD_SPLIT_REGEX).length;
  if (wordCount > WORD_COUNT_THRESHOLD_SHORT) {
    score += SHORT_WORD_BONUS;
    if (wordCount > WORD_COUNT_THRESHOLD_LONG) {
      score += LONG_WORD_BONUS;
    }
  }

  // Time scope detection
  const hasTimeScope = TIME_PATTERNS.some((pattern) => pattern.test(goal));
  if (hasTimeScope) {
    score += TIME_SCOPE_BONUS;
  }

  // Intent clarity (specific action words)
  const intentMatches = INTENT_PATTERNS.reduce((count, pattern) => {
    const matches = goal.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);

  score += Math.min(intentMatches * INTENT_MATCH_MULTIPLIER, MAX_INTENT_BONUS);

  // Penalty for vague language
  const vagueMatches = VAGUE_PATTERNS.reduce((count, pattern) => {
    const matches = goal.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);

  score -= vagueMatches * VAGUE_PENALTY_MULTIPLIER;

  return Math.max(0, Math.min(1, score));
}

/**
 * Estimate USD cost for the research task
 */
function estimateCostUsd(goal: string): number {
  const wordCount = goal.trim().split(WORD_SPLIT_REGEX).length;

  // Base costs
  const queryCost = AVG_QUERIES_PER_GOAL * COST_PER_QUERY;
  const llmCost =
    AVG_QUERIES_PER_GOAL * AVG_TOKENS_PER_RESPONSE * COST_PER_TOKEN;

  // Complexity multiplier based on goal length and complexity
  const complexityMultiplier =
    COMPLEXITY_BASE_MULTIPLIER + wordCount / WORD_COUNT_DIVISOR;

  return (queryCost + llmCost) * complexityMultiplier;
}

/**
 * Perform preview coherence check
 * Returns a score based on hypothetical search result quality
 * In a real implementation, this would fire actual search queries
 */
async function calculateCoherence(goal: string): Promise<number> {
  // For now, return a deterministic score based on goal characteristics
  // In a real implementation, this would:
  // 1. Fire 1-2 search queries to Tavily and Exa
  // 2. Analyze result diversity and relevance
  // 3. Score based on host diversity and title coherence

  let score = BASE_COHERENCE_SCORE;

  // Bonus for specific topics that tend to have good search results
  const topicMatches = TOPIC_PATTERNS.reduce((count, pattern) => {
    const matches = goal.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);

  score += Math.min(topicMatches * TOPIC_MATCH_MULTIPLIER, MAX_TOPIC_BONUS);

  // Penalty for very niche or obscure topics
  const nicheMatches = NICHE_PATTERNS.reduce((count, pattern) => {
    const matches = goal.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);

  score -= nicheMatches * NICHE_PENALTY_MULTIPLIER;

  return Math.max(0, Math.min(1, score));
}

export async function planGate(
  state: ParentState
): Promise<Partial<ParentState>> {
  let { userInputs } = state;
  let { goal, modeOverride } = userInputs;

  // Extract goal from messages if not provided in userInputs (LangSmith Chat support)
  if (!goal && state.messages && state.messages.length > 0) {
    // biome-ignore lint/style/useAtIndex: <Prefer traditional indexing>
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage && typeof lastMessage.content === "string") {
      goal = lastMessage.content;
      // Update userInputs with extracted goal
      userInputs = {
        ...userInputs,
        goal,
      };
      console.log(
        `[planGate] Extracted goal from messages: "${goal.substring(0, GOAL_PREVIEW_LENGTH)}${TRUNCATE_SUFFIX}"`
      );
    }
  }

  console.log(
    `[planGate] Evaluating mode selection for goal: "${goal.substring(0, GOAL_PREVIEW_LENGTH)}${TRUNCATE_SUFFIX}"`
  );

  try {
    // Step 1: Check for explicit UI override
    if (modeOverride === "auto") {
      console.log("[planGate] Using explicit Auto mode override");
      return {
        userInputs: {
          ...userInputs,
          gate: {
            clarity: 1.0,
            coherence: 1.0,
            usd: 0,
            auto: true,
          },
          modeFinal: "auto",
        },
      };
    }

    if (modeOverride === "plan") {
      // Only log when first entering plan mode, not on subsequent resumes
      if (!state.planning?.questions) {
        console.log("[planGate] Using explicit Plan mode override");
      }
      return {
        userInputs: {
          ...userInputs,
          gate: {
            clarity: 0.0,
            coherence: 0.0,
            usd: 0,
            auto: false,
          },
          modeFinal: "plan",
        },
      };
    }

    // Step 2: Compute gating signals
    const clarity = calculateClarity(goal);
    const coherence = await calculateCoherence(goal);
    const usd = estimateCostUsd(goal);

    console.log(
      `[planGate] Signal scores: clarity=${clarity.toFixed(CLARITY_PRECISION)}, coherence=${coherence.toFixed(COHERENCE_PRECISION)}, cost=$${usd.toFixed(COST_PRECISION)}`
    );

    // Step 3: Apply threshold policy
    const autoDecision =
      clarity >= CLARITY_THRESHOLD &&
      coherence >= COHERENCE_THRESHOLD &&
      usd <= DEFAULT_BUDGET_USD;

    const modeFinal = autoDecision ? "auto" : "plan";

    console.log(
      `[planGate] Decision: ${modeFinal.toUpperCase()} mode (thresholds: τ₁=${CLARITY_THRESHOLD}, τ₂=${COHERENCE_THRESHOLD}, budget=$${DEFAULT_BUDGET_USD})`
    );

    // Step 4: Log observability data
    const logData = {
      thread_id: state.threadId,
      clarity,
      coherence,
      usd,
      decision: modeFinal,
      goal_len: goal.length,
      thresholds: {
        clarity: CLARITY_THRESHOLD,
        coherence: COHERENCE_THRESHOLD,
        budget: DEFAULT_BUDGET_USD,
      },
    };
    console.log("[planGate] Observability:", JSON.stringify(logData, null, 2));

    return {
      userInputs: {
        ...userInputs,
        gate: {
          clarity,
          coherence,
          usd,
          auto: autoDecision,
        },
        modeFinal,
      },
    };
  } catch (error) {
    console.error("[planGate] Error during evaluation:", error);

    // Default to Plan mode on errors for safety
    console.log("[planGate] Defaulting to Plan mode due to error");
    return {
      userInputs: {
        ...userInputs,
        gate: {
          clarity: 0,
          coherence: 0,
          usd: 0,
          auto: false,
        },
        modeFinal: "plan",
      },
    };
  }
}
