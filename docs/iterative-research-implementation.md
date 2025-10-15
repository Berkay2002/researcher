# Iterative Research Implementation Plan
## Moving from Parallel to Sequential Reasoning (ChatGPT Deep Research Pattern)

**Date**: October 10, 2025  
**Goal**: Transform research from parallel batch processing to iterative reasoning chains using official LangChain/LangGraph features

---

## Official LangGraph/LangChain Features We'll Use

Based on official documentation review:

### 1. **Streaming Modes** (`documentation/langgraph/09-streaming.md`)
- `streamMode: "messages"` - Stream LLM tokens in real-time
- `streamMode: "custom"` - Stream custom reasoning/progress updates
- `streamMode: "updates"` - Stream state updates after each node
- **Multiple modes**: `["updates", "messages", "custom"]`

### 2. **State Management** (`documentation/langchain/06-short-term-memory.md`)
- Messages array for conversation history
- Custom state fields for tracking research progress
- State updates accumulate findings across iterations

### 3. **Prompt Chaining** (`documentation/langgraph/03-workflow-and-agents.md`)
- Sequential LLM calls where each processes previous output
- Conditional routing based on reasoning
- State flows through nodes in sequence

### 4. **ReAct Agent Pattern** (`documentation/langchain/02-agents.md`)
- `thought` → `action` → `observation` loop
- Agent reasons about findings, then decides next action
- Iterates until completion condition

### 5. **Config.writer for Custom Streaming** (`documentation/langgraph/09-streaming.md`)
```typescript
config.writer({ type: "thought", content: "I'm analyzing..." });
```

---

## Architecture Changes

### Current (Parallel)
```
User Query
    ↓
Generate 5-10 queries (all at once)
    ↓
Execute all searches in parallel/batch
    ↓
Synthesize all results at end
    ↓
Return report
```

### New (Iterative/Sequential)
```
User Query
    ↓
Round 1: Broad Orientation (Reasoning Node)
    ├─> Generate 2-3 broad queries
    ├─> Execute searches sequentially
    ├─> Read & reason about findings
    ├─> Emit thoughts: "I'm gathering overview..."
    ↓
Round 2: Deep Dive (Reasoning Node)
    ├─> Analyze gaps from Round 1
    ├─> Generate 3-4 specific queries
    ├─> Execute searches sequentially
    ├─> Emit thoughts: "Now examining X dimension..."
    ↓
Round 3: Gap Filling (Reasoning Node)
    ├─> Identify missing information
    ├─> Generate 2-3 refinement queries
    ├─> Execute searches sequentially
    ├─> Emit thoughts: "Validating claims..."
    ↓
Synthesis (Final Reasoning)
    ├─> Compile comprehensive report
    ├─> Extract structured claims
    ├─> Return final output
```

---

## Implementation Using LangGraph StateGraph

### State Schema

```typescript
import { z } from "zod";
import { Annotation } from "@langchain/langgraph";

const ResearchStateAnnotation = Annotation.Root({
  // Input
  query: Annotation<string>,
  
  // Research rounds
  currentRound: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 1
  }),
  
  // Accumulated findings across rounds
  findings: Annotation<Array<{
    round: number;
    query: string;
    results: any[];
    reasoning: string;
  }>>({
    reducer: (x, y) => [...x, ...y],
    default: () => []
  }),
  
  // Messages for LLM conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  
  // Search runs metadata
  searchRuns: Annotation<SearchRunMetadata[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => []
  }),
  
  // Final output
  report: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
  }),
  
  claims: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
  })
});
```

### Graph Structure

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";

const graph = new StateGraph(ResearchStateAnnotation)
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
  
  // Edges
  .addEdge(START, "round1_reason")
  .addEdge("round1_reason", "round1_search")
  .addEdge("round1_search", "round2_reason")
  .addEdge("round2_reason", "round2_search")
  .addEdge("round2_search", "round3_reason")
  .addEdge("round3_reason", "round3_search")
  .addEdge("round3_search", "synthesize")
  .addEdge("synthesize", END)
  .compile();
```

---

## Node Implementations

### 1. Reasoning Nodes (Emit Thoughts)

```typescript
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

