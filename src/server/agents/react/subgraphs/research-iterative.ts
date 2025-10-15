/**
 * Iterative Research Subagent - Sequential Reasoning Pattern
 *
 * Implements ChatGPT Deep Research methodology:
 * - Round-based research with reasoning between rounds
 * - Sequential search execution (not parallel)
 * - Gap analysis and adaptive query generation
 * - Real-time thought streaming via config.writer
 * - Quality over speed
 *
 * Based on official LangGraph patterns from documentation/
 */

import {
  AIMessage,
  type BaseMessage,
  HumanMessage,
} from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { getCurrentDateString } from "@/server/shared/utils/current-date";
import { EXA_API_KEY, TAVILY_API_KEY } from "../../../shared/configs/env";
import { getLLM } from "../../../shared/configs/llm";
import { ExaClient, type ExaSearchResult } from "../../../shared/tools/exa";
import {
  TavilyClient,
  type TavilySearchResult,
} from "../../../shared/tools/tavily";
import type { SearchRunMetadata } from "../../../types/react-agent";

// ============================================================================
// Search Clients
// ============================================================================

const tavilyClient = new TavilyClient(TAVILY_API_KEY);
const exaClient = new ExaClient(EXA_API_KEY);

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RESULTS_PER_QUERY = 8;
const SEARCH_PAUSE_MS = 300;
const MAX_FALLBACK_QUERIES = 5;

// ============================================================================
// Types
// ============================================================================

type SearchResult = TavilySearchResult | ExaSearchResult;

type Claim = {
  id: string;
  text: string;
  citations: number[];
  confidence: "high" | "medium" | "low";
};

// ============================================================================
// State Schema
// ============================================================================

/**
 * Research finding from a single round
 */
const FindingSchema = z.object({
  round: z.number().describe("Which round this finding is from (1, 2, or 3)"),
  queries: z.array(z.string()).describe("Queries executed in this round"),
  results: z
    .array(z.any())
    .describe("Search results from this round")
    .transform((val) => val as SearchResult[]),
  reasoning: z.string().describe("LLM reasoning about this round"),
  gaps: z
    .array(z.string())
    .optional()
    .describe("Gaps identified for next round"),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Iterative research state - accumulates findings across rounds
 */
export const IterativeResearchStateAnnotation = Annotation.Root({
  // Input query
  query: Annotation<string>,

  // Current round (1, 2, or 3)
  currentRound: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 1,
  }),

  // Accumulated findings from all rounds
  findings: Annotation<Finding[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  // Message history for LLM context
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // Search run metadata
  searchRuns: Annotation<SearchRunMetadata[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),

  // Final outputs
  report: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
  }),

  claims: Annotation<Claim[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  sourcesUsed: Annotation<number | null>({
    reducer: (x, y) => y ?? x,
  }),

  wordCount: Annotation<number | null>({
    reducer: (x, y) => y ?? x,
  }),
});

export type IterativeResearchState =
  typeof IterativeResearchStateAnnotation.State;

// ============================================================================
// Helper Functions
// ============================================================================

// Regex patterns at top level for performance
const MARKDOWN_CODE_BLOCK_REGEX = /```(?:json)?\s*|\s*```/g;
const JSON_ARRAY_REGEX = /\[[\s\S]*\]/;
const QUERY_PREFIX_REGEX = /^["'*•-]\s*/;

/**
 * Extract queries from LLM text output (fallback parsing)
 */
function extractQueriesFromText(inputText: string): string[] {
  // Remove markdown code blocks
  const cleanedText = inputText.replace(MARKDOWN_CODE_BLOCK_REGEX, "").trim();

  // Try to find JSON array
  const jsonMatch = cleanedText.match(JSON_ARRAY_REGEX);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as string[];
    } catch {
      // Continue to line-based extraction
    }
  }

  // Extract lines that look like queries
  return cleanedText
    .split("\n")
    .map((line) => line.replace(QUERY_PREFIX_REGEX, "").trim())
    .filter(
      (line) =>
        line.length > 10 && !line.startsWith("[") && !line.startsWith("{")
    )
    .slice(0, MAX_FALLBACK_QUERIES);
}

/**
 * Execute search using Tavily or Exa
 */
async function executeSearch(
  query: string,
  provider: "tavily" | "exa" = "tavily",
  maxResults = DEFAULT_RESULTS_PER_QUERY
): Promise<{ results: SearchResult[]; metadata: SearchRunMetadata }> {
  const startedAt = new Date().toISOString();

  let results: SearchResult[];

  if (provider === "tavily") {
    results = await tavilyClient.search({
      query,
      maxResults,
      searchDepth: "basic",
    });
  } else {
    results = await exaClient.search({
      query,
      maxResults,
      type: "auto",
    });
  }

  const completedAt = new Date().toISOString();

  return {
    results,
    metadata: {
      query,
      provider,
      startedAt,
      completedAt,
    },
  };
}

