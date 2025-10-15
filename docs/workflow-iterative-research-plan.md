# Workflow Iterative Research Implementation Plan

**Date**: October 10, 2025  
**Goal**: Transform the workflow from parallel execution to iterative reasoning-based research, matching the React agent's ChatGPT Deep Research pattern.

---

## Current Architecture Analysis

### Parallelization Points Identified

1. **Orchestrator-Worker Pattern** (`index-orchestrator.ts`)
   - Uses `Send API` to spawn 3-8 parallel workers
   - Each worker executes independently and writes to `workerResults`
   - Workers run `Promise.allSettled` for concurrent task execution

2. **MetaSearch Batching** (`meta-search.ts`)
   - Batches 5-10 queries and executes in parallel within each batch
   - Uses `Promise.allSettled` to run multiple `searchAll` calls concurrently
   - Rate-limited to 5 queries/second (Exa limit)

3. **Search Gateway** (`search-gateway.ts`)
   - Runs Tavily + Exa searches in parallel for each query
   - Uses `Promise.allSettled([searchTavily(...), searchExa(...)])`

4. **QueryPlan** (`query-plan.ts`)
   - Generates all 5-10 queries upfront with no iterative refinement
   - No gap analysis or adaptive query generation

### Why This Needs to Change

**Current Flow (Parallel)**:
```
Goal → Orchestrator Analysis → Task Decomposition → Spawn 3-8 Workers
                                                      ↓
                               Worker 1 (2-4 queries in parallel)
                               Worker 2 (2-4 queries in parallel)
                               Worker 3 (2-4 queries in parallel)
                                                      ↓
                                        All results merge → Synthesize
```

**Problems**:
- No reasoning between queries
- No gap identification
- Quality depends on upfront query planning
- Users see parallel execution, not research thinking
- Hard to adapt based on findings
- Time-efficient but quality-limited

**Desired Flow (Iterative)**:
```
Goal → Round 1 Reasoning (generate 2-3 broad queries)
         ↓
      Round 1 Search (sequential execution)
         ↓
      Round 1 Analysis (identify gaps in findings)
         ↓
      Round 2 Reasoning (generate 3-4 targeted queries based on gaps)
         ↓
      Round 2 Search (sequential, alternating providers)
         ↓
      Round 2 Analysis (identify remaining gaps)
         ↓
      Round 3 Reasoning (generate 2-3 validation queries)
         ↓
      Round 3 Search (sequential validation)
         ↓
      Synthesis (comprehensive report with evidence)
```

**Benefits**:
- Reasoning visible at each round
- Adaptive query generation based on findings
- Gap-driven research (quality over speed)
- Matches ChatGPT Deep Research UX
- Better source diversity (alternating providers)
- More comprehensive evidence gathering

---

## Implementation Strategy

### Phase 1: Create Iterative Research Subgraph

**File**: `src/server/workflows/researcher/graph/subgraphs/research-iterative/index.ts`

This replaces the current research subgraph with a 3-round iterative pattern.

#### State Schema

```typescript
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

// Per-round finding with queries, results, reasoning, and gaps
const FindingSchema = z.object({
  round: z.number(),
  queries: z.array(z.string()),
  results: z.array(z.any()), // UnifiedSearchDoc[]
  reasoning: z.string(),
  gaps: z.array(z.string()),
  metadata: z.object({
    queriesGenerated: z.number(),
    sourcesFound: z.number(),
    providersUsed: z.array(z.enum(["tavily", "exa"])),
  }),
});

export type Finding = z.infer<typeof FindingSchema>;

// Iterative research state (extends ParentStateAnnotation)
export const IterativeResearchStateAnnotation = Annotation.Root({
  ...ParentStateAnnotation.spec, // Inherit all parent state
  
  // New fields for iterative research
  findings: Annotation<Finding[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  
  currentRound: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 1,
  }),
  
  researchComplete: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
});
```

#### Node Structure

**Reasoning Nodes** (3):
- `round1ReasoningNode` - Generate 2-3 broad orientation queries
- `round2ReasoningNode` - Analyze Round 1, identify gaps, generate 3-4 targeted queries
- `round3ReasoningNode` - Identify remaining gaps, generate 2-3 validation queries

