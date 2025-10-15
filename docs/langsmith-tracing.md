# LangSmith Tracing for Research Workflows

This document explains how to use LangSmith tracing to debug and monitor both the React Agent and Deep Research workflows.

## Setup

### 1. Enable Tracing

Tracing is configured in your `.env.local` file:

```bash
# LangSmith Tracing Configuration
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=researcher-workflows
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

### 2. Get Your API Key

1. Sign up at [LangSmith](https://smith.langchain.com)
2. Go to [Settings](https://smith.langchain.com/settings)
3. Copy your API key
4. Add it to `.env.local` as `LANGCHAIN_API_KEY`

### 3. Restart the Server

After enabling tracing, restart the development server:

```bash
npm run dev
```

## What Gets Traced

With tracing enabled, you'll see detailed information about both workflows:

### React Agent Workflow

#### Main React Agent
- **LLM calls**: Every call to Gemini 2.5 Pro
- **Tool invocations**: When the agent decides to use tools
- **Tool arguments**: What parameters the agent passes to each tool
- **Tool results**: What each tool returns
- **Agent reasoning**: The agent's decision-making process
- **State updates**: How the state changes between steps

#### Research Subagent
When the main agent uses the research tool, you'll see:
- **Subagent LLM calls**: Separate trace for the research subagent
- **Search tool usage**: Tavily and Exa search calls
- **Search results**: What information was found
- **Research synthesis**: How the subagent combines search results

### Deep Research Workflow

#### Clarification Node
- **LLM calls**: Analysis of user query for clarification needs
- **Decision making**: Whether clarification is needed
- **Structured output**: Clarification questions or verification messages

#### Research Brief Generation
- **LLM calls**: Transformation of user messages into structured research brief
- **Research question generation**: Topic, objectives, scope, constraints
- **State initialization**: Setting up supervisor context

#### Supervisor Agent
- **Research delegation**: ConductResearch tool calls
- **Progress tracking**: Think tool reflections
- **Completion detection**: ResearchComplete tool usage
- **Model call limits**: Iteration tracking via middleware
- **Parallel research**: Multiple researcher instances

#### Researcher Agents (Parallel)
- **Search tool usage**: Tavily or Exa search calls per researcher
- **Tool call limits**: Iteration tracking via middleware
- **Context editing**: Tool message cleanup via middleware
- **Research synthesis**: Individual researcher findings

#### Research Compression
- **LLM calls**: Compression of raw research notes
- **Structured summarization**: Key findings extraction
- **Token optimization**: Reducing context size

#### Final Report Generation
- **LLM calls**: Comprehensive report synthesis
- **Model fallback**: Automatic retry with fallback models on token limits
- **Report formatting**: Structured output generation

### Search Tools (Both Workflows)
- **Tavily searches**: Query, results, relevance scores
- **Exa searches**: Query, results, content extraction
- **Search metadata**: Timing, token usage, costs
- **Webpage summarization**: AI-powered content extraction

## Viewing Traces

### In LangSmith Dashboard

1. Go to [LangSmith Projects](https://smith.langchain.com/projects)
2. Select your project: `researcher-workflows`
3. View traces in real-time as workflows execute
4. Click on any trace to see detailed execution flow
5. Filter by workflow using tags: `model:gemini-2.5-pro` or `model:gemini-flash-latest`

### Trace Details Include:

#### 📊 Overview
- Total duration
- Token usage (input/output)
- Cost estimation
- Success/error status

#### 🔍 Execution Flow
- Visual graph of all steps
- Parent-child relationships (main agent → subagent)
- Timing for each step
- State transitions

#### 💬 Messages
- All messages between user and agent
- Tool call requests and responses
- Internal reasoning steps

#### 🏷️ Metadata
- Model used (`gemini-2.5-pro` or `gemini-flash-latest`)
- Temperature settings
- Tags for filtering

## Useful Traces to Monitor

### 1. Deep Research Workflow Execution
Look for complete traces showing:
- **Clarification phase**: User query analysis and clarification decision
- **Research brief generation**: Structured research question creation
- **Supervisor delegation**: Multiple ConductResearch tool calls
- **Parallel researchers**: Multiple researcher traces running concurrently
- **Research compression**: Note summarization for each researcher
- **Final report**: Comprehensive synthesis of all findings

### 2. Supervisor Orchestration
Monitor supervisor behavior:
- **Research delegation**: How many researchers are spawned?
- **Tool call patterns**: Think → ConductResearch → Think → ResearchComplete
- **Iteration tracking**: Model call limit middleware in action
- **Completion detection**: When and why ResearchComplete is called

### 3. Researcher Agent Performance
Track individual researchers:
- **Search strategies**: What queries are being generated?
- **Tool usage**: Tavily vs Exa, number of searches
- **Context editing**: Tool message cleanup between iterations
- **Research quality**: Are findings relevant and comprehensive?

### 4. Error Cases
Track failures across workflows:
- **LLM errors**: Rate limits, timeouts, token limit exceeded
- **Tool failures**: Search API errors, network issues
- **State validation errors**: Schema violations, missing required fields
- **Middleware errors**: Limit exceeded, fallback failures
- **Subgraph crashes**: Researcher or supervisor failures

### 5. Performance Bottlenecks
Identify slow steps:
- **Long LLM calls**: Which nodes take longest? Research brief? Final report?
- **Search timeouts**: Are Tavily/Exa searches timing out?
- **Parallel bottlenecks**: Are researchers running truly in parallel?
- **Compression overhead**: Is research note compression slowing things down?

### 6. Token Usage Optimization
Monitor token consumption:
- **Supervisor iterations**: Are we hitting model call limits?
- **Researcher iterations**: Are we hitting tool call limits?
- **Research compression**: Are we effectively reducing token usage?
- **Final report**: Is the final report generation hitting token limits?

## Filtering Traces

### By Tags
All LLM calls are tagged with:
- `model:gemini-2.5-pro` or `model:gemini-flash-latest`
- `temperature:X.X`

Filter in LangSmith using these tags to focus on specific model calls.

### By Status
-  Success: Completed without errors
-  Error: Failed with exception
- ⏱️ Timeout: Exceeded time limit

### By Duration
Find slow requests:
- Sort by duration
- Set filters for > 5s, > 10s, etc.

## Best Practices

### 1. Use Descriptive Project Names
Keep project names organized:
- `researcher-workflows` for production
- `researcher-workflows-dev` for development
- `researcher-workflows-test` for testing

You can also use separate projects per workflow:
- `researcher-react-agent` for React Agent workflow
- `researcher-deep-research` for Deep Research workflow

### 2. Monitor Costs
LangSmith shows token usage and estimated costs:
- Set budget alerts
- Monitor expensive traces
- Optimize prompts to reduce tokens

### 3. Debug with Playground
For failed traces:
1. Click "Open in Playground"
2. Modify the prompt or inputs
3. Re-run to test fixes
4. Compare results

### 4. Share Traces
When debugging with team:
1. Click "Share" on any trace
2. Copy public URL
3. Share with teammates
4. They can view without LangSmith account

## Troubleshooting

### Traces Not Appearing

**Check environment variables:**
```bash
echo $LANGCHAIN_TRACING_V2
echo $LANGCHAIN_API_KEY
```

**Verify in logs:**
Look for tracing initialization messages when server starts.

**Test manually:**
```typescript
import { Client } from "langsmith";