// ============================================================================
// Round 1: Broad Orientation
// ============================================================================

/**
 * Round 1 Reasoning: Generate broad, high-level queries
 */
async function round1ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentDate = getCurrentDateString();

  // Emit thought
  config.writer?.({
    type: "thought",
    content: "Beginning broad research to understand the landscape...",
    round: 1,
  });

  const llm = getLLM("generation");

  const systemPrompt = `**CURRENT DATE: ${currentDate}**

You are conducting Round 1 of deep research: Broad Orientation.

OBJECTIVE:
- Generate 2-3 broad, high-level queries to understand the landscape
- Target official sources, major news outlets, and overview articles
- Focus on establishing context and identifying key dimensions

Think step-by-step about what foundational information is needed.

OUTPUT FORMAT (JSON only):
{
  "reasoning": "Why these queries cover the essential starting points...",
  "queries": ["query 1", "query 2", "query 3"]
}`;

  const userPrompt = `Research goal: ${state.query}

Generate 2-3 broad queries for initial orientation.`;

  config.writer?.({
    type: "thought",
    content: "Analyzing research goal to identify key dimensions...",
    round: 1,
  });

  const response = await llm.invoke([
    new HumanMessage(`${systemPrompt}\n\n${userPrompt}`),
  ]);

  let parsed: { reasoning: string; queries: string[] };
  try {
    const content = (response.content as string)
      .replace(/```(?:json)?\s*|\s*```/g, "")
      .trim();
    parsed = JSON.parse(content);
  } catch {
    // Fallback
    parsed = {
      reasoning: "Generated broad queries for initial orientation",
      queries: extractQueriesFromText(response.content as string),
    };
  }

  config.writer?.({
    type: "thought",
    content: `Generated ${parsed.queries.length} broad queries: ${parsed.queries.map((q) => `"${q}"`).join(", ")}`,
    round: 1,
  });

  return {
    currentRound: 1,
    messages: [
      new HumanMessage(userPrompt),
      new AIMessage(JSON.stringify(parsed)),
    ],
    findings: [
      {
        round: 1,
        queries: parsed.queries,
        results: [],
        reasoning: parsed.reasoning,
      },
    ],
  };
}

/**
 * Round 1 Search: Execute broad queries sequentially
 */
async function round1SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentFinding = state.findings.at(-1);
  if (!currentFinding) {
    throw new Error("No finding to search for");
  }

  const queries = currentFinding.queries;
  const allResults: SearchResult[] = [];
  const searchRuns: SearchRunMetadata[] = [];

  // Execute searches SEQUENTIALLY (key difference from parallel approach)
  for (const query of queries) {
    config.writer?.({
      type: "search",
      content: `Searching: "${query}"`,
      round: 1,
    });

    const { results, metadata } = await executeSearch(query, "tavily");

    config.writer?.({
      type: "read",
      content: `Reading ${results.length} sources...`,
      round: 1,
    });

    allResults.push(...results);
    searchRuns.push(metadata);

    // Brief pause to simulate reading (matches ChatGPT behavior)
    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  config.writer?.({
    type: "thought",
    content: `Reviewed ${allResults.length} sources. Identified key themes and gaps for deeper investigation.`,
    round: 1,
  });

  // Update the last finding with results
  const updatedFinding: Finding = {
    ...currentFinding,
    results: allResults,
  };

  return {
    findings: [updatedFinding],
    searchRuns,
  };
}

// ============================================================================
// Round 2: Deep Dive
// ============================================================================

/**
 * Round 2 Reasoning: Analyze gaps and generate targeted queries
 */
