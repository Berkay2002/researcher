# Workflow Iterative Research - Executive Summary

**Date**: October 10, 2025  
**Status**: 📋 **Plan Ready for Review**

---

## Question

> "I want my workflow to have the same 'process' like we implemented in react agent. Is it possible to give the LLMs in the workflow reasoning and iterative researching instead of parallelization?"

## Answer

**Yes, absolutely!** The workflow can be transformed to use the same 3-round iterative reasoning pattern we implemented for the React agent. Here's what needs to change:

---

## Current Workflow Architecture

Your workflow currently uses **3 levels of parallelization**:

### 1. Orchestrator-Worker Pattern
```typescript
// Spawns 3-8 parallel workers via Send API
Goal → Orchestrator → Task Decomposition → Send API spawns workers
                                              ↓
                          Worker 1 (Financial Analysis)
                          Worker 2 (Technical Evaluation)  // All run in parallel
                          Worker 3 (Market Trends)
                                              ↓
                                        Merge results → Synthesize
```

### 2. Query Batching in MetaSearch
```typescript
// Executes 5-10 queries in parallel batches
const batchResults = await Promise.allSettled(
  batch.map((query) => searchAll({ query }))
);
```

### 3. Provider Parallelization in SearchGateway
```typescript
// Runs Tavily + Exa in parallel for each query
await Promise.allSettled([
  searchTavily({ query }),
  searchExa({ query })
]);
```

**Result**: Fast (5-7 minutes) but no reasoning between queries, no gap analysis, black box to users.

---

## Proposed Iterative Architecture

Transform to **ChatGPT Deep Research pattern** with 3 sequential rounds:

### New Flow (Iterative)

```typescript
Goal → Round 1 Reasoning
         ↓
       "Generate 2-3 broad queries for foundation"
         ↓
     Round 1 Search (sequential, Tavily)
         ↓
       "Analyzing 24 sources... Identified 4 gaps: [...]"
         ↓
     Round 2 Reasoning
         ↓
       "Generate 3-4 targeted queries to fill gaps"
         ↓
     Round 2 Search (sequential, alternating Tavily/Exa)
         ↓
       "Deep dive complete. 56 total sources. Remaining gaps: [...]"
         ↓
     Round 3 Reasoning
         ↓
       "Generate 2-3 validation queries"
         ↓
     Round 3 Search (sequential, Tavily)
         ↓
       "Validation complete. 72 total sources."
         ↓
     Synthesis
         ↓
       "Research complete! 3,500-word report with 72 sources."
```

**Result**: Slower (10-15 minutes) but adaptive, transparent, higher quality, engaging UX.

---

## Key Changes Required

### 1. Create New Iterative Research Subgraph

**Location**: `src/server/workflows/researcher/graph/subgraphs/research-iterative/`

Replace the current 5-node research subgraph with a 7-node iterative pattern:

```
Old: QueryPlan → MetaSearch → AssessCandidates → HarvestSelected → DedupRerank

New: Round1Reasoning → Round1Search → 
     Round2Reasoning → Round2Search → 
     Round3Reasoning → Round3Search → 
     Synthesis
```

### 2. Remove Orchestrator-Worker Pattern

**File**: `src/server/workflows/researcher/graph/index-orchestrator.ts`

Remove the Send API parallelization:

```typescript
// Remove these nodes
- .addNode("orchestrator", orchestrator)
- .addNode("researchWorker", researchWorker)
- .addConditionalEdges("orchestrator", spawnWorkers, ["researchWorker"])

// Add this instead
+ .addNode("research", buildIterativeResearchSubgraph())
+ .addEdge("planner", "research")
+ .addEdge("research", "synthesizer")
```

The orchestrator's task decomposition becomes unnecessary because iterative research adaptively generates queries based on findings.

### 3. Update State Schema

**File**: `src/server/workflows/researcher/graph/state.ts`

Add fields to track iterative progress:

```typescript
export const ResearchStateSchema = z.object({
  // ... existing fields ...
  
  // New iterative fields
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

### 4. Sequential Search Execution

Replace parallel `Promise.allSettled` with sequential execution:

```typescript
// OLD (Parallel)
const allResults = await Promise.allSettled(
  batch.map((query) => searchAll({ query, maxResults: 10 }))
);

