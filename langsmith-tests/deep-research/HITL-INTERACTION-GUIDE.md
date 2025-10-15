# LangSmith Interaction Guide for Deep-Research HITL

## Quick Answer: How to Interact with `clarify_with_user`

The `clarify_with_user` node in the deep-research workflow **does NOT use traditional `interrupt()`**. Instead, it conditionally routes to either:
- `__end__` (if clarification is needed) - workflow completes with a question
- `write_research_brief` (if clarification is not needed) - workflow continues to research

### To Continue After Clarification:

**You CANNOT use:** `new Command({ resume: "answer" })`

**Instead, submit a NEW invocation with updated messages:**

```json
{
  "messages": [
    {"type": "human", "content": "Original question"},
    {"type": "ai", "content": "Clarifying question from LLM"},
    {"type": "human", "content": "Your clarifying answer"}
  ],
  "configurable": {
    "thread_id": "same-thread-id-as-before"
  }
}
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCENARIO 1: Vague Question                   │
└─────────────────────────────────────────────────────────────────┘

USER INPUT:
┌──────────────────────────────────────┐
│ {                                    │
│   "messages": [                      │
│     {                                │
│       "type": "human",               │
│       "content": "Tell me about AI"  │
│     }                                │
│   ]                                  │
│ }                                    │
└──────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   __start__     │
         └─────────────────┘
                   │
                   ▼
      ┌──────────────────────────┐
      │  clarify_with_user       │
      │  (LLM analyzes message)  │
      └──────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │ need_clarify?  │
          └────────────────┘
                   │ YES
                   ▼
         ┌─────────────────┐
         │ Command({       │
         │   goto: __end__ │
         │ })              │
         └─────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │    __end__      │
         └─────────────────┘

WORKFLOW OUTPUT:
┌────────────────────────────────────────────────────┐
│ {                                                  │
│   "messages": [                                    │
│     {                                              │
│       "type": "human",                             │
│       "content": "Tell me about AI"                │
│     },                                             │
│     {                                              │
│       "type": "ai",                                │
│       "content": "Could you clarify which aspect   │
│                   of AI interests you?..."         │
│     }                                              │
│   ]                                                │
│ }                                                  │
└────────────────────────────────────────────────────┘
                   │
                   │ ⚠️ Workflow is COMPLETE (not paused)
                   │
                   ▼
USER CONTINUES (NEW INVOCATION):
┌─────────────────────────────────────────────────────┐
│ {                                                   │
│   "messages": [                                     │
│     {"type": "human", "content": "Tell me about AI"},│
│     {"type": "ai", "content": "Could you clarify..."},│
│     {"type": "human", "content": "Focus on EU regs"}│
│   ]                                                 │
│ }                                                   │
└─────────────────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   __start__     │
         └─────────────────┘
                   │
                   ▼
      ┌──────────────────────────┐
      │  clarify_with_user       │
      │  (LLM analyzes message)  │
      └──────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │ need_clarify?  │
          └────────────────┘
                   │ NO (sufficient context now)
                   ▼
         ┌─────────────────────────┐
         │ Command({               │
         │   goto: write_research  │
         │ })                      │
         └─────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   write_research_brief       │
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   supervisor (subgraph)      │
    │   - Parallel researchers     │
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   final_report_generation    │
    └──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │    __end__      │
         └─────────────────┘

FINAL OUTPUT:
┌────────────────────────────────────────────────────┐
│ {                                                  │
│   "messages": [...conversation history...],        │
│   "research_brief": "...",                         │
│   "notes": ["..."],                                │
│   "final_report": "# Comprehensive Report..."      │
│ }                                                  │
└────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────┐
│              SCENARIO 2: Detailed Question                      │
│              (or allow_clarification: false)                    │
└─────────────────────────────────────────────────────────────────┘

USER INPUT:
┌──────────────────────────────────────────────────────────┐
│ {                                                        │
│   "messages": [                                          │
│     {                                                    │
│       "type": "human",                                   │
│       "content": "Compare MLPerf v5.1 inference results  │
│                   for H100 vs B200 datacenter GPUs..."   │
│     }                                                    │
│   ],                                                     │
│   "configurable": {                                      │
│     "allow_clarification": false  // Optional           │
│   }                                                      │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   __start__     │
         └─────────────────┘
                   │
                   ▼
      ┌──────────────────────────┐
      │  clarify_with_user       │
      │  (LLM analyzes message)  │
      └──────────────────────────┘
                   │
                   ▼
          ┌────────────────┐
          │ need_clarify?  │
          └────────────────┘
                   │ NO (question is detailed)
                   ▼
         ┌─────────────────────────┐
         │ Command({               │
         │   goto: write_research  │
         │ })                      │
         └─────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   write_research_brief       │
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   supervisor (subgraph)      │
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │   final_report_generation    │
    └──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │    __end__      │
         └─────────────────┘

WORKFLOW OUTPUT:
┌────────────────────────────────────────────────────┐
│ {                                                  │
│   "messages": [                                    │
│     {                                              │
│       "type": "human",                             │
│       "content": "Compare MLPerf v5.1..."          │
│     },                                             │
│     {                                              │
│       "type": "ai",                                │
│       "content": "I'll conduct research on MLPerf  │
│                   benchmarks comparing H100 vs..." │
│     }                                              │
│   ],                                               │
│   "research_brief": "...",                         │
│   "notes": ["..."],                                │
│   "final_report": "# Comprehensive Report..."      │
│ }                                                  │
└────────────────────────────────────────────────────┘

✅ Research completed in single invocation
```