async function round2ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentDate = getCurrentDateString();

  config.writer?.({
    type: "thought",
    content:
      "Analyzing Round 1 findings to identify gaps and specific areas to explore...",
    round: 2,
  });

  const round1Findings = state.findings.filter((f) => f.round === 1);
  const llm = getLLM("generation");

  const systemPrompt = `**CURRENT DATE: ${currentDate}**

You are conducting Round 2 of deep research: Deep Dive.

ROUND 1 SUMMARY:
${JSON.stringify(round1Findings, null, 2)}

OBJECTIVE:
- Identify specific dimensions that need deeper investigation
- Generate 3-4 targeted queries for detailed analysis
- Target: research reports, expert opinions, detailed analysis
- Focus on filling knowledge gaps from Round 1

OUTPUT FORMAT (JSON only):
{
  "gaps_identified": ["gap 1", "gap 2", "gap 3"],
  "reasoning": "Why these gaps are important...",
  "queries": ["query 1", "query 2", "query 3", "query 4"]
}`;

  const userPrompt =
    "Based on Round 1, identify gaps and generate targeted queries for deep investigation.";

  const response = await llm.invoke([
    new HumanMessage(`${systemPrompt}\n\n${userPrompt}`),
  ]);

  let parsed: {
    gaps_identified: string[];
    reasoning: string;
    queries: string[];
  };
  try {
    const content = (response.content as string)
      .replace(/```(?:json)?\s*|\s*```/g, "")
      .trim();
    parsed = JSON.parse(content);
  } catch {
    // Fallback
    parsed = {
      gaps_identified: [
        "Financial details",
        "Competitive analysis",
        "Technical specifications",
      ],
      reasoning: "Generated targeted queries for deep dive",
      queries: extractQueriesFromText(response.content as string),
    };
  }

  config.writer?.({
    type: "thought",
    content: `Identified gaps: ${parsed.gaps_identified.join(", ")}. Deep diving into these areas...`,
    round: 2,
  });

  return {
    currentRound: 2,
    messages: [
      new HumanMessage(userPrompt),
      new AIMessage(JSON.stringify(parsed)),
    ],
    findings: [
      {
        round: 2,
        queries: parsed.queries,
        results: [],
        reasoning: parsed.reasoning,
        gaps: parsed.gaps_identified,
      },
    ],
  };
}

/**
 * Round 2 Search: Execute targeted queries sequentially
 */
async function round2SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentFinding = state.findings.at(-1);
  if (!currentFinding) {
    throw new Error("No finding to search for");
  }

  const queries = currentFinding.queries;
  const allResults: SearchResult[] = [];
  const searchRuns: SearchRunMetadata[] = [];

  // Use Exa for some queries (semantic search for deep dive)
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const provider = i % 2 === 0 ? "tavily" : "exa"; // Alternate providers

    config.writer?.({
      type: "search",
      content: `Deep diving: "${query}"`,
      round: 2,
    });

    const { results, metadata } = await executeSearch(query, provider);

    config.writer?.({
      type: "read",
      content: `Analyzing ${results.length} detailed sources...`,
      round: 2,
    });

    allResults.push(...results);
    searchRuns.push(metadata);

    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  config.writer?.({
    type: "thought",
    content: `Deep dive complete. Gathered ${allResults.length} detailed sources. Checking for remaining gaps...`,
    round: 2,
  });

  const updatedFinding: Finding = {
    ...currentFinding,
    results: allResults,
  };

  return {
    findings: [updatedFinding],
    searchRuns,
  };
}

// ============================================================================
// Round 3: Gap Filling & Validation
// ============================================================================

/**
 * Round 3 Reasoning: Final gap filling and validation queries
 */
async function round3ReasoningNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentDate = getCurrentDateString();

  config.writer?.({
    type: "thought",
    content: "Identifying final gaps and validation needs...",
    round: 3,
  });

  const previousFindings = state.findings;
  const llm = getLLM("generation");

  const systemPrompt = `**CURRENT DATE: ${currentDate}**

You are conducting Round 3 of deep research: Gap Filling & Validation.

PREVIOUS ROUNDS:
${JSON.stringify(previousFindings, null, 2)}

OBJECTIVE:
- Identify any remaining gaps or claims that need validation
- Generate 2-3 refinement queries
- Target: verification sources, alternative perspectives, recent updates
- Prepare for final synthesis

OUTPUT FORMAT (JSON only):
{
  "remaining_gaps": ["gap 1", "gap 2"],
  "reasoning": "Why these final queries...",
  "queries": ["query 1", "query 2", "query 3"]
}`;

  const userPrompt =
    "Identify remaining gaps and generate final validation queries.";

  const response = await llm.invoke([
    new HumanMessage(`${systemPrompt}\n\n${userPrompt}`),
  ]);

  let parsed: {
    remaining_gaps: string[];
    reasoning: string;
    queries: string[];
  };
  try {
    const content = (response.content as string)
      .replace(/```(?:json)?\s*|\s*```/g, "")
      .trim();
    parsed = JSON.parse(content);
  } catch {
    // Fallback
    parsed = {
      remaining_gaps: ["Validation needed"],
      reasoning: "Final validation queries",
      queries: extractQueriesFromText(response.content as string),
    };
  }

  config.writer?.({
    type: "thought",
    content: `Final validation round: ${parsed.queries.length} queries to confirm findings...`,
    round: 3,
  });

  return {
    currentRound: 3,
    messages: [
      new HumanMessage(userPrompt),
      new AIMessage(JSON.stringify(parsed)),
    ],
    findings: [
      {
        round: 3,
        queries: parsed.queries,
        results: [],
        reasoning: parsed.reasoning,
        gaps: parsed.remaining_gaps,
      },
    ],
  };
}

/**
 * Round 3 Search: Execute validation queries sequentially
 */