const client = new Client({
  apiKey: process.env.LANGCHAIN_API_KEY,
});

// Test connection
await client.ping();
```

### Partial Traces

If you only see main agent traces but not subagent traces:
- Ensure subagents are using the same LLM configuration
- Check that environment variables are loaded before subagent creation

### High Latency

LangSmith adds minimal overhead (<50ms per trace):
- If you see higher latency, check network connectivity
- Consider using LangSmith proxy for faster uploads

## Advanced Usage

### Custom Metadata

Add custom metadata to traces:

```typescript
import { createLLM } from "@/server/shared/configs/llm";

const llm = createLLM("gemini-2.5-pro", 0.2, {
  tags: ["custom-tag", "feature:research"],
  metadata: {
    userId: "user123",
    sessionId: "session456",
  },
});
```

### Trace Annotations

Annotate traces with feedback:
1. View trace in LangSmith
2. Click "Add Annotation"
3. Tag as: Good, Bad, or Custom label
4. Use annotations for model evaluation

### Datasets for Testing

Create test datasets from traces:
1. Find a good trace
2. Click "Add to Dataset"
3. Use dataset for regression testing
4. Run evaluations on future changes

## Resources

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [Tracing Guide](https://docs.smith.langchain.com/tracing)
- [Evaluation Guide](https://docs.smith.langchain.com/evaluation)
- [API Reference](https://api.smith.langchain.com/redoc)

## Support

For issues with tracing:
1. Check [LangSmith Status](https://status.smith.langchain.com/)
2. Review [Troubleshooting Guide](https://docs.smith.langchain.com/troubleshooting)
3. Contact support: support@langchain.com