**Search Nodes** (3):
- `round1SearchNode` - Execute broad queries sequentially with Tavily
- `round2SearchNode` - Execute targeted queries, alternating Tavily/Exa
- `round3SearchNode` - Execute validation queries with Tavily

**Synthesis Node** (1):
- `synthesisNode` - Analyze all findings, generate comprehensive report with evidence

#### Thought Streaming

All reasoning nodes emit thoughts via `config.writer`:

```typescript
const writer = config.writer;
if (writer) {
  await writer({
    type: "thought",
    round: 1,
    content: "Beginning broad orientation research...",
  });
}
```

Event types:
- `thought` - Reasoning and analysis
- `search` - Query execution
- `read` - Source analysis
- `complete` - Round or final completion

#### Sequential Execution

Unlike the React agent's research-iterative.ts which is a subagent tool, this workflow-level implementation:

1. **Integrates with existing state**: Uses `ParentStateAnnotation` to access `research`, `plan`, `userInputs`
2. **Writes to evidence**: Populates `research.enriched` for downstream writer/synthesizer
3. **Respects workflow patterns**: Follows the planner → research → writer flow
4. **Maintains checkpointing**: All state persists to PostgreSQL

### Phase 2: Update Orchestrator (Remove Worker Pattern)

**File**: `src/server/workflows/researcher/graph/index-orchestrator.ts`

Remove the Send API orchestrator-worker pattern entirely. Replace with direct invocation of iterative research.

**Before (Parallel)**:
```typescript
// Orchestrator decomposes into tasks
.addNode("orchestrator", orchestrator)
// Send API spawns parallel workers
.addConditionalEdges("orchestrator", spawnWorkers, ["researchWorker"])
// Workers write to workerResults
.addNode("researchWorker", researchWorker)
// Continue when all workers complete
.addEdge("researchWorker", "synthesizer")
```

**After (Iterative)**:
```typescript
// Remove orchestrator and researchWorker nodes entirely
// Use iterative research subgraph directly
.addNode("research", buildIterativeResearchSubgraph())
.addEdge("planner", "research")
.addEdge("research", "synthesizer")
```

The orchestrator's task decomposition is no longer needed because iterative research adaptively generates queries based on findings.

### Phase 3: Update State Schema

**File**: `src/server/workflows/researcher/graph/state.ts`

Add fields to `ResearchStateSchema` for iterative tracking:

```typescript
export const ResearchStateSchema = z.object({
  // Existing fields (keep these)
  queries: z.array(z.string()).optional(),
  discovery: z.array(UnifiedSearchDocSchema).optional(),
  selected: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  enriched: z.array(UnifiedSearchDocSchema).optional(),
  chunks: z.array(ChunkSchema).optional(),
  finalSources: z.array(z.string()).optional(),
  
  // New fields for iterative research
  rounds: z.array(z.object({
    round: z.number(),
    queries: z.array(z.string()),
    sourcesFound: z.number(),
    reasoning: z.string(),
    gaps: z.array(z.string()),
  })).optional(),
  
  iterativeComplete: z.boolean().optional(),
});
```

### Phase 4: Sequential Search Execution

**Update**: `meta-search.ts` OR create new `iterative-meta-search.ts`

Instead of batching queries and running Promise.allSettled, execute queries sequentially with delays:

```typescript
// Before (Parallel)
const allResults = await Promise.allSettled(
  batch.map((query) => searchAll({ query, maxResults: 10 }))
);

// After (Sequential)
const allResults = [];
for (const query of queries) {
  await writer?.({ type: "search", content: `Searching: "${query}"` });
  
  const result = await searchAll({ query, maxResults: 8 });
  allResults.push(result);
  
  await writer?.({ type: "read", content: `Reading ${result.length} sources...` });
  
  // Pause between queries (human-like behavior)
  await new Promise((resolve) => setTimeout(resolve, 300));
}
```

### Phase 5: Remove Worker State

**File**: `src/server/workflows/researcher/graph/worker-state.ts`

This file can be deleted or marked deprecated since we're removing the orchestrator-worker pattern.

---

## Detailed Node Implementations

### Round 1: Broad Orientation

**Goal**: Get a comprehensive overview of the topic

```typescript
async function round1ReasoningNode(
  state: IterativeResearchState,
  config: RunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const { userInputs, plan } = state;
  const goal = userInputs.goal;
  const writer = config.writer;
  
  await writer?.({
    type: "thought",
    round: 1,
    content: "Beginning broad orientation research...",
  });
  
  // LLM generates 2-3 broad queries
  const llm = getLLM("generation");
  const prompt = `
