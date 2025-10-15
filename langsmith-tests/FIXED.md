# LangSmith Test Inputs - FIXED

## Issue Resolved

**Error:** `{"message":"Cannot read properties of undefined (reading 'length')","name":"TypeError"}` at `iterativeResearch`

**Root Cause:** The iterative research subgraph uses its own state schema (`IterativeResearchStateAnnotation`) which is different from the parent state (`ParentStateAnnotation`). When the parent graph invoked the subgraph, it passed `ParentState` but the subgraph nodes expected fields like `currentQueries`, `goal`, `constraints` which don't exist in `ParentState`.

**Solution:** Added an `initialize` node at the start of the iterative research subgraph that transforms incoming parent state into the proper `IterativeResearchState` format.

## Changes Made

### 1. Added Initialization Node (`research-iterative/index.ts`)
```typescript
function initializeIterativeState(state: Record<string, unknown>) {
  return {
    goal: userInputs?.goal || "",
    constraints: plan?.constraints || {},
    findings: [],
    currentRound: 1,
    allSources: [],
    researchComplete: false,
    currentQueries: [],
  };
}
```

### 2. Updated Graph Flow
```
OLD: START → round1_reasoning → ...
NEW: START → initialize → round1_reasoning → ...
```

### 3. Added Safety Checks in Search Nodes
```typescript
const { currentQueries = [], constraints = {} } = state;

if (currentQueries.length === 0) {
  console.warn("[Round1 Search] No queries provided, skipping search");
  return { findings: [] };
}
```

### 4. Fixed Reasoning Nodes Return Values
Changed from returning `queries` (which doesn't exist in schema) to returning `currentQueries`:
```typescript
return {
  currentQueries: queries,  // ✅ Correct field name
  currentRound: 1,
};
```

## Testing in LangSmith

You can now use the test inputs in `langsmith-tests/` directory:

### For Orchestrator Graph (`researcher-orchestrator`)
```bash
# Use files in langsmith-tests/orchestrator/
langsmith-tests/orchestrator/tier-a-1-blackwell.json
```

### For ReAct Graph (`react-agent`)
```bash
# Use files in langsmith-tests/react/
langsmith-tests/react/tier-a-1-blackwell.json
```

## How to Test

### Option 1: LangGraph Studio (Local)

1. Open LangGraph Studio
2. Select graph: `researcher-orchestrator`
3. Paste JSON from `langsmith-tests/orchestrator/tier-a-1-blackwell.json`:
   ```json
   {
     "threadId": "test-blackwell-vs-hopper-001",
     "userInputs": {
       "goal": "Summarize current public inference performance...",
       "modeOverride": "auto"
     }
   }
   ```
4. In Config, add:
   ```json
   {
     "configurable": {
       "thread_id": "test-blackwell-vs-hopper-001"
     }
   }
   ```
5. Click Submit

### Option 2: LangSmith UI

1. Go to LangSmith → Playground
2. Select your deployed graph
3. Copy/paste the JSON input
4. Run and view trace

## Test Files Available

All 9 test prompts are available as individual JSON files:

**Tier A (Focused Synthesis)**
- `tier-a-1-blackwell.json` - GPU inference benchmarks
- `tier-a-2-eu-ai-act.json` - EU AI Act compliance
- `tier-a-3-c2pa.json` - Content credentials feasibility

**Tier B (Multi-source Synthesis)**
- `tier-b-4-export-controls.json` - China AI compute regulations  
- `tier-b-5-hbm-supply.json` - HBM supply chain analysis
- `tier-b-6-rag-eval.json` - RAG framework comparison

**Tier C (Exploratory Research)**
- `tier-c-7-nordic-grid.json` - Nordic grid capacity  
- `tier-c-8-agent-security.json` - OWASP LLM Top-10 audit
- `tier-c-9-benchmarks.json` - MLPerf to production gap analysis

## Expected Behavior

The orchestrator workflow should now:

1. ✅ Pass through `planGate` 
2. ✅ Execute `planner` (with optional HITL if mode=plan)
3. ✅ Initialize iterative research state properly
4. ✅ Execute 3 rounds of research:
   - Round 1: Reasoning → Search (2-3 broad queries)
   - Round 2: Reasoning → Search (3-4 targeted queries)
   - Round 3: Reasoning → Search (2-3 validation queries)
5. ✅ Synthesize final results
6. ✅ Return to parent for final synthesis node

## Architecture Note

The iterative research subgraph pattern follows **LangGraph 1.0-alpha subgraph best practices**:

- **Own State Schema**: Subgraph has its own `IterativeResearchStateAnnotation`
- **State Transformation**: `initialize` node transforms parent state → subgraph state
- **No Direct Parent Access**: Subgraph nodes only see their own state schema
- **Output Merging**: When subgraph completes, LangGraph merges output back to parent state

This pattern is **more maintainable** than having subgraphs directly access parent state fields, as it provides clear boundaries between parent and child state management.

## Troubleshooting

If you still see errors:

1. **Check thread_id**: Ensure it's unique or clear old checkpoints
2. **Check DATABASE_URL**: Postgres must be running for checkpointing
3. **Check node logs**: Look for `[IterativeResearch] Initializing subgraph state` message
4. **Verify state shape**: The initialize node should log the incoming state structure

## Documentation

See `langsmith-tests/README.md` for detailed usage instructions.
