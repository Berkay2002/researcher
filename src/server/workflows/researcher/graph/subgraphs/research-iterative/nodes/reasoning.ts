/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { IterativeResearchState } from "../state";
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
 * @param state Iterative research state with goal and constraints
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with queries and round number
 */
export async function round1ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const goal = state.goal || "";
  const constraints = state.constraints || {};
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
  // Set currentQueries for the search node to execute
  return {
    currentQueries: queries,
    currentRound: 1,
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
 * @param state Iterative research state with Round 1 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with new queries
 */
export async function round2ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const writer = config.writer;

  // Extract goal from iterative research state
  const goal = state.goal || "";

  // Get findings from Round 1
  const round1Findings = state.findings.filter((f) => f.round === 1);

  console.log(
    "[Round2 Reasoning] Analyzing Round 1 findings and generating deep-dive queries..."
  );

  // Get Round 1 queries from findings
  const round1Queries =
    round1Findings.length > 0 ? round1Findings[0].queries : [];
  const round1SourceCount =
    round1Findings.length > 0 ? round1Findings[0].metadata.sourcesFound : 0;

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
    currentQueries: queries,
    currentRound: 2,
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
 * @param state Iterative research state with Round 1 & 2 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with validation queries
 */
export async function round3ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const writer = config.writer;

  // Extract goal from state
  const goal = state.goal || "";

  // Get findings from Rounds 1 & 2
  const round2Findings = state.findings.filter((f) => f.round === 2);
  const allSourcesCount = state.allSources.length;

  console.log(
    "[Round3 Reasoning] Analyzing Round 2 findings and generating validation queries..."
  );

  // Get Round 2 queries from findings
  const round2Queries =
    round2Findings.length > 0 ? round2Findings[0].queries : [];
  const round2SourceCount =
    round2Findings.length > 0 ? round2Findings[0].metadata.sourcesFound : 0;

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
    currentQueries: queries,
    currentRound: 3,
  };
}
