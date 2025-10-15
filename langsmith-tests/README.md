# LangSmith Test Inputs

This directory contains JSON input files for testing both graph architectures in LangSmith.

## Directory Structure

```
langsmith-tests/
├── orchestrator/          # Inputs for researcher-orchestrator graph
│   ├── tier-a-1-blackwell.json
│   ├── tier-a-2-eu-ai-act.json
│   ├── tier-a-3-c2pa.json
│   ├── tier-b-4-export-controls.json
│   ├── tier-b-5-hbm-supply.json
│   ├── tier-b-6-rag-eval.json
│   ├── tier-c-7-nordic-grid.json
│   ├── tier-c-8-agent-security.json
│   └── tier-c-9-benchmarks.json
└── react/                 # Inputs for react-agent graph
    ├── tier-a-1-blackwell.json
    ├── tier-a-2-eu-ai-act.json
    ├── tier-a-3-c2pa.json
    ├── tier-b-4-export-controls.json
    ├── tier-b-5-hbm-supply.json
    ├── tier-b-6-rag-eval.json
    ├── tier-c-7-nordic-grid.json
    ├── tier-c-8-agent-security.json
    └── tier-c-9-benchmarks.json
```

## Usage in LangSmith Studio

### 1. Testing in LangGraph Studio (Local)

Open the file in LangGraph Studio and paste the JSON directly into the Input panel:

**For Orchestrator Graph:**
```bash
# Select graph: researcher-orchestrator
# Paste content from: orchestrator/tier-a-1-blackwell.json
```

**For ReAct Graph:**
```bash
# Select graph: react-agent  
# Paste content from: react/tier-a-1-blackwell.json
```

### 2. Testing via LangSmith UI

1. Go to **LangSmith** → **Playground**
2. Select your deployed graph
3. Copy/paste the JSON from any test file
4. Click **Run**
5. View trace in LangSmith

### 3. Creating a Dataset in LangSmith

To batch test all prompts:

```bash
# Navigate to langsmith-tests directory
cd langsmith-tests

# Create dataset for orchestrator
langsmith dataset create \
  --name "orchestrator-eval-9-prompts" \
  --description "9 research prompts across 3 tiers"

# Upload examples (repeat for each file)
langsmith example create \
  --dataset-name "orchestrator-eval-9-prompts" \
  --input-file orchestrator/tier-a-1-blackwell.json \
  --metadata '{"tier": "A", "prompt": 1}'
```

## Input Schema Differences

### Orchestrator Graph (`researcher-orchestrator`)

```json
{
  "threadId": "unique-id",
  "userInputs": {
    "goal": "Research question",
    "modeOverride": "auto"
  }
}
```

### ReAct Graph (`react-agent`)

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Research question"
    }
  ],
  "context": {
    "sessionId": "unique-id",
    "userId": "eval-user",
    "locale": "en-US"
  }
}
```

## Configuration

Each test requires a `thread_id` in the config when invoking:

```json
{
  "configurable": {
    "thread_id": "test-{prompt-name}-001"
  }
}
```

The `thread_id` is included in:
- Orchestrator: `input.threadId` 
- ReAct: `input.context.sessionId`

For LangSmith testing, ensure the `thread_id` matches between input and config.

## Test Tiers

### Tier A (Focused Synthesis) - 3 prompts
- **A-1**: Blackwell vs Hopper inference benchmarks
- **A-2**: EU AI Act GPAI obligations  
- **A-3**: C2PA Content Credentials feasibility

**Expected:** Clear answers with authoritative sources, ~5-10 min execution

### Tier B (Multi-source Synthesis) - 3 prompts
- **B-4**: Export controls & China AI compute
- **B-5**: HBM supply bottlenecks
- **B-6**: RAG evaluation frameworks

**Expected:** Reconciling conflicting sources, ~10-15 min execution

### Tier C (Exploratory Research) - 3 prompts
- **C-7**: Nordic grid readiness for AI
- **C-8**: Agent security OWASP LLM Top-10
- **C-9**: Benchmarks to deployment reality

**Expected:** Open-ended exploration, ~15-20 min execution

## Quick Test Script

Test a single prompt with both graphs:

```bash
# Test orchestrator
echo "Testing Orchestrator..."
cat orchestrator/tier-a-1-blackwell.json

# Test ReAct
echo "Testing ReAct..."
cat react/tier-a-1-blackwell.json
```

## Comparing Results

After running both graphs on the same prompt:

1. **Quality**: Source diversity, citation accuracy, factual correctness
2. **Efficiency**: Token usage, execution time, tool calls
3. **Architecture**: Planning depth (orchestrator) vs. reasoning steps (ReAct)
4. **Cost**: Total tokens × pricing model

See `../docs/langsmith-testing-guide.md` for detailed evaluation methodology.

## Notes

- All orchestrator tests use `modeOverride: "auto"` (no HITL)
- ReAct tests use consistent context (sessionId, userId, locale)
- Thread IDs are unique per test to avoid state conflicts
- Tests assume DATABASE_URL is configured for checkpointing

## Troubleshooting

**Error: "No goal provided"**
- Orchestrator expects: `userInputs.goal`
- ReAct expects: `messages[0].content`

**Error: "Thread already exists"**
- Change `threadId` or `sessionId` to a new unique value
- Or clear: `DELETE FROM checkpoints WHERE thread_id = 'test-id'`

**Timeout in LangSmith**
- Increase timeout in LangSmith project settings
- Use `.stream()` instead of `.invoke()` for progress visibility