---

## Key Differences from Traditional `interrupt()`

| Aspect | Traditional `interrupt()` | Deep-Research `clarify_with_user` |
|--------|--------------------------|-----------------------------------|
| **Pauses execution?** | ✅ Yes - workflow is suspended | ❌ No - workflow completes |
| **State** | "interrupted" | "completed" |
| **Resume method** | `Command({ resume: value })` | New invocation with updated messages |
| **LangSmith UI** | Shows "Interrupted" status | Shows "Completed" status |
| **Interrupt queue** | ✅ Uses interrupt queue | ❌ No interrupt queue |
| **Message-based** | ❌ Separate from messages | ✅ Uses messages array |

---

## LangSmith Studio Interact Tab

### What You'll See When Clarification is Needed:

**1. Thread Status:**
```
Status: ✅ Completed
Last Node: __end__
```

**2. State View:**
```json
{
  "messages": [
    {"type": "human", "content": "Vague question"},
    {"type": "ai", "content": "Clarifying question"}
  ],
  "research_brief": null,
  "notes": [],
  "final_report": null
}
```

**3. Interrupts Panel:**
```
No interrupts (this pattern doesn't use interrupt())
```

**4. How to Continue:**
- Click "New Invocation" or refresh the input panel
- Paste the JSON with full message history + your response
- Submit as a new invocation

### What You'll See When Research Completes:

**1. Thread Status:**
```
Status: ✅ Completed
Last Node: __end__
```

**2. State View:**
```json
{
  "messages": [
    {"type": "human", "content": "Research question"},
    {"type": "ai", "content": "Verification message"},
    ... (other messages)
  ],
  "research_brief": "Research plan with topics...",
  "notes": ["Summarized research findings..."],
  "final_report": "# Comprehensive Report\n\n..."
}
```

**3. Trace View:**
- Expand to see full execution path
- Click on each node to inspect inputs/outputs
- View token usage and latency per node

---

## Common Mistakes

### ❌ Trying to Resume with Command
```typescript
// This WON'T work:
await graph.invoke(new Command({ resume: "My answer" }), config);
// Error: No interrupt to resume
```

### ✅ Correct: New Invocation with Messages
```typescript
// This WILL work:
await graph.invoke({
  messages: [
    ...previousMessages,
    new HumanMessage({ content: "My answer" })
  ]
}, config);
```

### ❌ Expecting "Interrupted" Status
```
LangSmith shows: "Completed" (not "Interrupted")
```

### ✅ Correct: Check Messages for Question
```typescript
// Check if last message is a clarifying question:
const lastMessage = state.messages[state.messages.length - 1];
if (lastMessage.type === "ai" && state.research_brief === null) {
  // Clarification was requested
}
```

---

## Testing Checklist

- [ ] Test vague question → clarification needed
- [ ] Verify workflow ends at `__end__` with AI question
- [ ] Continue with new invocation + updated messages
- [ ] Verify research proceeds after clarification
- [ ] Test detailed question → skips clarification
- [ ] Test with `allow_clarification: false`
- [ ] Check thread-level memory preservation
- [ ] View LangSmith traces for execution path
- [ ] Inspect state at each node
- [ ] Verify final report generation

---

## Summary

**The deep-research workflow's clarification pattern is NOT a traditional interrupt:**

1. **It conditionally routes** to `__end__` or `write_research_brief`
2. **It uses messages** for communication (not interrupt payloads)
3. **It completes naturally** (not suspended/paused)
4. **You continue by submitting** a new invocation with updated messages
5. **It's simpler** than traditional interrupts for message-based UIs

This design is intentional and works seamlessly with chat-based interfaces like LangSmith Studio.
