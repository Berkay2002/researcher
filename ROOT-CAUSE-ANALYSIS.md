# Summary: SSE Reconnection Loop Root Cause Analysis

## Timeline of Events (from logs)

1. **Router navigates** to `/research/[threadId]` immediately after starting thread
2. **State endpoint called** multiple times while graph is still executing
   - Finds no interrupt (graph hasn't reached interrupt() call yet)
3. **Start route completes** after ~36 seconds
   - Finds interrupt: "From tasks: FOUND"
4. **SSE endpoint** tries to connect
   - Gets 409 (interrupt detected by stream endpoint)
5. **SSE reconnection loop** begins
   - State endpoint still returns no interrupt
   - Page thinks thread should be streaming
   - Tries to connect, gets 409, repeats

## Root Cause

**The state endpoint cannot see the interrupt that the start route created**, even after the start route completes. This suggests one of:

1. **Checkpoint persistence delay** - The interrupt isn't fully persisted to Postgres when state endpoint reads it
2. **Different checkpoint versions** - Start route sees latest, state route sees older cached version  
3. **Race condition** - State endpoint reads between checkpoint writes
4. **Task structure difference** - The `tasks` array structure differs between invoke() result and getState() result

## Evidence

### Start Route (WORKS)
```typescript
const snapshot = await graph.getState({ configurable: { thread_id: threadId } });
// Called immediately after graph.invoke() completes
// Result: "From tasks: FOUND"
```

### State Route (FAILS)
```typescript
const snapshot = await graph.getState({ configurable: { thread_id: threadId } });
// Called anytime via HTTP endpoint
// Result: "From tasks: null"
```

**Same code, same thread_id, different results!**

## Potential Solutions

### Option 1: Force Checkpoint Refresh
Add explicit checkpoint reload in state endpoint:
```typescript
// Force fresh read from database
const snapshot = await graph.getState({
  configurable: { 
    thread_id: threadId,
    // Force reload from DB, not cache
  },
});
```

### Option 2: Check Stream Endpoint Logic
The stream endpoint DOES detect the interrupt correctly (returns 409). Copy its detection logic:
```typescript
const hasInterrupt =
  (Array.isArray(snapshot.tasks) &&
    snapshot.tasks.some(
      (t: any) => Array.isArray(t.interrupts) && t.interrupts.length > 0
    )) ||
  // ... other checks
```

### Option 3: Add Delay After Start
Wait for checkpoint to fully persist before allowing state reads:
```typescript
// In start route after finding interrupt
await new Promise(resolve => setTimeout(resolve, 100));
```

### Option 4: Trust Start Route Response
In the page component, trust the interrupt from the start route response instead of polling state:
```typescript
if (response.status === 202 && data.interrupt) {
  // Set interrupt state immediately, don't wait for state endpoint
  setCurrentInterrupt(data.interrupt);
}
```

## Next Action

**Test with detailed logging** to see the actual task structure difference between start and state routes. The new logging will show us the exact content of `snapshot.tasks[0]`.

Look for the log line:
```
[API] State route tasks detail: { firstTask: { ... } }
```

This will reveal why the same code produces different results.
