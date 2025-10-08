# LangGraph SDK Integration for React Agent

This document describes the integration of the LangGraph SDK in the React Agent frontend.

## Overview

The React Agent now fully uses the `@langchain/langgraph-sdk` for all streaming and thread management operations, replacing the custom SSE (Server-Sent Events) implementation.

## Key Components

### 1. StreamProvider (`src/lib/providers/stream-provider.tsx`)

The StreamProvider wraps the LangGraph SDK's `useStream` hook and provides:

- **Message Streaming**: Automatically streams messages from the LangGraph server
- **State Management**: Maintains the current agent state (todos, tool calls, search runs)
- **Error Handling**: Centralized error handling with callbacks
- **Event Processing**: Handles updates, custom events, and metadata events

```tsx
import { StreamProvider } from "@/lib/providers/stream-provider";

<StreamProvider threadId={threadId}>
  <YourComponent />
</StreamProvider>
```

### 2. ThreadProvider (`src/lib/providers/thread-provider.tsx`)

The ThreadProvider uses the LangGraph SDK client for thread management:

- **Thread CRUD**: Create, read, update, and delete threads
- **Thread Listing**: Fetch and search threads
- **SDK Integration**: Uses `client.threads.*` methods from the SDK

```tsx
import { ThreadProvider, useThreads } from "@/lib/providers/thread-provider";

const { getThreads, createThread, deleteThread } = useThreads();
```

### 3. Agent State Types (`src/server/types/react-agent.ts`)

Aligned with LangGraph SDK's message and state structure:

```typescript
export type ReactAgentState = {
  messages: Message[];  // SDK Message type
  todos: TodoItem[];
  recentToolCalls: ToolCallMetadata[];
  searchRuns: SearchRunMetadata[];
  context?: ReactAgentContext;
};
```

### 4. State Extraction Utilities (`src/lib/utils/agent-state.ts`)

Helper functions to extract typed data from SDK ThreadState:

```typescript
import { extractTodos, extractToolCalls, extractSearchRuns } from "@/lib/utils/agent-state";

const todos = extractTodos(stream.values);
const toolCalls = extractToolCalls(stream.values);
const searchRuns = extractSearchRuns(stream.values);
```

## Agent Page Implementation

The agent page (`src/app/agent/[threadId]/page.tsx`) demonstrates the complete SDK integration:

### Message Handling

```tsx
// SDK provides messages array with proper typing
const conversationMessages = useMemo(() => {
  return stream.messages
    .filter(msg => msg.type === "human" || msg.type === "ai")
    .map((message, index) => {
      const metadata = stream.getMessagesMetadata(message, index);
      const content = extractMessageContent(message.content);
      
      return {
        id: message.id || `message-${index}`,
        role: message.type === "human" ? "user" : "assistant",
        content,
        metadata,
      };
    });
}, [stream.messages, stream.getMessagesMetadata]);
```

### State Extraction

```tsx
// Extract agent-specific state from SDK stream values
const agentState = useMemo(
  () => ({
    todos: stream.values?.todos || [],
    toolCalls: stream.values?.recentToolCalls || [],
    searchRuns: stream.values?.searchRuns || [],
  }),
  [stream.values]
);
```

### Sending Messages

```tsx
// Submit new messages using SDK
await stream.submit({
  messages: [
    {
      type: "human",
      content: message.text,
    },
  ],
});
```

## SDK Features Used

### From `useStream` Hook

- **values**: Current thread state
- **messages**: Array of SDK Message objects
- **getMessagesMetadata**: Get metadata for messages (branch info, etc.)
- **submit**: Send new input to the thread
- **stop**: Stop the current stream
- **isLoading**: Loading state for streaming
- **error**: Error state
- **history**: Full thread state history
- **client**: LangGraph client instance

### From SDK Client

- **threads.search()**: List threads
- **threads.create()**: Create new thread
- **threads.delete()**: Delete thread
- **threads.get()**: Get thread details

## Configuration

Set environment variables for SDK configuration:

```env
# LangGraph API URL
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024

# Assistant ID
NEXT_PUBLIC_ASSISTANT_ID=agent

# API Key (optional, can be set in localStorage)
LANGGRAPH_API_KEY=your-api-key
```

## Message Types from SDK

The SDK provides typed message structures:

```typescript
// Human message
{
  type: "human",
  content: string | ContentBlock[],
  id?: string,
  name?: string,
}

// AI message with tool calls
{
  type: "ai",
  content: string | ContentBlock[],
  tool_calls?: ToolCall[],
  usage_metadata?: UsageMetadata,
  id?: string,
}

// Tool message
{
  type: "tool",
  content: string,
  tool_call_id: string,
  status?: "success" | "error",
}
```

## Stream Events

The SDK streams various event types:

- **values**: Complete state after each step
- **updates**: Partial updates from nodes
- **messages**: Message chunks from LLM
- **metadata**: Run and thread metadata
- **custom**: Custom events from your graph
- **error**: Error information

## Migration from SSE

The old SSE types are deprecated but maintained for backward compatibility with the researcher workflow:

```typescript
// ❌ Old SSE approach (deprecated for React agent)
export type MessagesEvent = SSEEvent<{ messages: unknown[] }>;

// ✅ New SDK approach
import { Message } from "@langchain/langgraph-sdk";
const messages: Message[] = stream.messages;
```

## Testing

Verify the integration:

1. **Thread Creation**: Create a new thread and verify it appears in the list
2. **Message Streaming**: Send a message and verify it streams correctly
3. **State Updates**: Verify todos, tool calls, and search runs update properly
4. **Error Handling**: Test error scenarios and verify error display
5. **Thread Management**: Test thread deletion and navigation

## Troubleshooting

### Messages not displaying

Check that:

- The assistant ID matches your deployed graph
- The API URL is correct
- Messages are being extracted with the correct filter

### State not updating

Verify:

- Your graph is emitting state updates in the correct format
- The state keys match (`todos`, `recentToolCalls`, `searchRuns`)
- Stream callbacks are properly configured

### Connection errors

Ensure:

- LangGraph server is running
- API URL is accessible
- API key is valid (if using authentication)

## Next Steps

- Implement reconnection logic for dropped connections
- Add optimistic UI updates for better UX
- Implement message editing and regeneration
- Add support for file uploads through SDK
- Implement branch navigation using SDK's branch features

## References

- [LangGraph SDK Documentation](https://langchain-ai.github.io/langgraph/cloud/reference/sdk/)
- [LangGraph React Hooks](https://langchain-ai.github.io/langgraph/cloud/reference/sdk/react/)
- [Streaming Documentation](https://langchain-ai.github.io/langgraph/cloud/how-tos/stream/)
