# Orchestrator-Worker Research Workflow

## Overview

This document describes the **Orchestrator-Worker** pattern implementation for the researcher workflow, following LangGraph 1.0-alpha best practices and the patterns documented in `documentation/langgraph/03-workflow-and-agents.md`.

## Architecture

### High-Level Flow

```
START 
  ↓
planGate (evaluate complexity)
  ↓
planner (HITL or auto)
  ↓
orchestrator (decompose into tasks)
  ↓
[Parallel Workers via Send API]
  ↓
synthesizer (aggregate results)
  ↓
redteam (quality gate)
  ↓
END
```

### Key Components

#### 1. **Orchestrator Node** (`nodes/orchestrator.ts`)

The orchestrator is responsible for:
- **Analyzing** the research goal using structured LLM outputs
- **Decomposing** the goal into 3-8 parallel research tasks
- **Assigning** focused queries to each task
- **Storing** tasks in state for the router

**Structured Outputs:**
- `OrchestrationAnalysis`: Analyzes complexity, domains, and aspects
- `TaskDecomposition`: Creates parallel task assignments

**Example Task Decomposition:**
```typescript
{
  tasks: [
    {
      id: "task-1",
      aspect: "Financial Analysis",
      queries: ["AI scaling laws cost analysis", "LLM training economics"],
      priority: 0.9
    },
    {
      id: "task-2", 
      aspect: "Technical Architecture",
      queries: ["transformer architecture evolution", "attention mechanisms"],
      priority: 0.8
    },
    // ... more tasks
  ],
  reasoning: "Decomposed into financial, technical, and market aspects"
}
```

#### 2. **Worker Nodes** (`nodes/research-worker.ts`)

Each worker executes independently:
1. **Search**: Execute assigned queries (respecting rate limits)
2. **Assess**: Score and rank candidate documents
3. **Select**: Choose top documents for detailed analysis
4. **Harvest**: Fetch full content (simulated in current implementation)
5. **Report**: Write results to shared `workerResults` state key

**Worker State:**
```typescript
{
  task: ResearchTask,           // Input from orchestrator
  discoveredDocs: [...],         // Phase A: Discovery
  selectedDocIds: [...],         // Phase B: Selection
  enrichedDocs: [...],          // Phase C: Enrichment
  workerResults: [{             // Phase D: Output to shared state
    taskId: "task-1",
    aspect: "Financial Analysis",
    documents: [...],
    summary: "Found 5 documents...",
    confidence: 0.75,
    queriesExecuted: 3,
    documentsFound: 25,
    documentsSelected: 5
  }]
}
```

#### 3. **Router Function** (in `index-orchestrator.ts`)

The router implements the **Send API** pattern:

```typescript
function spawnWorkers(state: ParentState): Send[] {
  const tasks = state.planning.tasks;
  
  // Create a Send command for each task
  return tasks.map((task) => 
    new Send("researchWorker", { task })
  );
}
```

**Send API Behavior:**
- Each `Send` creates a new worker node instance
- Workers execute **in parallel**
- Each worker has its own state (scoped to the task)
- All workers write to the **shared** `workerResults` key in parent state
- Parent graph waits for **all workers** to complete before continuing

#### 4. **Synthesizer Node** (`nodes/synthesizer.ts`)

The synthesizer aggregates all worker results:
1. **Collect**: Gather results from all workers (from `workerResults` key)
2. **Deduplicate**: Remove duplicate documents by URL
3. **Rank**: Score documents by quality, recency, and worker confidence
4. **Select**: Choose top documents for final report
5. **Generate**: Use LLM to create comprehensive report with citations
6. **Calculate**: Compute overall confidence score

**Confidence Calculation:**
```typescript
confidence = BASE_CONFIDENCE 
  + (worker_diversity * 0.2)      // Did we get results from multiple aspects?
  + (avg_worker_confidence * 0.3) // How confident were the workers?
  + (citation_density * 0.2)      // Did we use the sources?
```

## State Management

### Parent State Schema

