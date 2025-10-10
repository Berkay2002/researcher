/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { ParentState } from "../../../state";
import {
  analyzeRound1Gaps,
  analyzeRound2Gaps,
  generateRound1Queries,
  generateRound2Queries,
  generateRound3Queries,
} from "./helpers";

/**
 * Round 1 Reasoning Node
 *
 * Generates 2-3 broad orientation queries for initial research.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for custom event streaming (thought events)
 * - Returns Partial<State> to update only specific fields
 * - Follows LangGraph node signature: (state, config) => Promise<Partial<State>>
 *
 * @param state Parent state with user inputs and plan
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with queries and round number
 */
export async function round1ReasoningNode(
  state: ParentState,
  config: LangGraphRunnableConfig
): Promise<Partial<ParentState>> {
  const goal = state.userInputs?.goal || "";
  const constraints = state.plan?.constraints || {};
  const writer = config.writer;

  console.log(
    "[Round1 Reasoning] Starting broad orientation query generation..."
  );

  // Emit thought event (LangGraph streaming pattern)
  if (writer) {
    await writer({
      type: "thought",
      round: 1,
      content:
        "Beginning broad orientation research to establish foundation...",
    });
  }

  // Generate broad queries using LLM
  const queries = await generateRound1Queries(goal, constraints);

  if (writer) {
    await writer({
      type: "thought",
      round: 1,
      content: `Generated ${queries.length} broad queries: ${queries.join("; ")}`,
    });
  }

  // Return partial state update (LangGraph pattern)
  // Add queries to parent state's queries array (accumulates via reducer)
  return {
    queries,
  };
}

/**
 * Round 2 Reasoning Node
 *
 * Analyzes Round 1 findings, identifies gaps, generates targeted queries.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming thoughts
 * - Accesses previous round data from state
 * - Returns partial state update
 *
 * @param state Parent state with Round 1 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with new queries
 */
export async function round2ReasoningNode(
  state: ParentState,
  config: LangGraphRunnableConfig
): Promise<Partial<ParentState>> {
  const writer = config.writer;

  // Extract goal from parent state
  const goal = state.userInputs?.goal || "";

  // Get findings from research state (accumulated by search nodes)
  const enrichedSources = state.research?.enriched || [];

  // For Round 2, we need to check what was gathered in Round 1
  // Since we don't have a findings array, we'll use the enriched sources count

  console.log(
    "[Round2 Reasoning] Analyzing Round 1 findings and generating deep-dive queries..."
  );

  // Get Round 1 queries from state (set by round1ReasoningNode)
  const ROUND_1_MAX_QUERIES = 3;
  const round1Queries = state.queries?.slice(0, ROUND_1_MAX_QUERIES) || [];
  const round1SourceCount = enrichedSources.length;

  if (round1SourceCount === 0) {
    console.warn("[Round2 Reasoning] No Round 1 sources found");
  }

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Analyzing Round 1 findings (${round1SourceCount} sources)...`,
    });
  }

  // Analyze gaps from Round 1
  const { gaps } = await analyzeRound1Gaps(
    goal,
    round1Queries,
    round1SourceCount
  );

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Identified ${gaps.length} knowledge gaps: ${gaps.join(", ")}`,
    });
  }

  // Generate targeted queries based on gaps
  const queries = await generateRound2Queries(goal, gaps, {
    queries: round1Queries,
    sourceCount: round1SourceCount,
  });

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Generated ${queries.length} targeted queries for deep dive: ${queries.join("; ")}`,
    });
  }

  return {
    queries,
  };
}

/**
 * Round 3 Reasoning Node
 *
 * Analyzes Round 2 findings, identifies remaining gaps, generates validation queries.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming thoughts
 * - Accesses all previous findings from state
 * - Returns partial state update
 *
 * @param state Parent state with Round 1 & 2 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with validation queries
 */
export async function round3ReasoningNode(
  state: ParentState,
  config: LangGraphRunnableConfig
): Promise<Partial<ParentState>> {
  const writer = config.writer;

  // Extract goal from parent state
  const goal = state.userInputs?.goal || "";

  // Get all enriched sources (from Rounds 1 & 2)
  const enrichedSources = state.research?.enriched || [];
  const allSourcesCount = enrichedSources.length;

  console.log(
    "[Round3 Reasoning] Analyzing Round 2 findings and generating validation queries..."
  );

  // Get Round 2 queries from state (queries after Round 1)
  const allQueries = state.queries || [];
  const ROUND_1_QUERY_END = 3;
  const ROUND_2_QUERY_END = 7;
  const round2Queries =
    allQueries.slice(ROUND_1_QUERY_END, ROUND_2_QUERY_END) || [];
  const round2SourceCount = allSourcesCount; // Total after Round 2

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Analyzing Round 2 deep-dive findings (${allSourcesCount} total sources)...`,
    });
  }

  // Analyze remaining gaps after Round 2
  const { gaps } = await analyzeRound2Gaps(
    goal,
    round2Queries,
    round2SourceCount,
    allSourcesCount
  );

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Identified ${gaps.length} remaining gaps for final validation: ${gaps.join(", ")}`,
    });
  }

  // Generate validation queries
  const queries = await generateRound3Queries(
    goal,
    gaps,
    {
      queries: round2Queries,
      sourceCount: round2SourceCount,
    },
    allSourcesCount
  );

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Generated ${queries.length} validation queries for final round: ${queries.join("; ")}`,
    });
  }

  return {
    queries,
  };
}
