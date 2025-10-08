# React Agent Integration Plan

## Overview

This document outlines the plan to fully integrate the LangGraph SDK to replace the custom React agent implementation in the frontend.

## Current State Analysis

- The project already has partial LangGraph SDK integration
- `StreamProvider` is using the `useStream` hook from `@langchain/langgraph-sdk/react`
- `ThreadProvider` is using the SDK client for thread management
- The agent page is already using the SDK stream data
- Configuration supports both SDK and custom approaches via `useSDK` flag
- There's a missing `react-agent.ts` types file that's referenced but doesn't exist

## Implementation Tasks

### 1. Create Missing Types File

**File**: `src/server/types/react-agent.ts`

- Define `TodoItem` type referenced in `src/server/shared/tools/todo-list.ts`
- Define `ToolCallMetadata` and `SearchRunMetadata` types referenced in `src/types/ui.ts`
- Define `ReactAgentState` type referenced in `src/types/ui.ts`

```typescript
export interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "completed";
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ToolCallMetadata {
  toolName: string;
  invokedAt: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

export interface SearchRunMetadata {
  query: string;
  provider: "tavily" | "exa";
  startedAt: string;
  completedAt?: string;
  results?: number;
  error?: string;
}

export interface ReactAgentState {
  messages: unknown[];
  todos: TodoItem[];
  recentToolCalls: ToolCallMetadata[];
  searchRuns: SearchRunMetadata[];
  context?: {
    sessionId?: string;
    userId?: string;
    locale?: string;
  };
}
```

### 2. Update StreamProvider

**File**: `src/lib/providers/stream-provider.tsx`

- Already using `useStream` hook from SDK
- Minor updates needed to ensure full compatibility
- Add proper error handling for SDK-specific errors
- Ensure stream modes are configured correctly

### 3. Update ThreadProvider

**File**: `src/lib/providers/thread-provider.tsx`

- Already using SDK client
- Verify all methods are using SDK properly
- Add proper error handling for SDK-specific errors

### 4. Update Agent Page

**File**: `src/app/agent/[threadId]/page.tsx`

- Already using SDK stream data
- Ensure proper handling of SDK message format
- Update any remaining custom SSE handling

### 5. Update Configuration

**File**: `src/lib/config/langgraph.ts`

- Set `useSDK: true` by default
- Ensure proper stream modes for SDK
- Update default configuration to favor SDK

### 6. Create Backend React Agent (Optional)

If a React agent graph is not already deployed:
**File**: `src/server/agents/react/graph.ts`

- Create a basic React agent using LangGraph
- Include tools for todo management, search, etc.
- Deploy to LangGraph server

### 7. Clean Up

- Remove any unused custom SSE implementation code
- Remove unused types and interfaces
- Update imports to use SDK types where appropriate

## Implementation Details

### Stream Provider Updates

The StreamProvider is already using the SDK's `useStream` hook, which is good. We just need to ensure:

- Proper configuration of stream modes
- Error handling for SDK-specific errors
- Compatibility with the agent page

### Thread Provider Updates

The ThreadProvider is already using the SDK client. We need to verify:

- All CRUD operations are using SDK methods
- Proper error handling
- Type compatibility

### Configuration Updates

```typescript
export const DEFAULT_LANGGRAPH_CONFIG: Partial<LangGraphConfigType> = {
  useSDK: true, // Changed from false to true
  enableAuth: false,
  apiUrl: "http://localhost:2024",
  assistantId: "agent",
  streamMode: ["updates", "messages", "custom"] as const,
};
```

## Testing Strategy

1. Test thread creation and management
2. Test message streaming with SDK
3. Test error handling
4. Test UI updates with SDK data
5. Verify all existing functionality still works

## Migration Steps

1. Create missing types file
2. Update configuration to use SDK by default
3. Update providers for better SDK integration
4. Test all functionality
5. Clean up unused code
6. Update documentation

## Notes

- The project is already well-structured for SDK integration
- Most components are already using the SDK
- The main work is completing the integration and cleaning up
- The proxy route at `/api/langgraph/[..._path]/route.ts` is correctly set up
