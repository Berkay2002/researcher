# Academic Comparison Experiment: ReAct vs Orchestrator-Worker

## Overview

This document describes the experimental setup for comparing two multi-agent research architectures on deep research tasks.

### Research Question
**Which architecture produces higher-quality research reports: single-agent ReAct with delegation, or multi-agent Orchestrator-Worker with parallel task decomposition?**

### Purpose
Fair academic comparison to evaluate:
- Research quality (correctness, citation quality, completeness)
- Structured output consistency (claims extraction)
- Computational efficiency (model calls, tokens)
- Explainability (reasoning traceability)

---

## Experimental Conditions

### Condition 1: ReAct Agent (Single-Agent with Delegation)
**Architecture**: Single agent with research subagent delegation
- Main agent analyzes request complexity
- Delegates comprehensive research to specialized research subagent
- Subagent executes searches, synthesizes findings, extracts claims
- Returns structured output to main agent

**Files**:
- [src/server/agents/react/agent.ts](../src/server/agents/react/agent.ts) - Main ReAct agent
- [src/server/agents/react/subgraphs/research.ts](../src/server/agents/react/subgraphs/research.ts) - Research subagent
- [src/server/agents/react/prompts/research-system.ts](../src/server/agents/react/prompts/research-system.ts) - System prompts

### Condition 2: Orchestrator-Worker (Multi-Agent Parallel Decomposition)
**Architecture**: Orchestrator with parallel worker pool
- Planner analyzes research goal
- Orchestrator decomposes into parallel tasks (3-8 workers)
- Workers execute independently and in parallel
- Synthesizer aggregates results and extracts claims

**Files**:
- [src/server/workflows/researcher/graph/index-orchestrator.ts](../src/server/workflows/researcher/graph/index-orchestrator.ts) - Graph definition
- [src/server/workflows/researcher/graph/nodes/orchestrator.ts](../src/server/workflows/researcher/graph/nodes/orchestrator.ts) - Task decomposition
- [src/server/workflows/researcher/graph/nodes/research-worker.ts](../src/server/workflows/researcher/graph/nodes/research-worker.ts) - Parallel workers
- [src/server/workflows/researcher/graph/nodes/synthesizer.ts](../src/server/workflows/researcher/graph/nodes/synthesizer.ts) - Result aggregation

---

## Fixed Parameters (Ensures Fair Comparison)

### Model Configuration
```typescript
{
  model: "gemini-2.5-pro",
  temperature: 0.2,
  provider: "Google (via OpenAI SDK)",
}
```

### Tool Configuration
```typescript
{
  tools: ["tavily_search", "exa_search"],
  maxResultsPerQuery: 10,
  snippetLength: 300,
  toolTimeout: 15000, // 15 seconds
}
```

### Quality Standards
See [src/server/shared/configs/research-standards.ts](../src/server/shared/configs/research-standards.ts) for complete specification.

**Key Requirements**:
- **Sources**: 20-30 authoritative sources (.edu, .gov, peer-reviewed journals)
- **Report Length**: 2,000-4,000 words
- **Structure**: Executive summary + detailed analysis + key insights + APA references
- **Citations**: Inline [1], [2] format with APA-formatted reference list
- **Search Queries**: 8-12 diverse queries
- **Claims**: 10-20 structured factual assertions with supporting sources

---

## Structured Outputs (Both Conditions)

Both systems produce identical output formats for comparison:

```typescript
{
  // Research report
  report: string,              // 2,000-4,000 words with inline citations

  // Citation list
  citations: Array<{
    id: string,                // Citation number
    url: string,
    title: string,
    excerpt: string,
  }>,

  // Structured claims for evaluation
  claims: Array<{
    claim_id: string,          // Unique identifier
    claim_text: string,        // Factual assertion
    sources: Array<{
      url: string,
      title: string,
      snippet: string,
      score?: number,
    }>,
    confidence: number,        // 0-1 score
  }>,

  // Overall confidence
  confidence: number,          // 0-1 score
}
```

---

## Evaluation Metrics

### Automatic Metrics (From LangSmith Traces)
- **Model calls**: Total LLM invocations
- **Token usage**: Input + output tokens
- **Latency**: Total execution time
- **Tool calls**: Search query count and distribution
- **Source count**: Number of distinct sources cited
- **Word count**: Report length
- **Claims count**: Number of extracted claims

### Human Evaluation (3 Raters)
For each report, raters assess:

**Claim-Level Evaluation**:
- Each claim marked as: SUPPORTED | NOT SUPPORTED | AMBIGUOUS

**Report-Level Ratings** (Likert 1-5):
- **Correctness**: Factual accuracy of claims
- **Citation Quality**: Proper attribution and relevance
- **Coherence & Synthesis**: Logical flow and integration
- **Completeness**: Coverage of relevant dimensions
- **Explainability**: Clarity of reasoning and evidence

