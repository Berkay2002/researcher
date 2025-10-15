# Deep Research Workflow - LangSmith Interaction Examples

This folder contains examples demonstrating different interaction patterns with the `deep-research` workflow, particularly focusing on the Human-in-the-Loop (HITL) clarification step.

## Files Overview

### 1. `01-initial-vague-request.json`
**Scenario:** User submits a vague research question  
**Expected Behavior:** The `clarify_with_user` node will detect ambiguity and end the workflow with a clarifying question

**What happens:**
- Workflow executes: `__start__` → `clarify_with_user` → `__end__`
- Output includes an AI message with a structured clarifying question
- Workflow completes (does not continue to research)

**How to use in LangSmith:**
1. Paste this JSON into the LangSmith Studio Input panel
2. Submit the invocation
3. Check the output `messages` array - you'll see an AI response asking for clarification
4. The workflow is now complete; to continue, submit the next example (02)

---

### 2. `02-after-clarification.json`
**Scenario:** User provides clarifying details after initial question  
**Expected Behavior:** The workflow proceeds to research with sufficient context

**What happens:**
- Message history includes: Original question → AI clarification → User's detailed response
- Workflow executes: `__start__` → `clarify_with_user` → `write_research_brief` → `supervisor` → `final_report_generation` → `__end__`
- Full research is conducted and a comprehensive report is generated

**How to use in LangSmith:**
1. After running example 01, paste this JSON as a **new invocation**
2. Use the **same thread_id** to maintain context (if using thread-level memory)
3. Or use a different thread_id if you want to test independently
4. The workflow will now proceed to full research

---

### 3. `03-detailed-no-clarification.json`
**Scenario:** User provides a detailed, unambiguous research question  
**OR** Clarification is disabled via configuration  
**Expected Behavior:** Workflow skips clarification and proceeds directly to research

**What happens:**
- Workflow executes: `__start__` → `clarify_with_user` → `write_research_brief` → `supervisor` → `final_report_generation` → `__end__`
- No clarifying question is asked
- Research begins immediately

**How to use in LangSmith:**
1. Paste this JSON into LangSmith Studio
2. Submit the invocation
3. Full research proceeds without interruption

---

## Understanding the Clarification Pattern

### Important: NOT a Traditional `interrupt()`

The `clarify_with_user` node in the deep-research workflow does **NOT** use the traditional `interrupt()` function. Instead, it uses a **conditional routing pattern**:

```typescript
// In clarify_with_user node:
if (response.need_clarification) {
  return new Command({
    goto: "__end__",  // End the workflow here
    update: {
      messages: [new AIMessage({ content: response.question })]
    }
  });
}

// Otherwise, proceed to research
return new Command({
  goto: "write_research_brief",
  update: {
    messages: [new AIMessage({ content: response.verification })]
  }
});
```

### Key Implications

1. **No Pause/Resume with `Command({ resume })`**  
   Unlike the traditional `interrupt()` pattern, you cannot resume with `new Command({ resume: "user input" })`

2. **Workflow Completes at `__end__`**  
   When clarification is needed, the workflow ends naturally with a question in the messages

3. **Continue by Re-Invoking with Updated Messages**  
   To continue after clarification:
   - Copy the full message history from the output
   - Add a new human message with the user's clarification
   - Submit as a **new invocation** (not a resume command)

4. **Thread Memory is Preserved**  
   If using the same `thread_id`, state is maintained across invocations via `MemorySaver`

---

## Testing in LangSmith Studio

### Scenario A: Clarification Needed (Interactive Flow)

**Step 1: Initial Submission**
```bash
Input: examples/01-initial-vague-request.json
Action: Submit
Result: Workflow ends with AI clarifying question
```

**Step 2: Check Output**
```json
{
  "messages": [
    {
      "type": "human",
      "content": "I need research on AI benchmarks"
    },
    {
      "type": "ai",
      "content": "I'd like to clarify your research scope..."
    }
  ]
}
```

**Step 3: Continue with Clarification**
```bash
Input: examples/02-after-clarification.json
Action: Submit (as new invocation)
Result: Full research workflow executes
```

---

### Scenario B: No Clarification Needed (Direct Flow)

**Single Submission**
```bash
Input: examples/03-detailed-no-clarification.json
Action: Submit
Result: Full research workflow executes immediately
```

---

## Configuration Options for Testing

### Enable/Disable Clarification
```json
{
  "configurable": {
    "allow_clarification": true  // or false to skip
  }
}
```

### Adjust Research Depth
```json
{
  "configurable": {
    "max_concurrent_research_units": 3,  // Parallel researchers (1-20)
    "max_researcher_iterations": 4       // Research depth per topic (1-10)
  }
}
```

### Change Search Provider
```json
{
  "configurable": {
    "search_api": "tavily"  // or "exa" or "none"
  }
}
```

### Customize Models
```json
{
  "configurable": {
    "research_model": "gemini-2.5-pro",
    "compression_model": "gemini-2.5-flash",
    "final_report_model": "gemini-2.5-pro"
  }
}
```

---

## Debugging Tips

### 1. Check if Clarification Was Triggered
Look at the workflow execution path in LangSmith trace:
- **Clarification triggered:** `clarify_with_user` → `__end__`
- **Clarification skipped:** `clarify_with_user` → `write_research_brief` → ...

### 2. Inspect Message History
The `messages` array shows the full conversation:
- Human messages: User inputs
- AI messages: Clarifying questions or verification messages

### 3. View Research Brief
After clarification (or skipping it), check `state.research_brief`:
```json
{
  "research_brief": "Generated research plan with specific topics and scope"
}
```

### 4. Monitor Supervisor Tasks
The `supervisor` subgraph creates parallel research tasks:
- Check `state.supervisor_messages` for task assignments
- View `state.raw_notes` for research findings
- See `state.notes` for compressed summaries

### 5. Final Report
The complete research output is in `state.final_report`:
```json
{
  "final_report": "Comprehensive markdown report with citations"
}
```

---

## Comparison with Traditional `interrupt()` Pattern

### Traditional HITL with `interrupt()` (NOT used here)
```typescript
// Traditional pattern (NOT in deep-research)
const value = interrupt({ question: "Approve this action?" });
// Workflow PAUSES here

// Later, resume with:
await graph.invoke(new Command({ resume: true }), config);
```

### Deep-Research Clarification Pattern (Actual Implementation)
```typescript
// Deep-research pattern (ACTUAL implementation)
if (need_clarification) {
  return new Command({
    goto: "__end__",  // Workflow ENDS here
    update: { messages: [new AIMessage({ content: question })] }
  });
}

// Later, continue by re-invoking with updated messages:
await graph.invoke({
  messages: [...previousMessages, newHumanMessage]
}, config);
```

### Why This Design?

1. **Simpler State Management:** No interrupt queue or resume payloads
2. **Natural Conversation Flow:** Just add messages to the array
3. **LangSmith Compatibility:** Works seamlessly with message-based UIs
4. **Flexibility:** Users can add multiple clarifying messages before continuing

---

## Next Steps

1. Test with your own research questions
2. Experiment with different configuration options
3. Monitor LangSmith traces to understand the workflow
4. Try batch evaluations with multiple test inputs

For more details, see the main `README.md` in the parent folder.
