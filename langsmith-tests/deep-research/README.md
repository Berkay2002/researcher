# LangSmith Test Inputs - Deep Research Workflow

This directory contains JSON input files for testing the `deep-research` workflow in LangSmith.

## Workflow Overview

The **deep-research** workflow is a multi-stage research system that:

1. **Clarifies with User** (`clarify_with_user`) - Analyzes the user's request and asks clarifying questions if the scope is unclear
2. **Writes Research Brief** (`write_research_brief`) - Generates a structured research brief to guide the investigation
3. **Supervisor** (`supervisor` subgraph) - Orchestrates parallel researchers to conduct deep investigation
4. **Final Report Generation** (`final_report_generation`) - Synthesizes findings into a comprehensive report

### Graph Structure

```
__start__ → clarify_with_user → write_research_brief → supervisor → final_report_generation → __end__
                      ↓
                   __end__ (if clarification needed)
```

## Input Schema

The deep-research workflow uses a **message-based input** schema:

```json
{
  "messages": [
    {
      "type": "human",
      "content": "Your research question here"
    }
  ]
}
```

## Configuration Options

You can customize the workflow behavior using the `configurable` object:

```json
{
  "configurable": {
    "thread_id": "unique-thread-id",
    "allow_clarification": true,
    "max_concurrent_research_units": 5,
    "max_researcher_iterations": 6,
    "search_api": "tavily",
    "research_model": "gemini-2.5-pro",
    "compression_model": "gemini-2.5-flash",
    "final_report_model": "gemini-2.5-pro"
  }
}
```

### Key Configuration Parameters

- **`allow_clarification`** (default: `true`) - Enable/disable the clarification step
- **`max_concurrent_research_units`** (default: `5`, max: `20`) - Number of parallel researchers
- **`max_researcher_iterations`** (default: `6`, max: `10`) - Maximum research iterations per researcher
- **`search_api`** (default: `"tavily"`) - Search provider: `"tavily"`, `"exa"`, or `"none"`
- **`research_model`** (default: `"gemini-2.5-pro"`) - Model for main research analysis
- **`compression_model`** (default: `"gemini-2.5-flash"`) - Model for summarizing research
- **`final_report_model`** (default: `"gemini-2.5-pro"`) - Model for final report generation

## Human-in-the-Loop (HITL) - Clarification Step

The `clarify_with_user` node can **interrupt** the workflow to ask clarifying questions before starting research.

### How It Works

1. The user submits a research question
2. If `allow_clarification: true` (default), the LLM analyzes if the request is ambiguous
3. If clarification is needed, the workflow **ends** with a clarifying question in the messages
4. The user provides more context by **resuming** the workflow with additional messages
5. The workflow continues to `write_research_brief` once clarification is sufficient

### Example: Triggering Clarification

**Initial Input:**
```json
{
  "messages": [
    {
      "type": "human",
      "content": "Tell me about AI regulations"
    }
  ]
}
```

**Output (interrupted for clarification):**
```json
{
  "messages": [
    {
      "type": "human",
      "content": "Tell me about AI regulations"
    },
    {
      "type": "ai",
      "content": "I'd like to clarify your research scope. Are you interested in:\n1. Specific jurisdictions (e.g., EU, US, China)?\n2. Particular AI applications (e.g., healthcare, finance, autonomous systems)?\n3. Enforcement and compliance details, or high-level policy summaries?\n\nPlease provide more details to help me conduct targeted research."
    }
  ]
}
```

**Resume with More Context:**
```json
{
  "messages": [
    {
      "type": "human",
      "content": "Tell me about AI regulations"
    },
    {
      "type": "ai",
      "content": "I'd like to clarify your research scope..."
    },
    {
      "type": "human",
      "content": "Focus on EU AI Act's General Purpose AI (GPAI) classification and compliance requirements"
    }
  ]
}
```

### Skipping Clarification

To bypass the clarification step entirely, set `allow_clarification: false`:

```json
{
  "messages": [
    {
      "type": "human",
      "content": "Your research question"
    }
  ],
  "configurable": {
    "thread_id": "test-skip-clarification",
    "allow_clarification": false
  }
}
```

## Test Files

### Tier A - Focused Synthesis (Clear Scope)
- **`tier-a-1-blackwell-inference.json`** - MLPerf benchmarks for Blackwell vs Hopper
- **`tier-a-2-eu-ai-act.json`** - EU AI Act GPAI classification

### Tier B - Multi-Source Synthesis
- **`tier-b-3-rag-evaluation.json`** - RAG evaluation frameworks comparison

### Tier C - Exploratory Research
- **`tier-c-4-agent-security.json`** - OWASP LLM security risks

## Using in LangSmith Studio

### 1. Local Testing with LangGraph Studio

```bash
# Start LangGraph Studio (if not already running)
npm run dev

# In LangGraph Studio:
# 1. Select graph: "deep-research"
# 2. Paste JSON from one of the test files into the Input panel
# 3. Click "Submit" or "Interact"
```

### 2. Testing HITL in LangSmith Studio

When the `clarify_with_user` node interrupts:

**Step 1: Submit Initial Input**
- Paste a test JSON (e.g., `tier-c-4-agent-security.json`)
- Submit the input
- The workflow will execute `clarify_with_user`

**Step 2: View Interruption**
- The workflow ends at `__end__` after `clarify_with_user`
- Check the `messages` in the output state
- The last message will be an AI message with a clarifying question

**Step 3: Resume with Additional Context**
- In the LangSmith "Interact" tab, view the current thread state
- The graph is in a "completed" state (not interrupted with `interrupt()` in the traditional sense)
- To continue, submit a **new invocation** with the full message history + your response:

```json
{
  "messages": [
    {
      "type": "human",
      "content": "Original question"
    },
    {
      "type": "ai",
      "content": "Clarifying question from LLM"
    },
    {
      "type": "human",
      "content": "User's clarifying response"
    }
  ]
}
```

**Important Notes:**
- The `clarify_with_user` node does **NOT use `interrupt()`** in the deep-research workflow
- Instead, it uses `Command({ goto: "__end__" })` to end the workflow with a question
- To continue, you must submit a **new invocation** with the updated message history
- The workflow will re-run from the start, but this time with sufficient context to proceed to research

### 3. Testing via LangSmith UI (Cloud)

1. Deploy your graph to LangSmith Cloud (see LangSmith deployment docs)
2. Create a new dataset with test inputs
3. Run batch evaluations or single invocations
4. Use the "Playground" to interactively test HITL scenarios

## Thread-Level Memory

The deep-research workflow uses **thread-level persistence** with `MemorySaver`:

- All invocations require a `thread_id` in the config
- State is preserved across multiple invocations within the same thread
- Research findings, notes, and messages are accumulated
- Use unique `thread_id` values for isolated test runs

## Example: Full Test with Configuration

```json
{
  "messages": [
    {
      "type": "human",
      "content": "Compare RAGAS, TruLens, and LangSmith for RAG evaluation"
    }
  ],
  "configurable": {
    "thread_id": "test-rag-eval-001",
    "allow_clarification": true,
    "max_concurrent_research_units": 3,
    "max_researcher_iterations": 4,
    "search_api": "tavily",
    "research_model": "gemini-2.5-pro",
    "final_report_model": "gemini-2.5-pro"
  }
}
```

## Monitoring Research Progress

During execution, the workflow emits events you can track:

1. **Clarification Decision** - Whether clarification is needed
2. **Research Brief Generation** - The structured research plan
3. **Supervisor Task Assignment** - Parallel research topics
4. **Research Findings** - Raw notes from each researcher
5. **Compression** - Summarized research notes
6. **Final Report** - Comprehensive synthesis

Use LangSmith tracing to visualize the full execution path and inspect intermediate state at each node.
