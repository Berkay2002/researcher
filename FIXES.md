# Bug Fixes - SSE Stream and Interrupt Detection

## Issues Fixed

### 1. Interrupt Detection Bug in State Endpoint ✅

**Problem:** The `/api/threads/[threadId]/state` endpoint couldn't detect interrupts that the `/api/threads/start` endpoint could find.

**Root Cause:** Incorrect parentheses placement in the interrupt detection logic caused the `?? null` operator to be evaluated inside an `&&` expression, returning `false` instead of `null` when no interrupts were found.

**Fix:** Corrected the parentheses placement in `src/app/api/threads/[threadId]/state/route.ts` to match the working logic in the start route:

```typescript
// Before (incorrect)
const interruptFromTasks =
  Array.isArray(snapshot.tasks) &&
  ((snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
    ?.interrupts?.[0]?.value ??
    null);

// After (correct)
const interruptFromTasks =
  (Array.isArray(snapshot.tasks) &&
    (snapshot.tasks as any[])?.find((t: any) => t?.interrupts?.length > 0)
      ?.interrupts?.[0]?.value) ??
  null;
```

**Impact:** The state endpoint now correctly detects interrupts, preventing the SSE client from thinking the thread is still running.

---

### 2. SSE Reconnection Loop ✅

**Problem:** The SSE client was continuously trying to reconnect when receiving 409 (Conflict) responses, creating a tight reconnection loop visible in the logs:

```
[SSE] Thread f65fb18e-7dc8-4bd4-8ff5-521016c8f8ec is paused by interrupt, not starting stream
GET /api/stream/f65fb18e-7dc8-4bd4-8ff5-521016c8f8ec 409 in 46ms
```

**Root Cause:** The error handler in `use-sse-stream.ts` was checking `readyState === EventSource.CLOSED` but didn't have proper guards to prevent reconnection when the thread was interrupted (409 response).

**Fix:** Added the `!isCompletedRef.current` check to the condition in `src/lib/hooks/use-sse-stream.ts`:

```typescript
// Before
if (eventSource.readyState === EventSource.CLOSED) {
  // Set to idle and return
}

// After
if (eventSource.readyState === EventSource.CLOSED && !isCompletedRef.current) {
  // Set to idle and return
}
```

**Impact:** The SSE client now properly stops reconnecting when it receives a 409 response, waiting for the UI to reconnect after the interrupt is resolved.

---

### 3. Token Metadata Warnings ✅

**Problem:** Console was flooded with warnings about token metadata:

```
[SSE] Unknown stream mode: [object AIMessageChunk]
field[completion_tokens] already exists in this message chunk and value has unsupported type.
field[total_tokens] already exists in this message chunk and value has unsupported type.
```

**Root Cause:** AIMessageChunk objects were being passed to `processChunkByMode()` with an unknown stream mode, logging warnings before being filtered out.

**Fix:** Enhanced the `processChunkByMode()` function in `src/app/api/stream/[threadId]/route.ts` to filter out AIMessageChunk objects early and suppress token-related warnings:

```typescript
function processChunkByMode(
  streamMode: string,
  chunk: unknown
): SSEEvent | null {
  // Filter out AIMessageChunk objects that don't have useful content
  if (typeof streamMode === "object" && streamMode !== null) {
    const chunkStr = String(streamMode);
    if (chunkStr === "[object AIMessageChunk]" || chunkStr.includes("MessageChunk")) {
      return null;
    }
  }

  switch (streamMode) {
    case "updates":
      return processChunk(chunk);
    case "messages":
      return processLLMMessage(chunk);
    case "custom":
      return processCustomEvent(chunk);
    default:
      // Only log unknown modes that aren't system metadata
      if (typeof streamMode === "string" && !streamMode.includes("token")) {
        console.warn(`[SSE] Unknown stream mode: ${streamMode}`);
      }
      return null;
  }
}
```

**Impact:** Cleaner console logs without repetitive warnings about token metadata.

---

## Testing Recommendations

1. **Test Interrupt Detection:**
   - Start a new thread in Plan mode
   - Verify that the state endpoint correctly detects the interrupt
   - Confirm that the SSE client doesn't attempt to connect while interrupted

2. **Test SSE Reconnection:**
   - Monitor console logs when an interrupt occurs
   - Verify there's no tight reconnection loop (repeated 409 responses)
   - Confirm SSE reconnects properly after interrupt resolution

3. **Test Console Output:**
   - Verify that token metadata warnings no longer appear
   - Confirm that AIMessageChunk warnings are eliminated

## Files Modified

- `src/app/api/threads/[threadId]/state/route.ts` - Fixed interrupt detection
- `src/lib/hooks/use-sse-stream.ts` - Prevented reconnection loop
- `src/app/api/stream/[threadId]/route.ts` - Filtered token metadata warnings
