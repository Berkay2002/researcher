# Fix: Multiple Final Reports (SSE Reconnection After Completion)

## Problem

After the research completed successfully, the SSE client kept reconnecting and the server kept sending the final state repeatedly, resulting in multiple duplicate final reports being displayed:

```
[SSE] Starting stream for thread ...
[SSE] Thread ... already completed, sending final state
GET /api/stream/... 200 in 800ms
[SSE] Starting stream for thread ...
[SSE] Thread ... already completed, sending final state
GET /api/stream/... 200 in 918ms
(repeats continuously...)
```

## Root Cause

**Infinite reconnection loop after stream completion:**

1. Server sends final draft and "done" event
2. SSE client receives "done" event and sets `status = "completed"`
3. Page's `useEffect` evaluates SSE management logic:
   - `shouldStream = false` (because `isCompleted = true`)
   - `sseStream.status = "completed"` (not "idle")
   - Condition: `!shouldStream && status !== "idle"` → **TRUE**
   - Calls `sseStream.disconnect()`
4. `disconnect()` sets status back to `"idle"`
5. Next render cycle:
   - `shouldStream = false` still
   - `sseStream.status = "idle"` now
   - But `hasContent = true` (we have draft/research)
   - **BUG:** On next state update, `shouldStream` might become `true` again
   - Calls `sseStream.connect()`
6. Server sees thread is completed, sends final state again
7. Loop repeats indefinitely

The issue is that the page doesn't track that the stream has **permanently completed** and shouldn't reconnect.

## Solution

Added explicit check to prevent reconnection after stream completion:

```typescript
// Don't reconnect if stream has already completed
const isStreamCompleted = sseStream.status === "completed";

if (shouldStream && sseStream.status === "idle" && !isStreamCompleted) {
  // Connect only when thread is running and SSE is idle (and hasn't completed)
  sseStream.connect();
} else if (!shouldStream && sseStream.status !== "idle" && !isStreamCompleted) {
  // Disconnect when interrupted or completed (but don't disconnect if already completed)
  sseStream.disconnect();
}
```

### Key Changes:

1. **Added `isStreamCompleted` flag** - Checks if `sseStream.status === "completed"`
2. **Guard on connect** - Won't connect if stream has completed
3. **Guard on disconnect** - Won't disconnect if already completed (avoids status cycling)

## Why This Works

Once the SSE stream reaches "completed" status:
- It won't try to connect again (blocked by `!isStreamCompleted`)
- It won't call disconnect (which would reset to "idle")
- The status stays permanently at "completed"
- No more reconnection attempts

## Expected Behavior Now

1. ✅ Research completes successfully
2. ✅ Server sends final draft and "done" event
3. ✅ SSE client sets status to "completed"
4. ✅ Page displays final report
5. ✅ **No reconnection attempts** - status stays "completed"
6. ✅ User sees single final report

## Files Modified

- `src/app/research/[threadId]/page.tsx` - Added completion guard to SSE management

## Additional Notes

### Why Not Reset in disconnect()?

We could have prevented `disconnect()` from resetting to "idle" when completed, but that would affect other use cases. The current approach is more explicit and isolated to the page component.

### Alternative Approaches Considered

1. **Check `isCompleted` before connecting** - Not sufficient because completion status might change
2. **Use a separate "hasEverCompleted" ref** - More complex, current approach is simpler
3. **Don't call disconnect when completed** - Implemented this as well for safety

## Testing

1. Start a research thread in Plan mode
2. Answer all interrupt questions
3. Wait for research to complete
4. Verify you see **exactly one** final report
5. Check console logs - should NOT see repeated:
   - `[SSE] Starting stream for thread ...`
   - `[SSE] Thread ... already completed, sending final state`
