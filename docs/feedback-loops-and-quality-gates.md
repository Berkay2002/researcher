# Feedback Loops and Quality Gates in LangGraph

**Date**: October 9, 2025  
**Pattern**: Iterative Improvement with Bounded Revisions  
**Status**: ✅ Implemented in Orchestrator Workflow

## Overview

This document captures the implementation of feedback loops and quality gates in LangGraph workflows, enabling iterative improvement of outputs with proper safeguards against infinite loops.

## The Problem

Linear workflows (`A → B → C → END`) don't allow for quality improvements:

```
synthesizer → redteam → END
     ↓
  (Issues found but no way to fix them)
```

**Result**: Poor quality outputs pass through without refinement.

## The Solution: Feedback Loop with Bounded Revisions

```
synthesizer → redteam → [decision] → synthesizer (revision) → redteam → ...
                             ↓
                           END (if passed or max revisions)
```

## Implementation Pattern

### 1. Add Revision Counter to State

```typescript
// state.ts
export const ParentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  // Track revision iterations
  revisionCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  
  // Quality issues from gates
  issues: Annotation<string[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),
  
  // ... other fields
});
```

### 2. Create Router with Safeguards

```typescript
// index-orchestrator.ts
function routeRedteam(state: ParentState): string {
  const MAX_REVISIONS = 3;  // Prevent infinite loops
  const hasIssues = state.issues && state.issues.length > 0;
  const revisionCount = state.revisionCount || 0;

  // Loop back for revision if issues found and under limit
  if (hasIssues && revisionCount < MAX_REVISIONS) {
    console.log(
      `[router] Found ${state.issues.length} issues, ` +
      `revision ${revisionCount + 1}/${MAX_REVISIONS}`
    );
    return "synthesizer";
  }

  // Warn if max revisions reached with issues
  if (hasIssues && revisionCount >= MAX_REVISIONS) {
    console.warn(
      `[router] Max revisions reached. ` +
      `Proceeding despite ${state.issues.length} issues.`
    );
  }

  return END;
}

// Add conditional edge
builder.addConditionalEdges("redteam", routeRedteam, {
  synthesizer: "synthesizer",
  [END]: END,
});
```

### 3. Update Node to Handle Revisions

```typescript
// synthesizer.ts
export async function synthesizer(state: ParentState) {
  const { issues, draft: previousDraft, revisionCount } = state;
  
  // Detect revision mode
  const isRevision = issues?.length > 0 && previousDraft;
  
  if (isRevision) {
    console.log(
      `[synthesizer] REVISION MODE: Addressing ${issues.length} issues`
    );
    console.log("[synthesizer] Previous issues:", issues);
  }
  
  // Generate or revise
  const newDraft = await generateDraft({
    ...params,
    revisionContext: isRevision ? { previousDraft, issues } : undefined,
  });
  
  return {
    draft: newDraft,
    messages: [aiMessage],
    issues: [],  // ← CRITICAL: Clear for next evaluation
    revisionCount: (revisionCount || 0) + (isRevision ? 1 : 0),
  };
}
```

### 4. Update Generation Function

```typescript
async function generateDraft(params: {
  goal: string;
  evidence: Evidence[];
  revisionContext?: { 
    previousDraft: Draft; 
    issues: string[] 
  };
}) {
  const { revisionContext } = params;
  const isRevision = Boolean(revisionContext);
  
  // Build revision instructions
  const revisionPrompt = isRevision ? `
IMPORTANT: This is a REVISION of a previous draft.

Previous Draft:
${revisionContext.previousDraft.text}