```typescript
ParentStateAnnotation = {
  threadId: string,                    // Required for checkpointing
  userInputs: UserInputs,              // Goal and configuration
  plan: Plan | null,                   // Research plan from planner
  planning: PlanningSession | null,    // Cache for tasks
  queries: string[],                   // All queries (accumulated)
  
  // Orchestrator-Worker pattern keys
  workerResults: WorkerResult[],       // SHARED state key for workers
  
  research: ResearchState | null,      // Legacy compatibility
  evidence: Evidence[],                // Legacy compatibility
  draft: Draft | null,                 // Final report
  issues: string[],                    // Validation issues
}
```

### Worker State Schema

```typescript
WorkerStateAnnotation = {
  task: ResearchTask,                  // Input from orchestrator
  discoveredDocs: UnifiedSearchDoc[],  // Search results
  selectedDocIds: string[],            // Selected for enrichment
  enrichedDocs: UnifiedSearchDoc[],    // With full content
  
  // This is written to parent's shared 'workerResults' key
  workerResults: WorkerResult[],       
  
  status: "pending" | "running" | "completed" | "failed",
  error: string | null,
}
```

### State Reducers

Following LangGraph 1.0-alpha patterns:

```typescript
// Accumulate worker results from all parallel workers
workerResults: Annotation<WorkerResult[]>({
  reducer: (prev, next) => [...(prev ?? []), ...next],
  default: () => [],
})

// Accumulate queries from orchestrator
queries: Annotation<string[]>({
  reducer: (prev, next) => [...(prev ?? []), ...next],
  default: () => [],
})

// Replace entire draft when updated
draft: Annotation<Draft | null>({
  reducer: (_, next) => next,
  default: () => null,
})
```

## Benefits of Orchestrator-Worker Pattern

### 1. **Parallelization**
- Research tasks execute **simultaneously**
- Reduces total execution time significantly
- Better utilization of API rate limits

### 2. **Scalability**
- Easy to adjust worker count (MIN_WORKERS to MAX_WORKERS)
- Each worker is independent and stateless
- No shared mutable state between workers

### 3. **Flexibility**
- Tasks are **dynamically generated** based on goal complexity
- LLM determines optimal decomposition strategy
- Can handle simple to complex research goals

### 4. **Observability**
- Each worker execution is visible in LangSmith traces
- Easy to debug individual worker failures
- Clear parent-child relationships in traces

### 5. **Fault Tolerance**
- Worker failures don't block other workers
- Synthesis can proceed with partial results
- Confidence scoring reflects result quality

## Comparison with Old Architecture

### Old Architecture (Sequential)
```
START → planGate → planner → queryPlan → metaSearch 
  → assessCandidates → harvestSelected → dedupRerank 
  → synthesize → redteam → END
```

**Characteristics:**
- ❌ Sequential execution (slow)
- ❌ Fixed search strategy
- ❌ All queries in one batch
- ✅ Simple and predictable

### New Architecture (Orchestrator-Worker)
```
START → planGate → planner → orchestrator 
  → [Worker 1, Worker 2, Worker 3, ...] (parallel)
  → synthesizer → redteam → END
```

**Characteristics:**
- ✅ Parallel execution (fast)
- ✅ Dynamic task decomposition
- ✅ Aspect-specific queries
- ✅ Scalable worker count
- ✅ Better LLM-driven strategy

## Testing with LangSmith

### Local Testing

1. **Start LangGraph Dev Server:**
   ```bash
   langgraph dev
   ```

2. **Open LangGraph Studio:**
   - Navigate to `http://localhost:3000` (or shown URL)
   - Select `researcher-orchestrator` workflow

3. **Invoke with Test Input:**
   ```json
   {
     "threadId": "test-123",
     "userInputs": {
       "goal": "What are the latest developments in AI agents?",
       "modeOverride": "auto"
     }
   }
   ```

4. **Observe in LangSmith:**
   - Set `LANGCHAIN_TRACING_V2=true` in `.env.local`
   - Check LangSmith dashboard for traces
   - Look for parallel worker execution
   - Verify all workers complete before synthesis