You are conducting research on: "${goal}"

Generate 2-3 broad, high-level search queries to establish a comprehensive foundation.
These queries should cover:
1. General overview and definition
2. Current state and recent developments
3. Key stakeholders or organizations involved

Return ONLY a JSON array of query strings.
`;
  
  const response = await llm.invoke([new HumanMessage(prompt)]);
  const queries = extractQueriesFromText(response.content as string);
  
  await writer?.({
    type: "thought",
    round: 1,
    content: `Generated ${queries.length} broad queries to establish research foundation.`,
  });
  
  return {
    currentRound: 1,
    queries, // Write to parent state
  };
}
```

### Round 2: Deep Dive

**Goal**: Fill gaps identified in Round 1 with targeted research

```typescript
async function round2ReasoningNode(
  state: IterativeResearchState,
  config: RunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const writer = config.writer;
  const round1Finding = state.findings.find((f) => f.round === 1);
  
  await writer?.({
    type: "thought",
    round: 2,
    content: "Analyzing Round 1 findings to identify knowledge gaps...",
  });
  
  // LLM analyzes Round 1 findings and identifies gaps
  const llm = getLLM("analysis");
  const prompt = `
You completed Round 1 research with ${round1Finding?.queries.length} queries 
and found ${round1Finding?.results.length} sources.

Round 1 Queries:
${round1Finding?.queries.join("\n")}

Round 1 Gaps Identified:
${round1Finding?.gaps.join("\n")}

Now generate 3-4 targeted queries to fill these gaps. Focus on:
- Specific details missing from Round 1
- Quantitative data (financials, metrics, statistics)
- Technical or operational specifics
- Recent developments or trends

Return ONLY a JSON array of query strings.
`;
  
  const response = await llm.invoke([new HumanMessage(prompt)]);
  const queries = extractQueriesFromText(response.content as string);
  
  await writer?.({
    type: "thought",
    round: 2,
    content: `Identified ${round1Finding?.gaps.length} gaps. Generated ${queries.length} targeted queries for deep dive.`,
  });
  
  return {
    currentRound: 2,
    queries,
  };
}
```

### Round 3: Validation

**Goal**: Validate findings and fill final gaps

```typescript
async function round3ReasoningNode(
  state: IterativeResearchState,
  config: RunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const writer = config.writer;
  const round2Finding = state.findings.find((f) => f.round === 2);
  
  await writer?.({
    type: "thought",
    round: 3,
    content: "Identifying remaining gaps for final validation round...",
  });
  
  // LLM identifies final gaps and generates validation queries
  const llm = getLLM("analysis");
  const prompt = `
You've completed 2 rounds of research:
- Round 1: ${state.findings.find((f) => f.round === 1)?.results.length} sources
- Round 2: ${round2Finding?.results.length} sources

Remaining gaps:
${round2Finding?.gaps.join("\n")}

Generate 2-3 validation queries to:
1. Cross-verify key findings
2. Fill any critical remaining gaps
3. Ensure comprehensive coverage

Return ONLY a JSON array of query strings.
`;
  
  const response = await llm.invoke([new HumanMessage(prompt)]);
  const queries = extractQueriesFromText(response.content as string);
  
  await writer?.({
    type: "thought",
    round: 3,
    content: `Generated ${queries.length} validation queries for final round.`,
  });
  
  return {
    currentRound: 3,
    queries,
  };
}
```

### Synthesis

**Goal**: Create comprehensive evidence-backed report

```typescript
async function synthesisNode(
  state: IterativeResearchState,
  config: RunnableConfig
): Promise<Partial<IterativeResearchState>> {
  const writer = config.writer;
  
  await writer?.({
    type: "thought",
    round: 4,
    content: "Synthesizing all findings into comprehensive report...",
  });
  
  // Collect all sources from all rounds
  const allSources = state.findings.flatMap((f) => f.results);
  const totalSources = allSources.length;
  
  await writer?.({
    type: "thought",
    round: 4,
    content: `Analyzing ${totalSources} sources across ${state.findings.length} research rounds...`,
  });
  
  // LLM synthesizes comprehensive report with evidence
  const llm = getLLM("generation");
  const prompt = `
