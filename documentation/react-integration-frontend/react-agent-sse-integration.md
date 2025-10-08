# React Agent SSE Integration Notes

## Overview

Enhanced the shared UI types and SSE stream hook to support the new ReAct agent alongside the existing research workflow. These updates ensure the frontend can differentiate agent flavors, parse new server-sent events, and surface agent-specific state such as todos and tool-call telemetry.

## `src/types/ui.ts`

- Exported React agent domain types (`TodoItem`, `ToolCallMetadata`, `SearchRunMetadata`) for reuse on the client.
- Introduced `ThreadAgentType`, `WorkflowThreadValues`, `ReactAgentThreadValues`, and `ThreadStateValues` so `ThreadStateSnapshot` can represent either agent.
- Added helpers (`isWorkflowThreadStateSnapshot`, `isReactAgentThreadStateSnapshot`, `inferThreadAgentType`) for differentiating snapshots by explicit metadata or structural hints.
- Extended SSE event enums and payload-normalization utilities to include agent-centric event channels: `messages`, `todos`, `tool_calls`, and `search_runs`.
- Hardened normalization logic with lightweight guards that validate todo, tool-call, and search-run payloads before casting.

## `src/lib/hooks/use-sse-stream.ts`

- Updated the stream state to store agent message batches, todo lists, tool calls, and search runs emitted by the React agent.
- Registered handlers for the new SSE event types and wired them into the hook’s state transitions.
- Ensured the connection bootstrap subscribes to the broader event matrix so future agent additions do not require hook rewrites.
- Preserved existing workflow behavior (draft streaming, run log, evidence collection) with no breaking API changes for components already consuming the hook.

## Next Steps

- Build UI components that consume `agentMessages`, `todos`, `toolCalls`, and `searchRuns` from the hook.
- Consider promoting `ThreadAgentType` usage across thread-list and page routing logic to simplify agent-specific rendering decisions.
  Actually agentMessages should be used as AI messages in ´research/[threadId]/page.tsx´
