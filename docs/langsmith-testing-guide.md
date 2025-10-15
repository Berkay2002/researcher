# LangSmith Testing Guide for Researcher Workflows

This guide explains how to test the **Researcher Orchestrator** and **ReAct Agent** workflows in LangSmith using the provided test input files.

## Overview

Two test input files have been created with 9 research prompts across three tiers (A, B, C):

1. **`test-inputs-researcher-orchestrator.json`** - For the orchestrator workflow (planner → iterativeResearch → synthesizer)
2. **`test-inputs-react-agent.json`** - For the ReAct agent (single-agent with tool calls)

Each file contains the same 9 research prompts but with different input schemas matching each graph's requirements.

## Graph Differences

### Researcher Orchestrator (`researcher-orchestrator`)

**Input Schema:**
```json
{
  "threadId": "unique-thread-id",
  "userInputs": {
    "goal": "Research question",
    "modeOverride": "auto" | "plan"
  }
}
```

**Config:**
```json
{
  "configurable": {
    "thread_id": "unique-thread-id"
  }
}
```

**Key Features:**
- Multi-stage pipeline: planGate → planner → iterativeResearch → synthesizer
- Supports HITL (Human-in-the-Loop) with `modeOverride: "plan"`
- 3-round iterative research with adaptive queries
- Full state management with PostgreSQL checkpointing
- Structured citations and evidence gathering

### ReAct Agent (`react-agent`)

**Input Schema:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Research question"
    }
  ],
  "context": {
    "sessionId": "unique-session-id",
    "userId": "eval-user",
    "locale": "en-US"
  }
}
```

**Config:**
```json
{
  "configurable": {
    "thread_id": "unique-thread-id"
  }
}
```

**Key Features:**
- Single-agent ReAct pattern (Reasoning + Acting)
- Tool calling with tavily_search, exa_search, research_subagent, todo_manager
- Message-based state (MessagesAnnotation)
- Simpler architecture for comparison

## Test Prompts (9 Total)

### Tier A — Focused Synthesis (3 prompts)
1. **Blackwell vs Hopper** - Fresh MLPerf v5.1 benchmarks, cross-verification pressure
2. **EU AI Act GPAI** - Policy with clear timelines, compliance mapping
3. **C2PA Content Credentials** - Standards doc vs blog claims, feasibility reasoning

### Tier B — Multi-source Synthesis (3 prompts)
4. **Export Controls & China** - Fast-moving policy + enforcement news
5. **HBM Supply Bottlenecks** - Quantitative claims, supplier data
6. **RAG Evaluation Frameworks** - Technical comparison, metric definitions

### Tier C — Exploratory Research (3 prompts)
7. **Nordic Grid Readiness** - Policy + infrastructure, case studies
8. **Agent Security OWASP** - Security taxonomy, guardrails comparison
9. **Benchmarks to Deployment** - Performance vs. real-world constraints

## Using the Test Files in LangSmith

### Option 1: LangSmith UI Dataset Upload

1. Go to your LangSmith project
2. Navigate to **Datasets**
3. Click **+ New Dataset**
4. Upload the JSON file:
   - For orchestrator: `test-inputs-researcher-orchestrator.json`
   - For ReAct: `test-inputs-react-agent.json`
5. Select the appropriate graph from your deployed graphs
6. Run evaluations and compare results

### Option 2: LangSmith CLI

```bash
# Install LangSmith CLI if needed
npm install -g langsmith

# Set your API key
export LANGSMITH_API_KEY="your-api-key"

# Upload dataset for orchestrator
langsmith dataset upload \
  --name "researcher-orchestrator-eval" \
  --file test-inputs-researcher-orchestrator.json

# Upload dataset for ReAct agent
langsmith dataset upload \
  --name "react-agent-eval" \
  --file test-inputs-react-agent.json
```

### Option 3: Python SDK (for batch testing)

```python
from langsmith import Client
import json

client = Client()

# Load test inputs
with open("test-inputs-researcher-orchestrator.json") as f:
    orchestrator_tests = json.load(f)["tests"]

# Create dataset
dataset = client.create_dataset(
    dataset_name="researcher-orchestrator-eval",
    description="9 research prompts across 3 complexity tiers"
)

