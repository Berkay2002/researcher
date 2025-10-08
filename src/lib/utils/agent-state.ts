/**
 * Agent State Utilities
 *
 * Helper functions to extract and transform agent state from LangGraph SDK's
 * ThreadState into typed, UI-friendly formats.
 */

import type {
  ReactAgentState,
  SearchRunMetadata,
  TodoItem,
  ToolCallMetadata,
} from "@/server/types/react-agent";

/**
 * Type guard to check if an object has a specific property
 */
function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * Extract todos from SDK state values
 */
export function extractTodos(state: unknown): TodoItem[] {
  if (!hasProperty(state, "todos")) {
    return [];
  }

  const todos = state.todos;
  if (!Array.isArray(todos)) {
    return [];
  }

  return todos.filter(
    (todo): todo is TodoItem =>
      typeof todo === "object" &&
      todo !== null &&
      "id" in todo &&
      "title" in todo &&
      "status" in todo
  );
}

/**
 * Extract tool calls from SDK state values
 */
export function extractToolCalls(state: unknown): ToolCallMetadata[] {
  if (!hasProperty(state, "recentToolCalls")) {
    return [];
  }

  const toolCalls = state.recentToolCalls;
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls.filter(
    (call): call is ToolCallMetadata =>
      typeof call === "object" &&
      call !== null &&
      "toolName" in call &&
      "invokedAt" in call
  );
}

/**
 * Extract search runs from SDK state values
 */
export function extractSearchRuns(state: unknown): SearchRunMetadata[] {
  if (!hasProperty(state, "searchRuns")) {
    return [];
  }

  const searchRuns = state.searchRuns;
  if (!Array.isArray(searchRuns)) {
    return [];
  }

  return searchRuns.filter(
    (run): run is SearchRunMetadata =>
      typeof run === "object" &&
      run !== null &&
      "query" in run &&
      "provider" in run
  );
}

/**
 * Extract full agent state from SDK ThreadState
 */
export function extractAgentState(state: unknown): {
  todos: TodoItem[];
  toolCalls: ToolCallMetadata[];
  searchRuns: SearchRunMetadata[];
} {
  return {
    todos: extractTodos(state),
    toolCalls: extractToolCalls(state),
    searchRuns: extractSearchRuns(state),
  };
}

/**
 * Check if the state matches the ReactAgentState structure
 */
export function isValidAgentState(state: unknown): state is ReactAgentState {
  if (!state || typeof state !== "object") {
    return false;
  }

  return (
    hasProperty(state, "messages") &&
    Array.isArray(state.messages) &&
    hasProperty(state, "todos") &&
    Array.isArray(state.todos) &&
    hasProperty(state, "recentToolCalls") &&
    Array.isArray(state.recentToolCalls) &&
    hasProperty(state, "searchRuns") &&
    Array.isArray(state.searchRuns)
  );
}