async function round1ReasoningNode(
  state: typeof ResearchStateAnnotation.State,
  config: LangGraphRunnableConfig
) {
  const currentDate = getCurrentDateString();
  
  // Emit thought using custom stream
  config.writer({
    type: "thought",
    content: "I'm beginning broad research to understand the landscape...",
    round: 1
  });
  
  // Generate queries using LLM reasoning
  const llm = getLLM("generation");
  const prompt = `**CURRENT DATE: ${currentDate}**

You are conducting Round 1 of deep research on: "${state.query}"

ROUND 1 OBJECTIVE: Broad Orientation
- Generate 2-3 broad, high-level queries to understand the landscape
- Target official sources, major news outlets, and overview articles
- Focus on establishing context and identifying key dimensions

Think step-by-step about what information you need first.

Output ONLY a JSON array of 2-3 query strings:
["query 1", "query 2", "query 3"]`;

  config.writer({
    type: "thought",
    content: "Analyzing the research goal to identify key dimensions...",
    round: 1
  });

  const response = await llm.invoke([new HumanMessage(prompt)]);
  let queries: string[];
  
  try {
    queries = JSON.parse(response.content as string);
  } catch {
    // Fallback parsing
    queries = extractQueriesFromText(response.content as string);
  }
  
  config.writer({
    type: "thought",
    content: `Generated ${queries.length} broad queries: ${queries.join(", ")}`,
    round: 1
  });
  
  return {
    currentRound: 1,
    messages: [
      new HumanMessage(prompt),
      new AIMessage(JSON.stringify({ queries, reasoning: "Round 1 queries for broad orientation" }))
    ],
    findings: [{
      round: 1,
      query: state.query,
      results: [],
      reasoning: `Round 1: Generated ${queries.length} broad queries to establish context`,
      queries
    }]
  };
}
```

### 2. Search Nodes (Sequential Execution)

```typescript
async function round1SearchNode(
  state: typeof ResearchStateAnnotation.State,
  config: LangGraphRunnableConfig
) {
  const currentFinding = state.findings[state.findings.length - 1];
  const queries = currentFinding.queries || [];
  
  const allResults: any[] = [];
  const searchRuns: SearchRunMetadata[] = [];
  
  // Execute searches SEQUENTIALLY (not parallel)
  for (const query of queries) {
    config.writer({
      type: "search",
      content: `Searching for: "${query}"`,
      round: 1
    });
    
    // Use Tavily for news/recent content
    const tavilyResults = await tavilySearch(query, { maxResults: 8 });
    
    config.writer({
      type: "thought",
      content: `Found ${tavilyResults.length} results. Reading top sources...`,
      round: 1
    });
    
    allResults.push(...tavilyResults);
    
    searchRuns.push({
      query,
      provider: "tavily",
      resultsCount: tavilyResults.length,
      timestamp: new Date().toISOString()
    });
    
    // Brief pause to simulate reading/processing (ChatGPT does this)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Now reason about findings
  config.writer({
    type: "thought",
    content: `Reviewed ${allResults.length} sources. Key findings: [summarize top insights]`,
    round: 1
  });
  
  return {
    findings: [{
      round: 1,
      query: state.query,
      results: allResults,
      reasoning: `Gathered ${allResults.length} sources from broad queries`
    }],
    searchRuns
  };
}
```

### 3. Gap Analysis Between Rounds

```typescript
async function round2ReasoningNode(
  state: typeof ResearchStateAnnotation.State,
  config: LangGraphRunnableConfig
) {
  const currentDate = getCurrentDateString();
  const round1Findings = state.findings.filter(f => f.round === 1);
  
  config.writer({
    type: "thought",
    content: "Analyzing Round 1 findings to identify gaps and specific areas to explore...",
    round: 2
  });
  
  // Analyze gaps using LLM
  const llm = getLLM("generation");
  const prompt = `**CURRENT DATE: ${currentDate}**

ROUND 1 SUMMARY:
${JSON.stringify(round1Findings, null, 2)}

ROUND 2 OBJECTIVE: Deep Dive
Based on Round 1, identify 2-3 specific dimensions that need deeper investigation:
- Financial details, competitive analysis, technical specifications, regulatory context, etc.
- Target: Detailed analysis, research reports, expert opinions
- Focus on filling knowledge gaps from Round 1

Generate 3-4 targeted queries for deep investigation.

Output format:
{
  "gaps_identified": ["gap 1", "gap 2"],
  "queries": ["query 1", "query 2", "query 3", "query 4"]
}`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const analysis = JSON.parse(response.content as string);
  
  config.writer({
    type: "thought",
    content: `Identified gaps: ${analysis.gaps_identified.join(", ")}. Deep diving into these areas...`,
    round: 2
  });
  
  return {
    currentRound: 2,
    messages: [
      new HumanMessage(prompt),
      new AIMessage(JSON.stringify(analysis))
    ],
    findings: [{
      round: 2,
      query: state.query,
      results: [],
      reasoning: `Round 2: Identified ${analysis.gaps_identified.length} gaps, generated ${analysis.queries.length} targeted queries`,
      queries: analysis.queries,
      gaps: analysis.gaps_identified
    }]
  };
}
```

### 4. Final Synthesis with Structured Output

```typescript
async function synthesizeNode(
  state: typeof ResearchStateAnnotation.State,
  config: LangGraphRunnableConfig
) {
  config.writer({
    type: "thought",
    content: "Synthesizing all findings into comprehensive report...",
    round: 4
  });
  
  const llm = getLLM("generation");
  
  // Use toolStrategy for structured output (Gemini compatible)
  const ResearchOutputSchema = z.object({
    report: z.string().describe("Complete markdown report with [Source X] citations"),
    claims: z.array(ClaimSchema).describe("Key factual claims with citations"),
    sourcesUsed: z.number(),
    wordCount: z.number()
  });
  
  const structuredLLM = llm.withStructuredOutput(ResearchOutputSchema);
  
  const allFindings = state.findings;
  const allSources = allFindings.flatMap(f => f.results);
  
  const prompt = `**CURRENT DATE: ${getCurrentDateString()}**

You've completed 3 rounds of research. Synthesize everything into a comprehensive report.

RESEARCH ROUNDS:
${JSON.stringify(allFindings, null, 2)}

TOTAL SOURCES: ${allSources.length}

Create a comprehensive report (2,000-4,000 words) with:
1. Executive summary
2. Detailed analysis by dimension
3. Inline [Source X] citations
4. Key insights
5. References section (APA format)

Extract 10-20 key claims with confidence levels.`;

  config.writer({
    type: "thought",
    content: "Writing comprehensive report with structured claims...",
    round: 4
  });

  const output = await structuredLLM.invoke([new HumanMessage(prompt)]);
  
  config.writer({
    type: "complete",
    content: `Research complete! Generated ${output.wordCount} word report with ${output.sourcesUsed} sources.`,
    round: 4
  });
  
  return {
    report: output.report,
    claims: output.claims
  };
}
```

---

## Streaming Configuration

```typescript
// When invoking the graph
for await (const chunk of await graph.stream(
  { query: "Give me an in-depth analysis of Nvidia" },
  {
    streamMode: ["updates", "custom", "messages"],
    configurable: { thread_id: "research-123" }
  }
)) {
  const [mode, data] = chunk;
  
  if (mode === "custom") {
    // Thought streaming: "I'm analyzing...", "Searching for..."
    console.log(`[${data.type}] ${data.content}`);
  } else if (mode === "messages") {
    // LLM token streaming
    process.stdout.write(data[0].content);
  } else if (mode === "updates") {
    // State updates after each node
    console.log("Node completed:", Object.keys(data)[0]);
  }
}
```

---

## Key Differences from Current Implementation

| Aspect | Current (Parallel) | New (Iterative) |
|--------|-------------------|-----------------|
| **Query Generation** | All 5-10 upfront | 2-4 per round, adaptive |
| **Search Execution** | Parallel batch | Sequential per query |
| **Reasoning** | Only at end | After each round |
| **Gap Analysis** | None | Between rounds |
| **Thought Streaming** | No | Yes via `config.writer()` |
| **LLM Calls** | 1-2 total | 4-6 (one per round + synthesis) |
| **Adaptation** | None | Learns from each round |
| **User Feedback** | Only progress % | Real-time thoughts |
| **Time** | Faster (5-7 min) | Slower (8-12 min) |
| **Quality** | Good | Better (adaptive) |

---

## Benefits of Iterative Approach

### 1. **Better Quality** (Your Priority ✅)
- Adapts queries based on what's been learned
- Fills specific gaps identified in previous rounds
- More targeted, less redundant searches

### 2. **Transparency**
- Users see the reasoning process
- "I'm analyzing financial data..."
- "Now examining competitive landscape..."
- Builds trust and engagement

### 3. **Efficiency** (Paradoxically)
- Fewer wasted searches on irrelevant topics
- More focused on identified gaps
- Better source selection

### 4. **Flexibility**
- Can adjust strategy mid-research
- Can decide to do 4 rounds if needed
- Or stop at 2 if sufficient

---

## Next Steps

1. **Create new research subgraph structure** with round-based nodes
2. **Implement reasoning nodes** with thought streaming
3. **Modify search nodes** for sequential execution
4. **Add gap analysis** between rounds
5. **Update UI** to display thoughts in real-time
6. **Test with Nvidia query** to compare with ChatGPT

Would you like me to proceed with implementing this architecture?
