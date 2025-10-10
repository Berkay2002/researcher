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
 * @param state Current iterative research state
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with queries and round number
 */
export async function round1ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { goal, constraints } = state;
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
  return {
    currentRound: 1,
    currentQueries: queries,
  };
}

/**
 * Round 2 Reasoning Node
 *
 * Analyzes Round 1 findings, identifies gaps, generates targeted queries.
 *
 * Pattern from: documentation/langgraph/09-streaming.md
 * - Uses config.writer for streaming thoughts
 * - Accesses previous round data from state.findings
 * - Returns partial state update
 *
 * @param state Current iterative research state with Round 1 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with new queries
 */
export async function round2ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { goal, findings } = state;
  const writer = config.writer;

  console.log(
    "[Round2 Reasoning] Analyzing Round 1 findings and generating deep-dive queries..."
  );

  // Get Round 1 finding
  const round1Finding = findings.find((f) => f.round === 1);
  if (!round1Finding) {
    console.error("[Round2 Reasoning] No Round 1 findings available");
    return {
      currentRound: 2,
      currentQueries: [],
    };
  }

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Analyzing Round 1 findings (${round1Finding.results.length} sources)...`,
    });
  }

  // Analyze gaps from Round 1
  const { gaps } = await analyzeRound1Gaps(
    goal,
    round1Finding.queries,
    round1Finding.results.length
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
    queries: round1Finding.queries,
    sourceCount: round1Finding.results.length,
  });

  if (writer) {
    await writer({
      type: "thought",
      round: 2,
      content: `Generated ${queries.length} targeted queries for deep dive: ${queries.join("; ")}`,
    });
  }

  return {
    currentRound: 2,
    currentQueries: queries,
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
 * @param state Current iterative research state with Round 1 & 2 findings
 * @param config LangGraph runnable config with writer for streaming
 * @returns Partial state update with validation queries
 */
export async function round3ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { goal, findings, allSources } = state;
  const writer = config.writer;

  console.log(
    "[Round3 Reasoning] Analyzing Round 2 findings and generating validation queries..."
  );

  // Get Round 2 finding
  const round2Finding = findings.find((f) => f.round === 2);
  if (!round2Finding) {
    console.error("[Round3 Reasoning] No Round 2 findings available");
    return {
      currentRound: 3,
      currentQueries: [],
    };
  }

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Analyzing Round 2 deep-dive findings (${round2Finding.results.length} new sources)...`,
    });
  }

  // Analyze remaining gaps after Round 2
  const { gaps } = await analyzeRound2Gaps(
    goal,
    round2Finding.queries,
    round2Finding.results.length,
    allSources.length
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
      queries: round2Finding.queries,
      sourceCount: round2Finding.results.length,
    },
    allSources.length
  );

  if (writer) {
    await writer({
      type: "thought",
      round: 3,
      content: `Generated ${queries.length} validation queries for final round: ${queries.join("; ")}`,
    });
  }

  return {
    currentRound: 3,
    currentQueries: queries,
  };
}