// NEW (Sequential with thought streaming)
const allResults = [];
for (const query of queries) {
  await writer?.({ type: "search", content: `Searching: "${query}"` });
  
  const result = await searchAll({ query, maxResults: 8 });
  allResults.push(result);
  
  await writer?.({ type: "read", content: `Reading ${result.length} sources...` });
  
  await new Promise((resolve) => setTimeout(resolve, 300)); // Human-like pause
}
```

---

## Implementation Options

### Option 1: Clean Break (Recommended)

**Pros**: 
- Simpler codebase
- Full iterative benefits immediately
- Easier to maintain

**Cons**:
- Higher risk (no fallback)
- Requires thorough testing

**Timeline**: 1-2 days

---

### Option 2: Side-by-Side (Safer)

**Pros**:
- A/B testing possible
- Fallback to parallel if issues
- Compare quality directly

**Cons**:
- More complex (2 implementations)
- Environment variable switching
- Higher maintenance

**Timeline**: 2-3 days

```typescript
const RESEARCH_MODE = process.env.RESEARCH_MODE || "iterative";

const researchNode = RESEARCH_MODE === "iterative"
  ? buildIterativeResearchSubgraph()
  : buildResearchSubgraph(); // Keep old parallel
```

---

### Option 3: Gradual Migration

**Pros**:
- Lowest risk
- Learn iteratively

**Cons**:
- Most complex
- Longest timeline

**Phases**:
1. Keep orchestrator, make each worker 3-round iterative
2. Reduce to 1 worker with full iterative research
3. Remove orchestrator entirely

**Timeline**: 3-4 days

---

## Expected Performance

| Metric | Parallel (Current) | Iterative (New) | Change |
|--------|-------------------|----------------|--------|
| **Time** | 5-7 minutes | 10-15 minutes | +100% |
| **LLM Calls** | 3-5 | 8-10 | +80% |
| **Search Queries** | 10-30 (fixed) | 8-12 (adaptive) | -40% ✅ |
| **Sources** | 50-100 | 60-80 | Similar |
| **Adaptability** | None | High ✅ |
| **Transparency** | None | Full ✅ |
| **Quality** | Good | Excellent ✅ |

### Quality Improvements

✅ **Gap-driven research** - Each round addresses specific knowledge gaps  
✅ **Adaptive queries** - Informed by previous findings  
✅ **Source diversity** - Alternating providers (Tavily/Exa)  
✅ **Transparent reasoning** - Users see research thinking  
✅ **Evidence-first** - Focus on authoritative sources  
✅ **Comprehensive** - Systematic approach ensures thoroughness  

---

## User Experience Comparison

### Before (Parallel)
```
User: "Analyze Nvidia's Q2 2024 financial performance"

System: "Researching... 45% complete"
[Black box - no visibility into process]

5 minutes later...

System: "Here's your 2,500-word report with 45 sources"
```

**Pros**: Fast  
**Cons**: Opaque, no trust-building, feels automated

---

### After (Iterative)
```
User: "Analyze Nvidia's Q2 2024 financial performance"

System: 
"Beginning broad orientation research..."
"Generated 3 broad queries to establish foundation"
"Searching: 'Nvidia Q2 2024 revenue growth'"
"Reading 8 sources..."
"Searching: 'Nvidia data center business performance'"
"Reading 8 sources..."

[Round 1 complete - 24 sources]

"Analyzing Round 1 findings..."
"Identified 4 knowledge gaps: detailed financial metrics, market share, ..."
"Generating 4 targeted queries for deep dive"
"Searching: 'Nvidia Q2 2024 operating margin and profit breakdown'"
"Reading 8 sources..."

[Round 2 complete - 56 total sources]

"Validation round: cross-referencing key findings..."
"Searching: 'Nvidia Q2 2024 official earnings report'"
"Reading 8 sources..."

[Round 3 complete - 72 total sources]

"Synthesizing all findings into comprehensive report..."
"Research complete! 3,500-word report with 72 sources."