async function round3SearchNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const currentFinding = state.findings.at(-1);
  if (!currentFinding) {
    throw new Error("No finding to search for");
  }

  const queries = currentFinding.queries;
  const allResults: SearchResult[] = [];
  const searchRuns: SearchRunMetadata[] = [];

  for (const query of queries) {
    config.writer?.({
      type: "search",
      content: `Validating: "${query}"`,
      round: 3,
    });

    const { results, metadata } = await executeSearch(query, "tavily");

    config.writer?.({
      type: "read",
      content: `Cross-referencing ${results.length} sources...`,
      round: 3,
    });

    allResults.push(...results);
    searchRuns.push(metadata);

    await new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS));
  }

  config.writer?.({
    type: "thought",
    content: `Validation complete. Ready to synthesize comprehensive report from ${state.findings.flatMap((f) => f.results).length} total sources.`,
    round: 3,
  });

  const updatedFinding: Finding = {
    ...currentFinding,
    results: allResults,
  };

  return {
    findings: [updatedFinding],
    searchRuns,
  };
}

// ============================================================================
// Final Synthesis
// ============================================================================

/**
 * Synthesis Node: Create comprehensive report with structured claims
 */
async function synthesizeNode(
  state: IterativeResearchState,
  config: LangGraphRunnableConfig
): Promise<Partial<IterativeResearchState>> {
  config.writer?.({
    type: "thought",
    content: "Synthesizing all findings into comprehensive report...",
    round: 4,
  });

  const currentDate = getCurrentDateString();
  const llm = getLLM("generation");

  // Collect all sources
  const allSources = state.findings.flatMap((f) => f.results);

  const systemPrompt = `**CURRENT DATE: ${currentDate}**

You have completed 3 rounds of iterative research. Synthesize everything into a comprehensive report.

RESEARCH JOURNEY:
${JSON.stringify(state.findings, null, 2)}

TOTAL SOURCES: ${allSources.length}

Create a comprehensive report (2,000-4,000 words) with:
1. Executive summary
2. Detailed analysis organized by key dimensions
3. Inline [Source X] citations throughout
4. Key insights and implications
5. References section (APA format)

Also extract 10-20 key factual claims with confidence levels and supporting sources.

OUTPUT FORMAT (JSON only):
{
  "report": "# Title\\n\\nExecutive Summary...\\n\\n## Section 1...\\n\\nReferences...",
  "claims": [
    {
      "id": "claim_1",
      "text": "Factual assertion",
      "citations": [1, 3, 5],
      "confidence": "high"
    }
  ],
  "sourcesUsed": 25,
  "wordCount": 3500
}`;

  config.writer?.({
    type: "thought",
    content:
      "Writing comprehensive report with structured claims and citations...",
    round: 4,
  });

  const response = await llm.invoke([new HumanMessage(systemPrompt)]);

  let output: {
    report: string;
    claims: Claim[];
    sourcesUsed: number;
    wordCount: number;
  };

  try {
    const content = (response.content as string)
      .replace(MARKDOWN_CODE_BLOCK_REGEX, "")
      .trim();
    output = JSON.parse(content) as typeof output;
  } catch {
    // Fallback
    output = {
      report: response.content as string,
      claims: [],
      sourcesUsed: allSources.length,
      wordCount: (response.content as string).split(" ").length,
    };
  }

  config.writer?.({
    type: "complete",
    content: `Research complete! Generated ${output.wordCount} word report with ${output.sourcesUsed} sources across 3 iterative rounds.`,
    round: 4,
  });

  return {
    report: output.report,
    claims: output.claims,
    sourcesUsed: output.sourcesUsed,
    wordCount: output.wordCount,
  };
}

// ============================================================================
// Graph Construction
// ============================================================================

/**
 * Create iterative research subagent graph
 */
export function createIterativeResearchSubagent() {
  const graph = new StateGraph(IterativeResearchStateAnnotation)
    // Round 1: Broad orientation
    .addNode("round1_reason", round1ReasoningNode)
    .addNode("round1_search", round1SearchNode)

    // Round 2: Deep dive
    .addNode("round2_reason", round2ReasoningNode)
    .addNode("round2_search", round2SearchNode)

    // Round 3: Gap filling
    .addNode("round3_reason", round3ReasoningNode)
    .addNode("round3_search", round3SearchNode)

    // Final synthesis
    .addNode("synthesize", synthesizeNode)

    // Sequential edges (no parallelization)
    .addEdge(START, "round1_reason")
    .addEdge("round1_reason", "round1_search")
    .addEdge("round1_search", "round2_reason")
    .addEdge("round2_reason", "round2_search")
    .addEdge("round2_search", "round3_reason")
    .addEdge("round3_reason", "round3_search")
    .addEdge("round3_search", "synthesize")
    .addEdge("synthesize", END)
    .compile();

  return graph;
}