Issues Found:
${revisionContext.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Please address ALL issues while maintaining quality.
` : "";

  const systemPrompt = `You are a ${isRevision ? 'revision' : 'synthesis'} expert.
${isRevision ? 'ADDRESS ALL ISSUES from the feedback.' : ''}`;

  const humanPrompt = `${basePrompt}${revisionPrompt}`;
  
  return await llm.invoke([...]);
}
```

## Key Principles

### Always Clear Issues After Processing

```typescript
return {
  issues: [],  // ← Essential! Enables clean next evaluation
};
```

**Why**: If you don't clear issues, the router will keep looping.

### Always Increment Revision Counter

```typescript
return {
  revisionCount: (state.revisionCount || 0) + (isRevision ? 1 : 0),
};
```

**Why**: Prevents infinite loops by tracking iterations.

### Always Set Maximum Revisions

```typescript
const MAX_REVISIONS = 3;  // Reasonable limit

if (revisionCount >= MAX_REVISIONS) {
  console.warn("Max revisions reached");
  return END;
}
```

**Why**: Safeguard against edge cases and LLM failures.

### Always Log Revision Metadata

```typescript
return {
  messages: [new AIMessage({
    content: draft.text,
    additional_kwargs: {
      isRevision,
      revisionNumber: revisionCount + 1,
      issuesAddressed: isRevision ? issues : undefined,
    }
  })]
};
```

**Why**: Observability and debugging.

## Flow Diagram

```
Initial Pass:
┌──────────────┐
│ synthesizer  │ → revisionCount = 0
└──────┬───────┘
       ↓
┌──────────────┐
│   redteam    │ → Evaluates quality
└──────┬───────┘
       ↓
   [decision]
       ↓
  issues.length > 0?
       ↓
     YES → Loop back
       
Revision Pass 1:
┌──────────────┐
│ synthesizer  │ → Sees previousDraft + issues
│              │ → Generates revision
│              │ → Clears issues
│              │ → revisionCount = 1
└──────┬───────┘
       ↓
┌──────────────┐
│   redteam    │ → Re-evaluates
└──────┬───────┘
       ↓
   [decision]
       ↓
  issues.length > 0 && revisionCount < 3?
       ↓
     YES → Loop back
     NO  → END
```

## Where to Apply Feedback Loops

### Good Candidates

1. **Quality Gates** (like redteam)
   - Draft review before publishing
   - Code review before deployment
   - Data validation before storage

2. **User-Facing Content**
   - Research reports
   - Generated articles
   - Marketing copy

3. **Critical Operations**
   - Financial calculations
   - Medical recommendations
   - Legal document generation

### Not Recommended

1. **Fast Operations**
   - Search queries
   - Simple classifications
   - Data transformations

2. **Non-Deterministic Tasks**
   - Random sampling
   - Exploratory research
   - Brainstorming

3. **User Interaction Points**
   - Already has human review
   - Interactive editing available

## Advanced Patterns

### Pattern 1: Multi-Stage Feedback

```typescript
// Different revision strategies per stage
function routeQualityGate(state: ParentState): string {
  const { revisionCount, issues } = state;
  
  if (revisionCount === 0 && issues.length > 0) {
    // First revision: Quick fixes
    return "quickRevision";
  }
  
  if (revisionCount === 1 && issues.length > 0) {
    // Second revision: Comprehensive rewrite
    return "deepRevision";
  }
  
  if (revisionCount === 2 && issues.length > 0) {
    // Third revision: Human review
    return "humanReview";
  }
  
  return END;
}
```

### Pattern 2: Issue-Specific Routing

```typescript
function routeByIssueType(state: ParentState): string {
  const { issues } = state;
  
  const hasCitationIssues = issues.some(i => i.includes("citation"));
  const hasFactualIssues = issues.some(i => i.includes("factual"));
  
  if (hasCitationIssues) {
    return "citationResolver";
  }
  
  if (hasFactualIssues) {
    return "factChecker";
  }
  
  return "generalRevision";
}
```

### Pattern 3: Confidence-Based Thresholds

```typescript
function routeByConfidence(state: ParentState): string {
  const { draft, revisionCount } = state;
  const confidence = draft?.confidence || 0;
  
  // Dynamic threshold based on revision count
  const threshold = 0.7 - (revisionCount * 0.1);
  
  if (confidence < threshold && revisionCount < 3) {
    return "revision";
  }
  
  return END;
}
```

## Monitoring and Observability

### Key Metrics to Track

```typescript
// Log in router
console.log(JSON.stringify({
  event: "revision_decision",
  thread_id: state.threadId,
  revision_count: state.revisionCount,
  issues_count: state.issues.length,
  issues: state.issues,
  decision: nextNode,
  timestamp: new Date().toISOString(),
}));
```

### LangSmith Traces

Revision metadata appears in LangSmith:
- Revision count per run
- Issues identified at each stage
- Time spent per revision
- Success rate by revision number

## Testing Feedback Loops

### Unit Test Pattern

```typescript
import { describe, it, expect } from "vitest";

describe("Revision Loop", () => {
  it("should revise when issues found", async () => {
    const state = {
      draft: mockDraft,
      issues: ["Missing citations"],
      revisionCount: 0,
    };
    
    const result = await synthesizer(state);
    
    expect(result.revisionCount).toBe(1);
    expect(result.issues).toEqual([]);
  });
  
  it("should stop after max revisions", () => {
    const state = {
      issues: ["Still has issues"],
      revisionCount: 3,
    };
    
    const decision = routeRedteam(state);
    
    expect(decision).toBe(END);
  });
});
```

## Performance Considerations

### Cost Analysis

- **Initial Pass**: 1x LLM call
- **Revision 1**: 1x LLM call (with longer prompt)
- **Revision 2**: 1x LLM call (with even longer prompt)
- **Total**: Up to 3x cost per request

**Mitigation**: Set appropriate max revisions based on quality/cost tradeoff.

### Latency Impact

- **Initial**: ~5-10 seconds
- **With 1 Revision**: ~10-20 seconds
- **With 3 Revisions**: ~20-40 seconds

**Mitigation**: 
- Use streaming for user feedback
- Show progress indicators
- Set timeout limits

## Recommended Settings

| Use Case | Max Revisions | Quality Threshold |
|----------|--------------|-------------------|
| Quick drafts | 1 | Low |
| Standard reports | 2 | Medium |
| Critical documents | 3 | High |
| Production content | 3 + Human review | Very High |

## Related Patterns

- **Circuit Breaker**: Stop revisions if repeated failures
- **Exponential Backoff**: Increase delay between revisions
- **Fallback Strategy**: Use simpler method after N failures
- **Human Escalation**: Route to human after max revisions

---

**Last Updated**: October 9, 2025  
**Implemented In**: `researcher-orchestrator` workflow  
**Status**: Production Ready 