**Overall Rating** (1-10):
- Single quality score

**Binary Question**:
- "Would you rely on this report for decision-making?" (Yes/No)

### Inter-Rater Reliability
- **Fleiss' Kappa**: For categorical ratings (claim labels)
- **ICC(2,1)**: For Likert scale ratings

---

## LangSmith Tracing

All experimental runs are traced in LangSmith for reproducibility.

### Configuration
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=researcher-react-agent
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

### What's Captured
- **Agent reasoning**: Internal thoughts and decision-making
- **Tool usage**: Search queries, results, and timing
- **LLM calls**: Prompts, completions, tokens, costs
- **State transitions**: How state evolves through the graph
- **Error handling**: Failed calls and retry logic

### Accessing Traces
1. Go to [LangSmith Dashboard](https://smith.langchain.com/projects)
2. Select project: `researcher-react-agent`
3. Filter by:
   - Tags: `model:gemini-2.5-pro`, `temperature:0.2`
   - Status: Success, Error
   - Duration: Execution time

---

## Running the Experiment

### Prerequisites
1. Environment variables configured (`.env.local`)
2. LangSmith tracing enabled
3. Research tasks defined (9 tasks balanced by difficulty)

### Execution
```bash
# Start both systems
npm run dev              # Frontend + API
npm run dev:langgraph    # LangGraph server

# Run experiments manually via UI or API
# Each task × 3 runs × 2 conditions = 54 total runs
```

### Task Selection
Choose 9 research tasks spanning:
- **Simple** (3 tasks): Single-domain, recent topics
- **Moderate** (3 tasks): Multi-domain, some controversy
- **Complex** (3 tasks): Multi-dimensional, high uncertainty

---

## Data Collection & Storage

### Run Logs
Each run creates a structured log:
```
experiments/research_agents/{task_id}_{condition}_{run_seed}.json
```

Contains:
- Run metadata (task, condition, seed)
- Timing information
- Model/tool call counts
- Token usage
- Generated outputs (report, claims, citations)
- LangSmith trace URL

### Annotation Data
Human ratings stored in:
```
experiments/research_agents/annotations/{run_id}_annotations.csv
```

### Aggregated Results
Combined metrics in:
```
experiments/research_agents/results_summary.csv
```

---

## Statistical Analysis

### Planned Tests
- **Paired t-test** (or Wilcoxon signed-rank if non-normal): Continuous metrics
- **McNemar's test**: Binary paired outcomes
- **Effect size**: Cohen's d for continuous comparisons
- **Multiple comparisons**: Benjamini-Hochberg FDR correction

### Significance Level
- α = 0.05
- 95% confidence intervals reported

---

## Fairness Measures

To ensure unbiased comparison:

### ✅ **Identical Models**
Both use Gemini 2.5 Pro (temp: 0.2)

### ✅ **Identical Tools**
Both use Tavily + Exa with same parameters

### ✅ **Identical Quality Standards**
Both prompts reference the same fixed requirements (20-30 sources, 2,000-4,000 words)

### ✅ **Identical Output Format**
Both produce structured claims + citations + report

### ✅ **Evidence-First Language**
Both prompts emphasize indicating strength of evidence

### ✅ **Traceability**
Both systems traced in LangSmith with same detail level

---

## Reproducibility

### Code Versioning
- Record git commit hash for each experimental run
- Store code snapshot in `experiments/code_snapshot/`

### Configuration Files
- All prompts, hyperparameters, and standards stored in config files
- No hardcoded magic numbers or strings

### Documentation
- This file documents complete experimental protocol
- Research standards codified in [research-standards.ts](../src/server/shared/configs/research-standards.ts)
- Prompt templates version-controlled

---

## Expected Outcomes

### Hypothesis
**H1**: Orchestrator-Worker produces more comprehensive reports (higher source count, better coverage)

**H2**: ReAct produces more coherent reports (better synthesis, clearer narrative)

**H3**: No significant difference in factual correctness (both use same search tools)

**H4**: Orchestrator-Worker has higher computational cost (more parallel LLM calls)

**H5**: Orchestrator-Worker provides better explainability (parallel task decomposition visible in traces)

---

## References

- **LangGraph Documentation**: [documentation/langgraph/](../documentation/langgraph/)
- **LangChain 1.0-alpha Docs**: [documentation/langchain/](../documentation/langchain/)
- **LangSmith Tracing Guide**: [docs/langsmith-tracing.md](./langsmith-tracing.md)
- **Research Standards**: [src/server/shared/configs/research-standards.ts](../src/server/shared/configs/research-standards.ts)

---

## Contact & Support

For questions about experimental setup:
1. Review this documentation
2. Check [CLAUDE.md](../CLAUDE.md) for system architecture
3. Examine trace URLs in LangSmith for debugging

---

**Last Updated**: 2025-10-10
**Version**: 1.0
**Status**: Implementation Complete, Ready for Experimentation
