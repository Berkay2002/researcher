# Debugging Interrupt Detection Issue

## Problem
The state endpoint (`/api/threads/[threadId]/state`) is not detecting interrupts that the start endpoint finds, causing:
1. SSE client to continuously reconnect (thinking the thread is still running)
2. 409 responses spam in logs

## Current Status

### What We Know
- **Start route**: Successfully finds interrupt with "From tasks: FOUND"
- **State route**: Fails to find interrupt with "From tasks: null"
- Code appears identical between both routes after the parentheses fix

### Latest Changes

Added detailed logging to inspect the actual task structure:
```typescript
// Debug: Log detailed task structure
if (Array.isArray(snapshot.tasks) && snapshot.tasks.length > 0) {
  const firstTask = snapshot.tasks[0] as any;
  console.log("[API] State route tasks detail:", {
    firstTask: {
      keys: Object.keys(firstTask),
      hasInterrupts: 'interrupts' in firstTask,
      interruptsLength: firstTask.interrupts?.length ?? 0,
      interruptsValue: JSON.stringify(firstTask.interrupts),
    },
  });
}
```

Improved interrupt detection with multiple strategies:
```typescript
// Strategy 1: Check tasks array for interrupts
let interruptFromTasks: any = null;
if (Array.isArray(snapshot.tasks)) {
  const taskWithInterrupt = (snapshot.tasks as any[]).find(
    (t: any) => Array.isArray(t?.interrupts) && t.interrupts.length > 0
  );
  if (taskWithInterrupt) {
    // Try .value property first (wrapped format)
    interruptFromTasks = taskWithInterrupt.interrupts[0]?.value ?? taskWithInterrupt.interrupts[0] ?? null;
  }
}
```

## Next Steps

1. **Test the application** and check the new detailed logs
2. **Look for the new log line**: `[API] State route tasks detail:`
3. **Compare** the task structure between start route and state route
4. **Identify** why the interrupt detection differs

## Expected Logs to Collect

When you run the application and create a new Plan mode thread, look for:

```
[API] State route tasks detail: {
  firstTask: {
    keys: [...],
    hasInterrupts: true/false,
    interruptsLength: X,
    interruptsValue: "..."
  }
}
```

This will tell us:
- What keys are actually in the task object
- Whether the `interrupts` property exists
- How many interrupts are present
- The actual structure of the interrupts array

## Token Metadata Warnings

The warnings about `field[completion_tokens]` and `field[total_tokens]` are coming from **LangGraph itself**, not our application code. These are logged internally by LangGraph when it processes message chunks from the LLM.

**Options to address this:**
1. **Ignore them** - They're just warnings and don't affect functionality
2. **Filter via logging** - Configure logging to suppress these specific messages
3. **Wait for LangGraph update** - This might be fixed in a future version

For now, these are **cosmetic warnings** and can be safely ignored. They don't impact the interrupt detection or SSE streaming functionality.

## Files Modified
- `src/app/api/threads/[threadId]/state/route.ts` - Added detailed logging and improved interrupt detection