Research Goal: "${state.userInputs.goal}"

You conducted ${state.findings.length} rounds of iterative research:
${state.findings.map((f) => 
  `Round ${f.round}: ${f.queries.length} queries → ${f.results.length} sources`
).join("\n")}

Total Sources: ${totalSources}

Create a comprehensive, evidence-backed research report (2,000-4,000 words) that:
1. Synthesizes findings across all rounds
2. Provides rigorous citations for all claims
3. Addresses the original research goal thoroughly
4. Highlights key insights and conclusions

Sources:
${allSources.slice(0, 50).map((s, i) => 
  `[${i + 1}] ${s.title} - ${s.url}`
).join("\n")}

Write the full report with inline citations like [1], [2], etc.
`;
  
  const response = await llm.invoke([new HumanMessage(prompt)]);
  const report = response.content as string;
  
  await writer?.({
    type: "complete",
    round: 4,
    content: `Research complete! Generated ${report.split(" ").length}-word report with ${totalSources} sources.`,
  });
  
  return {
    researchComplete: true,
    research: {
      ...state.research,
      enriched: allSources, // Write all sources to enriched for synthesizer
      finalSources: allSources.map((s) => s.url),
    },
  };
}
```

---

## Graph Construction

```typescript
export function buildIterativeResearchSubgraph() {
  const builder = new StateGraph(IterativeResearchStateAnnotation)
    // Round 1: Broad orientation
    .addNode("round1_reasoning", round1ReasoningNode)
    .addNode("round1_search", round1SearchNode)
    
    // Round 2: Deep dive
    .addNode("round2_reasoning", round2ReasoningNode)
    .addNode("round2_search", round2SearchNode)
    
    // Round 3: Validation
    .addNode("round3_reasoning", round3ReasoningNode)
    .addNode("round3_search", round3SearchNode)
    
    // Synthesis
    .addNode("synthesis", synthesisNode)
    
    // Wire sequential flow
    .addEdge(START, "round1_reasoning")
    .addEdge("round1_reasoning", "round1_search")
    .addEdge("round1_search", "round2_reasoning")
    .addEdge("round2_reasoning", "round2_search")
    .addEdge("round2_search", "round3_reasoning")
    .addEdge("round3_reasoning", "round3_search")
    .addEdge("round3_search", "synthesis")
    .addEdge("synthesis", END);
  
  return builder.compile();
}
```

---

## Integration with Existing Workflow

### Updated Parent Graph Flow

**Before**:
```
START → planGate → planner → orchestrator → (Send API spawns workers) → synthesizer → END
```

**After**:
```
START → planGate → planner → iterativeResearch → synthesizer → END
```

### Changes Required

1. **`index-orchestrator.ts`**:
   - Remove `orchestrator` node
   - Remove `researchWorker` node
   - Remove `spawnWorkers` conditional edge
   - Add `iterativeResearch` node (using `buildIterativeResearchSubgraph()`)
   - Wire: `planner → iterativeResearch → synthesizer`

2. **`synthesizer.ts`**:
   - No changes needed! It already reads from `research.enriched`
   - Will receive all sources from iterative research rounds

3. **`writer/synthesize.ts`**:
   - No changes needed! Uses `research.enriched` for evidence

### Backward Compatibility

To maintain both approaches during transition:

```typescript
const RESEARCH_MODE = process.env.RESEARCH_MODE || "iterative"; // or "parallel"

const researchNode = RESEARCH_MODE === "iterative"
  ? buildIterativeResearchSubgraph()
  : buildResearchSubgraph(); // Keep old parallel version

builder.addNode("research", researchNode);
```

---

## Testing Plan

### Unit Tests

1. **Reasoning Nodes**:
   - Test query generation from goal
   - Test gap identification from findings
   - Test prompt construction

2. **Search Nodes**:
   - Test sequential execution (no parallelization)
   - Test provider alternation (Round 2)
   - Test rate limiting delays

3. **Synthesis Node**:
   - Test evidence aggregation across rounds
   - Test report generation with citations

### Integration Tests

1. **Full Workflow**:
   - Start with goal: "Analyze Nvidia's Q2 2024 financial performance"
   - Verify 3 rounds complete sequentially
   - Verify thought streaming events emitted
   - Verify final report has 20-30 sources
   - Compare quality with parallel version