### Test Script

Run the included test script:
```bash
npx tsx scripts/test-orchestrator-workflow.ts
```

This will:
- Compile and validate the graph
- Invoke with a test goal
- Display worker results
- Show final report preview
- Provide LangSmith trace link

## Configuration

### Environment Variables

Required in `.env.local`:
```bash
# LLM Provider
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key  # For OpenAI SDK compatibility

# Search APIs
TAVILY_API_KEY=your_key
EXA_API_KEY=your_key

# Database for checkpointing
DATABASE_URL=postgresql://...

# LangSmith tracing (optional)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=researcher-orchestrator
```

### Tuning Parameters

In `nodes/orchestrator.ts`:
```typescript
const MIN_WORKERS = 3;        // Minimum parallel workers
const MAX_WORKERS = 8;        // Maximum parallel workers
const QUERIES_PER_TASK = 2;   // Queries per aspect
```

In `nodes/research-worker.ts`:
```typescript
const TOP_DOCUMENTS_TO_SELECT = 5;  // Docs per worker
const MAX_RESULTS_PER_QUERY = 10;   // Search results per query
```

In `nodes/synthesizer.ts`:
```typescript
const MAX_SOURCES_FOR_SYNTHESIS = 20;  // Max docs in final report
```

## Migration Guide

### From Old Workflow

1. **Update imports:**
   ```typescript
   // Old
   import { getGraph } from "@/server/workflows/researcher/graph";
   
   // New
   import { getGraph } from "@/server/workflows/researcher/graph/index-orchestrator";
   ```

2. **Update invocation:**
   ```typescript
   // Same invocation pattern - no changes needed!
   const result = await graph.invoke(
     { threadId, userInputs: { goal, modeOverride: "auto" } },
     { configurable: { thread_id: threadId } }
   );
   ```

3. **Access results:**
   ```typescript
   // Old
   result.evidence  // Array of Evidence
   
   // New  
   result.workerResults  // Array of WorkerResult
   result.draft.citations  // Citations extracted from report
   ```

### Gradual Migration

Both workflows can coexist:
- `researcher` (old): Sequential workflow
- `researcher-orchestrator` (new): Orchestrator-Worker workflow

Test the new workflow in parallel, then switch when ready.

## Troubleshooting

### Workers Not Spawning

**Symptom:** No worker results in output

**Check:**
1. Orchestrator completing successfully?
2. Tasks being created and stored in `planning.tasks`?
3. Router function returning Send commands?

**Debug:**
```typescript
console.log("Tasks:", state.planning.tasks);
console.log("Send commands:", spawnWorkers(state));
```

### Worker Failures

**Symptom:** Some workers fail, others succeed

**Check:**
1. API rate limits (Exa: 5 req/sec, Tavily: varies)
2. Network timeouts
3. Invalid queries

**Solution:**
- Workers are independent - synthesis proceeds with available results
- Check `workerResult.status === "failed"`
- Review error messages in `workerResult.error`

### Low Confidence Scores

**Symptom:** `draft.confidence < 0.5`

**Possible causes:**
1. Few workers completed successfully
2. Low document quality/relevance
3. Poor citation density

**Improve:**
- Adjust `TOP_DOCUMENTS_TO_SELECT` in worker
- Tune relevance scoring weights
- Improve synthesis prompt

## Next Steps

1. ✅ **Test locally** with LangSmith tracing
2. ⬜ **Tune parameters** based on test results
3. ⬜ **Add more sophisticated** worker strategies
4. ⬜ **Implement content harvesting** (currently simulated)
5. ⬜ **Add worker retry logic** for failed tasks
6. ⬜ **Optimize LLM costs** (use Flash for workers, Pro for orchestrator)

## Resources

- **LangGraph Documentation:** `documentation/langgraph/03-workflow-and-agents.md`
- **Send API Example:** See "Creating workers in LangGraph" section
- **State Management:** `documentation/langgraph/06-short-term-memory.md`
- **LangSmith Tracing:** `docs/langsmith-tracing.md`
