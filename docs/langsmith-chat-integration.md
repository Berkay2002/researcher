# LangSmith Chat Integration for LangGraph Applications

**Date**: October 9, 2025  
**LangGraph Version**: 1.0.0-alpha.5  
**Status**: ✅ Implemented and Verified

## Overview

This document captures critical findings about integrating LangSmith Chat with LangGraph applications, based on research into the `@langchain/langgraph` node_modules and official documentation.

## Key Requirements for LangSmith Chat

### 1. MessagesAnnotation is REQUIRED

LangSmith's chat interface specifically looks for graphs that use the **standard `MessagesAnnotation`** helper, not just a manually-defined messages channel.

**Wrong Approach:**
```typescript
export const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  // ... other fields
});
```

**✅ Correct Approach:**
```typescript
import { MessagesAnnotation } from "@langchain/langgraph";

export const StateAnnotation = Annotation.Root({
  // Extend MessagesAnnotation for LangSmith Chat compatibility
  ...MessagesAnnotation.spec,
  
  // ... your custom fields
  threadId: Annotation<string>({ ... }),
  userInputs: Annotation<UserInputs>({ ... }),
});
```

**Why this matters:**
- LangSmith Studio checks for the specific `MessagesAnnotation.spec` structure
- This provides standardized message handling that the UI expects
- Without it, you'll see: "Create a graph with a messages key to chat with."

### 2. Nodes Must Return AIMessage Objects

**❌ Wrong:**
```typescript
return { 
  draft: { text: "My response" }  // Plain text/object
};
```

**✅ Correct:**
```typescript
import { AIMessage } from "@langchain/core/messages";

return { 
  draft: myDraft,
  messages: [new AIMessage({
    content: myDraft.text,
    additional_kwargs: {
      citations: [...],
      confidence: 0.95,
    }
  })]
};
```