2. **Streaming**:
   - Verify `config.writer` events reach UI
   - Verify round badges display (1, 2, 3, 4)
   - Verify real-time query display

3. **Performance**:
   - Measure time per round
   - Confirm 10-15 minute total time acceptable
   - Validate 60-80 total sources gathered

---

## Migration Path

### Option 1: Replace Entirely (Recommended)

1. Create `research-iterative/` folder with new implementation
2. Update `index-orchestrator.ts` to use iterative subgraph
3. Remove `orchestrator.ts` and `research-worker.ts`
4. Keep `worker-state.ts` deprecated for reference
5. Test thoroughly
6. Deploy

### Option 2: Side-by-Side (Safer)

1. Create `research-iterative/` as new subgraph
2. Add environment variable `RESEARCH_MODE`
3. Conditional node selection in orchestrator
4. Run A/B testing with real users
5. Compare quality metrics
6. Deprecate parallel mode after validation

### Option 3: Gradual Migration

1. Phase 1: Keep orchestrator, but make each worker iterative (3 rounds per task)
2. Phase 2: Reduce to 1 worker, full iterative research
3. Phase 3: Remove orchestrator entirely

---

## Expected Outcomes

### Performance Changes

| Metric | Parallel (Current) | Iterative (New) | Change |
|--------|-------------------|----------------|--------|
| **Time** | 5-7 minutes | 10-15 minutes | +100% ⚠️ |
| **LLM Calls** | 3-5 | 8-10 | +80% |
| **Search Queries** | 10-30 | 8-12 | -40% ✅ |
| **Sources Found** | 50-100 | 60-80 | ~Same |
| **Adaptability** | Low | High ✅ |
| **User Engagement** | Low | High ✅ |
| **Report Quality** | Good | Excellent ✅ |

### Quality Improvements

✅ **Gap-driven research** - Each round addresses specific knowledge gaps  
✅ **Adaptive queries** - Queries informed by previous findings  
✅ **Source diversity** - Alternating providers ensures varied perspectives  
✅ **Transparent reasoning** - Users see research thinking unfold  
✅ **Evidence-first** - Focus on authoritative sources with citations  
✅ **Comprehensive coverage** - Systematic approach ensures thoroughness  

### User Experience

**Before (Parallel)**:
- User sees: "Researching... 45% complete"
- Black box: No insight into research process
- Fast but opaque

**After (Iterative)**:
- User sees:
  - "Beginning broad orientation research..."
  - "Generated 3 broad queries..."
  - "Searching: 'Nvidia Q2 2024 revenue growth'"
  - "Reading 8 sources..."
  - "Analyzing Round 1 findings..."
  - "Identified 4 knowledge gaps..."
  - "Deep diving into financial metrics..."
- Engaging and transparent
- Slower but trustworthy

---

## Next Steps

1. ✅ **Read this document** - Understand the plan
2. **Approve architecture** - Confirm approach is sound
3. **Create iterative research subgraph** - Implement nodes
4. **Update orchestrator** - Remove worker pattern
5. **Update state schema** - Add iterative fields
6. **Test end-to-end** - Validate quality improvements
7. **Deploy** - Roll out iterative research

---

## Open Questions

1. **Should we keep parallel mode as fallback?**
   - Pro: Safety net if iterative has issues
   - Con: Maintenance burden

2. **Should each worker become iterative (gradual) or replace entirely (clean break)?**
   - Gradual: Lower risk, more complex
   - Clean break: Simpler, higher risk

3. **How to handle HITL interrupts in iterative mode?**
   - Option A: Allow interrupts between rounds
   - Option B: Only interrupt before/after full research
   - Option C: Interrupt on every query (too granular)

4. **Should we show round progress in UI?**
   - "Round 1 of 3: Broad Orientation"
   - "Round 2 of 3: Deep Dive"
   - "Round 3 of 3: Validation"

5. **Time budget per round?**
   - Round 1: 3-4 minutes (2-3 queries)
   - Round 2: 4-5 minutes (3-4 queries)
   - Round 3: 3-4 minutes (2-3 queries)
   - Synthesis: 2-3 minutes
   - Total: ~12-16 minutes

---

**Ready to proceed?** Let me know if you'd like me to:
1. Start implementing the iterative research subgraph
2. Create a side-by-side comparison setup
3. Modify the existing research nodes to be sequential first (gradual approach)