12 minutes later...

System: "Here's your comprehensive report"
```

**Pros**: Transparent, engaging, trustworthy, higher quality  
**Cons**: Slower (but user said time isn't priority!)

---

## What You Get

### Same Pattern as React Agent

✅ **3-round sequential research** (Round 1: Broad → Round 2: Deep Dive → Round 3: Validation)  
✅ **Reasoning between rounds** (LLM analyzes findings, identifies gaps)  
✅ **Adaptive query generation** (Queries informed by previous findings)  
✅ **Thought streaming** (`config.writer` for real-time updates)  
✅ **Sequential execution** (No parallelization, human-like research)  
✅ **Provider alternation** (Round 2 alternates Tavily/Exa)  
✅ **Official LangGraph patterns** (No custom code, only framework features)  

### Workflow-Specific Enhancements

✅ **Integration with planner** (Respects constraints, deliverables)  
✅ **Evidence accumulation** (Writes to `research.enriched` for synthesizer)  
✅ **PostgreSQL checkpointing** (All rounds persist automatically)  
✅ **HITL compatibility** (Can interrupt between rounds if needed)  
✅ **Existing synthesizer works** (No changes to writer/quality nodes)  

---

## Recommended Next Steps

### 1. Review the Plan
Read the full implementation plan: `docs/workflow-iterative-research-plan.md`

### 2. Choose Implementation Option
- **Option 1 (Clean Break)** - If you want simplicity and are confident
- **Option 2 (Side-by-Side)** - If you want to A/B test quality
- **Option 3 (Gradual)** - If you want lowest risk

### 3. Approve and Implement
I can implement any of these options. Just let me know which you prefer!

### 4. Test and Compare
Run same queries through both systems, compare:
- Time to completion
- Number of sources
- Source quality
- Report depth
- User engagement

---

## Files to Create/Modify

### Create New
1. `src/server/workflows/researcher/graph/subgraphs/research-iterative/index.ts` - Main iterative graph
2. `src/server/workflows/researcher/graph/subgraphs/research-iterative/nodes/reasoning.ts` - 3 reasoning nodes
3. `src/server/workflows/researcher/graph/subgraphs/research-iterative/nodes/search.ts` - 3 search nodes
4. `src/server/workflows/researcher/graph/subgraphs/research-iterative/nodes/synthesis.ts` - Final synthesis
5. `src/server/workflows/researcher/graph/subgraphs/research-iterative/state.ts` - Iterative state schema

### Modify Existing
1. `src/server/workflows/researcher/graph/index-orchestrator.ts` - Remove worker pattern, add iterative research
2. `src/server/workflows/researcher/graph/state.ts` - Add iterative fields to ResearchStateSchema

### Deprecate/Remove (Option 1)
1. `src/server/workflows/researcher/graph/nodes/orchestrator.ts` - No longer needed
2. `src/server/workflows/researcher/graph/nodes/research-worker.ts` - No longer needed
3. `src/server/workflows/researcher/graph/worker-state.ts` - No longer needed

---

## Open Questions for You

1. **Which implementation option do you prefer?** (Clean break, Side-by-Side, or Gradual)

2. **Is 10-15 minutes acceptable?** (You said time isn't priority, just confirming)

3. **Should we keep parallel mode as environment variable fallback?** (Safety vs simplicity)

4. **Do you want round progress in UI?** ("Round 1 of 3: Broad Orientation")

5. **Should we allow HITL interrupts between rounds?** (Could pause after Round 1 for user input)

---

## My Recommendation

**Option 1: Clean Break** with full iterative implementation.

**Why**:
- You explicitly said "time isn't a priority"
- Quality over quantity matches your goals
- React agent pattern already proven
- Cleaner codebase, easier to maintain
- ChatGPT Deep Research validates the approach

**Timeline**: 1-2 days

**Risk**: Low (pattern already validated in React agent)

---

**Ready to implement?** Let me know:
1. Which option you prefer
2. Any specific concerns or requirements
3. Whether you want me to start with the iterative research subgraph first (modular approach)

I have all the context and can start immediately! 🚀