**Key Points:**
- Always append `AIMessage` to messages array
- Use `additional_kwargs` for metadata (citations, confidence, etc.)
- The reducer automatically merges messages (don't replace, append)

### 3. Support Messages-Only Input

Your graph should work with just a `messages` array as input:

```typescript
// LangSmith will send this format
{
  "messages": [
    {
      "type": "human",
      "content": "Research AI chips"
    }
  ]
}
```

**Implementation Pattern:**
```typescript
export async function entryNode(state: ParentState) {
  // Extract goal from messages if userInputs not provided
  let userInputs = state.userInputs || { goal: "" };
  
  if (!userInputs.goal && state.messages?.length > 0) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (typeof lastMessage.content === "string") {
      userInputs = {
        ...userInputs,
        goal: lastMessage.content
      };
    }
  }
  
  // Validate
  if (!userInputs.goal) {
    throw new Error("No goal in userInputs or messages");
  }
  
  // Process...
}
```

### 4. Optional State Fields Need Defaults

For LangSmith chat to work without full state objects:

```typescript
export const ParentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  userInputs: Annotation<UserInputs>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({ goal: "" }),  // ← REQUIRED for chat
  }),
  
  plan: Annotation<Plan | null>({
    reducer: (_, next) => next,
    default: () => null,  // ← Makes it optional
  }),
});
```

## Critical Findings from node_modules

### MessagesAnnotation.spec Structure

From `@langchain/langgraph/dist/graph/messages_annotation.d.ts`:

```typescript
export const MessagesAnnotation: {
  spec: {
    messages: Annotation<BaseMessage[]>;
  };
  State: {
    messages: BaseMessage[];
  };
};
```

**Key Insight:** Use `MessagesAnnotation.spec` with spread operator to properly extend it.

### messagesStateReducer Behavior

From `@langchain/langgraph/dist/graph/message.js`:

```typescript
export const messagesStateReducer = (left, right) => {
  // Handles message merging, deduplication, and special operations
  // - Concatenates message arrays
  // - Handles REMOVE_ALL_MESSAGES sentinel
  // - Supports message ID-based updates
  return [...left, ...right];  // Simplified
};
```

**Key Insight:** Never replace messages array, always append.

### Checkpointer Integration

From `@langchain/langgraph-checkpoint-postgres`:

```typescript
export class PostgresSaver extends BaseCheckpointSaver {
  static fromConnString(connectionString: string): PostgresSaver;
  
  // Automatically persists state at each node
  // Supports time-travel and HITL interrupts
}
```

**Key Insight:** Checkpointer inherits to subgraphs automatically.

## Implementation Checklist

- [x] State uses `...MessagesAnnotation.spec`
- [x] All response nodes append `AIMessage` to messages
- [x] Entry node extracts goal from messages
- [x] Optional fields have `default` functions
- [x] AIMessages include metadata in `additional_kwargs`
- [x] Graph compiled with PostgresSaver checkpointer
- [x] Thread ID included in all invocations

## Testing in LangSmith Studio

1. **Start LangGraph Server:**
   ```bash
   npm run dev:langgraph
   ```

2. **Open LangSmith Studio:** `http://localhost:2024`

3. **Test with Messages-Only Input:**
   ```json
   {
     "messages": [
       "Give me a detailed analysis of AI chip market"
     ]
   }
   ```

4. **Verify Response:**
   - Check that AIMessage appears in messages array
   - Verify metadata in `additional_kwargs`
   - Confirm citations are included

## Common Pitfalls

### Pitfall 1: Manual Message Channel
Using `messagesStateReducer` directly instead of `MessagesAnnotation.spec`

### Pitfall 2: Returning Plain Strings
Returning text directly instead of wrapping in `AIMessage`

### Pitfall 3: No Default Values
Not providing defaults for optional state fields

### Pitfall 4: Replacing Messages Array
Setting `messages: [new AIMessage(...)]` instead of returning array to append

### Pitfall 5: Missing Thread ID
Not providing `thread_id` in config (required for checkpointing)

## Advanced Patterns

### Multi-Turn Conversations

```typescript
// Messages accumulate automatically via reducer
const result = await graph.invoke(
  { 
    messages: [new HumanMessage("Follow-up question")] 
  },
  { 
    configurable: { thread_id: "same-thread-123" }  // Same thread!
  }
);

// Previous messages are preserved via checkpointer
```

### Structured Metadata

```typescript
return {
  messages: [new AIMessage({
    content: report,
    additional_kwargs: {
      // LangSmith displays these in UI
      citations: citations.map(c => ({
        id: c.id,
        url: c.url,
        title: c.title,
      })),
      confidence: 0.95,
      sources_count: 15,
      research_depth: "comprehensive",
      // Custom app data
      isRevision: false,
      revisionCount: 0,
    }
  })]
};
```

### Conditional AI Responses

```typescript
if (needsMoreResearch) {
  return {
    messages: [new AIMessage({
      content: "I need to research more before answering.",
      additional_kwargs: {
        needsUserInput: true,
        missingInfo: ["budget", "timeline"],
      }
    })]
  };
}
```

## Related Documentation

- [LangGraph Messages Documentation](../documentation/langgraph/08-manage-memory.md)
- [LangGraph HITL Patterns](../documentation/langgraph/07-human-in-the-loop.md)
- [State Management Best Practices](../documentation/langgraph/03-workflow-and-agents.md)

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| @langchain/langgraph | 1.0.0-alpha.5 | MessagesAnnotation available |
| @langchain/core | 1.0.0-alpha.6 | AIMessage, HumanMessage types |
| @langchain/langgraph-checkpoint-postgres | 0.1.2 | PostgresSaver |

## Future Considerations

1. **Streaming Support**: Consider implementing streaming responses for real-time updates
2. **Message Trimming**: For long conversations, implement message window/summarization
3. **Rich Content**: Explore multimodal messages (images, files) support
4. **Message Editing**: Support for editing/deleting messages in conversation history

---

**Last Updated**: October 9, 2025  
**Maintained By**: Research Team  
**Status**: Production Ready ✅