# Add examples to dataset
for test in orchestrator_tests:
    client.create_example(
        dataset_id=dataset.id,
        inputs=test["input"],
        outputs=None,  # Will be filled by evaluation runs
        metadata={
            "name": test["name"],
            "description": test["description"],
            "expected_characteristics": test["expected_characteristics"]
        }
    )
```

## Running Individual Tests

### Via LangGraph Studio (Local Testing)

1. Open LangGraph Studio
2. Select graph: `researcher-orchestrator` or `react-agent`
3. Copy/paste from the JSON file:
   - For orchestrator: Use `input` object directly
   - For ReAct: Use `input.messages` and `input.context`
4. Set `thread_id` in config
5. Click **Submit** and observe execution

### Via LangSmith Tracing (Production)

The graphs are already instrumented with LangSmith tracing. When you run them via your API routes, traces will appear in LangSmith automatically:

```typescript
// Example API call
const response = await fetch("/api/threads/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: "Your research question",
    modeOverride: "auto"
  })
});
```

Traces will appear under:
- **Project:** Your LangSmith project name
- **Run Type:** Chain (for orchestrator) or Agent (for ReAct)
- **Tags:** You can add custom tags via config

## Evaluation Metrics to Track

### For Both Graphs:
- **Execution Time** - Total time from start to completion
- **Token Usage** - Input/output tokens for cost analysis
- **Source Count** - Number of unique sources cited
- **Source Quality** - Diversity of source types (official docs, news, blogs)
- **Citation Accuracy** - Do citations actually support claims?
- **Factual Errors** - Count of incorrect/contradictory statements

### Orchestrator-Specific:
- **Planning Quality** - Does the research plan match the query complexity?
- **Research Rounds** - How many rounds were needed (should be 3 for iterative)
- **Query Evolution** - Do queries adapt based on previous findings?
- **Synthesis Quality** - Is the final report coherent and comprehensive?

### ReAct-Specific:
- **Tool Call Efficiency** - Number of tool calls needed
- **Search Strategy** - Query formulation quality
- **Reasoning Steps** - Clarity of agent's thought process
- **Error Recovery** - How agent handles failed tool calls

## Comparing Results

After running both graphs on the same prompts:

1. **Depth vs. Speed** - Does orchestrator produce deeper analysis? Is ReAct faster?
2. **Citation Quality** - Which provides better source attribution?
3. **Handling Contradictions** - Which better reconciles conflicting sources?
4. **Cost Efficiency** - Token usage per quality unit
5. **User Experience** - Streaming updates, progress visibility

## Expected Behaviors

### Tier A (Focused Synthesis)
- **Orchestrator**: Should identify key sources quickly, 3 rounds with focused queries
- **ReAct**: Should do multiple searches, cross-check vendor vs. independent data

### Tier B (Multi-source Synthesis)
- **Orchestrator**: Planning should identify conflicting sources, synthesis should reconcile
- **ReAct**: May struggle with conflicting data, requires more tool calls

### Tier C (Exploratory Research)
- **Orchestrator**: Planning should break down into sub-questions, iterative refinement
- **ReAct**: Open-ended exploration, may need user guidance via todo items

## Troubleshooting

### Thread ID Conflicts
If you see errors about existing threads:
- Ensure each test uses a unique `thread_id`
- Clear old threads: `DELETE FROM checkpoints WHERE thread_id = 'test-id'`

### Missing Context
If graphs fail with validation errors:
- Orchestrator requires `threadId` + `userInputs.goal`
- ReAct requires `messages` array + `context.sessionId`

### Timeout Issues
For long-running tests:
- Increase timeout in LangSmith config
- Use `.stream()` instead of `.invoke()` to see progress
- Monitor via LangSmith real-time traces

## Next Steps

1. **Run baseline tests** - Execute all 9 prompts on both graphs
2. **Compare traces** - Analyze execution patterns in LangSmith
3. **Iterate on prompts** - Refine system prompts based on failures
4. **Add custom evaluators** - Write LangSmith evaluators for domain-specific quality
5. **Production deployment** - Use best-performing graph for your use case

## Additional Resources

- **LangSmith Docs**: https://docs.smith.langchain.com/
- **LangGraph Evaluation**: See `documentation/langgraph/` for patterns
- **Project Docs**: See `docs/workflow-iterative-research-implementation-status.md` for architecture details

---

**Pro Tip**: Start with Tier A prompts (faster, clearer success criteria) before moving to Tier C (exploratory, harder to evaluate).
