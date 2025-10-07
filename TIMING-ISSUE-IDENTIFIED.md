# Current Status - Interrupt Timing Issue IDENTIFIED

## 🎯 Root Cause Found!

The logs clearly show the problem:

```javascript
[API] State route tasks detail: {
  firstTask: {
    hasInterrupts: true,
    interruptsLength: 0,      // ← EMPTY!
    interruptsValue: '[]'      // ← No interrupt yet!
  }
}
```

**The `interrupts` array exists but is EMPTY when the state endpoint reads it.**

## Why This Happens

### Sequence of Events:

1. **User clicks "Start Research"** in Plan mode
2. **Router immediately navigates** to `/research/[threadId]` page
3. **Page component mounts** and calls `useThreadState({ autoFetch: true })`
4. **State endpoint called** (Graph is still executing in background)
   - Reads `snapshot.tasks[0].interrupts` → `[]` (empty array)
   - Returns no interrupt
5. **Graph continues executing** in the start route
6. **Graph calls `interrupt()`** inside `hitlPlanner` node
7. **Interrupt is added** to `snapshot.tasks[0].interrupts` array
8. **Start route reads state** AFTER interrupt is added
   - Finds interrupt: "From tasks: FOUND"
   - Returns 202 with interrupt data

## The Problem

**Timing race condition:**
- State endpoint reads checkpoint BEFORE interrupt is persisted
- Start route reads checkpoint AFTER interrupt is persisted  
- Same thread, same checkpoint, different timing = different results

## Why SSE Loop Happens

1. State endpoint returns no interrupt
2. Page thinks thread should be streaming (`shouldStream = true`)
3. Page calls `sseStream.connect()`
4. SSE stream endpoint reads checkpoint and DOES find interrupt (by now it's persisted)
5. Returns 409
6. SSE client rate-limits but page keeps calling `connect()` based on stale state
7. Loop continues until state endpoint is refreshed

## Solutions

### ✅ Implemented: SSE Rate Limiting
Added 5-second delay between 409 retry attempts - **prevents tight loop**

### 🔄 Next Fix Needed: Prevent Premature SSE Connection

The page shouldn't try to connect while the graph is still in the initial execution phase.

#### Option A: Add "executing" state check
```typescript
const isExecuting = snapshot.next && snapshot.next.length > 0;
const hasEmptyInterruptsArray = 
  snapshot.tasks?.[0]?.interrupts?.length === 0;
const isProbablyWaitingForInterrupt = 
  isExecuting && hasEmptyInterruptsArray;

const shouldStream = 
  !hasInterrupt && 
  !isCompleted && 
  !isProbablyWaitingForInterrupt;  // ← New guard
```

#### Option B: Wait for start route to complete
Don't navigate to thread page until start route returns:
```typescript
// In research/new/page.tsx
const response = await fetch("/api/threads/start", ...);
// WAIT for response before navigating
if (response.ok) {
  router.push(`/research/${threadId}?goal=...`);
}
```

#### Option C: Refresh state after detecting execution
If state endpoint sees executing graph with empty interrupts, schedule a refresh:
```typescript
if (isExecuting && hasEmptyInterruptsArray) {
  setTimeout(() => refetch(), 1000); // Retry in 1 second
}
```

## Recommended Fix

**Combination approach:**

1. ✅ **Keep SSE rate limiting** (already done)
2. **Add guard in page component** to not connect while graph is in initial execution
3. **Add state refresh** in useThreadState when detecting pending interrupt

This will:
- Prevent SSE from trying to connect too early
- Automatically detect when interrupt is ready
- Stop the reconnection loop

## What to Look For Next

Continue running your test and collect the **full logs** including:

1. The **start route completion** log:
   ```
   [API] Start route interrupt detection results:
   - From tasks: FOUND
   POST /api/threads/start 202 in XXXXXms
   ```

2. **Subsequent state endpoint calls** after start completes:
   ```
   [API] State route tasks detail: {
     interruptsLength: 1,  // ← Should be 1 now!
   }
   ```

3. **SSE connection attempts** and whether they still loop:
   ```
   [useSSEStream] Skipping reconnect, too soon after 409
   ```

This will confirm if the rate limiting alone is sufficient, or if we need the additional guards.
