# Human-in-the-loop

<Warning>
  **Alpha Notice:** These docs cover the [**v1-alpha**](../releases/langchain-v1) release. Content is incomplete and subject to change.

  For the latest stable version, see the v0 [LangChain Python](https://python.langchain.com/docs/introduction/) or [LangChain JavaScript](https://js.langchain.com/docs/introduction/) docs.
</Warning>

The Human-in-the-Loop (HITL) middleware lets you add human oversight to agent tool calls.
When a model proposes an action that might require review — for example, writing to a file or executing SQL — the middleware can pause execution and wait for a decision.

It does this by checking each tool call against a configurable policy. If intervention is needed, the middleware issues an [interrupt](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph.interrupt-2.html) that halts execution. The graph state is saved using LangGraph’s [persistence layer](/oss/javascript/langgraph/persistence), so execution can pause safely and resume later.

A human response then determines what happens next: the action can be accepted as-is (`accept`), modified before running (`edit`), or rejected with feedback (`respond`).

## Interrupt response types

The middleware defines three built-in ways a human can respond to an interrupt:

| Response Type | Description                                                               | Example Use Case                                    |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| ✅ `accept`    | The action is approved as-is and executed without changes.                | Send an email draft exactly as written              |
| ✏️ `edit`     | The tool call is executed with modifications.                             | Change the recipient before sending an email        |
| ❌ `respond`   | The tool call is rejected, with an explanation added to the conversation. | Reject an email draft and explain how to rewrite it |

The available response types for each tool depend on the policy you configure in `interrupt_on`.
When multiple tool calls are paused at the same time, each action requires a separate response.
Responses must be provided in the same order as the actions appear in the interrupt request.

<Tip>
  When **editing** tool arguments, make changes conservatively. Significant modifications to the original arguments may cause the model to re-evaluate its approach and potentially execute the tool multiple times or take unexpected actions.
</Tip>

## Configuring interrupts

To use HITL, add the middleware to the agent’s `middleware` list when creating the agent.

You configure it with a mapping of tool actions to the response types that are allowed for each action. The middleware will interrupt execution when a tool call matches an action in the mapping.

```ts  theme={null}
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph"; // [!code highlight]
import { humanInTheLoopMiddleware } from "langchain/middleware"; // [!code highlight]

const agent = createAgent({
    model: "openai:gpt-4o",
    tools: [writeFileTool, executeSQLTool, readDataTool],
    middleware: [
        humanInTheLoopMiddleware({
            interruptOn: {
                write_file: true, // All actions (accept, edit, respond) allowed
                execute_sql: {
                    allowAccept: true,
                    allowRespond: true,
                    // No editing allowed
                    description: "🚨 SQL execution requires DBA approval",
                },
                // Safe operation, no approval needed
                read_data: false,
            },
            // Prefix for interrupt messages - combined with tool name and args to form the full message
            // e.g., "Tool execution pending approval: execute_sql with query='DELETE FROM...'"
            // Individual tools can override this by specifying a "description" in their interrupt config
            descriptionPrefix: "Tool execution pending approval",
        }),
    ],
    // Human-in-the-loop requires checkpointing to handle interrupts.
    // In production, use a persistent checkpointer like AsyncPostgresSaver.
    checkpointer: new MemorySaver(), // [!code highlight]
});
```

<Info>
  You must configure a checkpointer to persist the graph state across interrupts.
  In production, use a persistent checkpointer like @\[AsyncPostgresSaver]. For testing or prototyping, use @\[InMemorySaver].

  When invoking the agent, pass a `config` that includes the **thread ID** to associate execution with a conversation thread.
  See the [LangGraph human-in-the-loop documentation](/oss/javascript/langgraph/add-human-in-the-loop) for details.
</Info>

## Responding to interrupts

When you invoke the agent, it runs until it either completes or an interrupt is raised. An interrupt is triggered when a tool call matches the policy you configured in `interrupt_on`. In that case, the invocation result will include an `__interrupt__` field with the actions that require review. You can then present those actions to a reviewer and resume execution once responses are provided.

```typescript  theme={null}
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

// You must provide a thread ID to associate the execution with a conversation thread,
// so the conversation can be paused and resumed (as is needed for human review).
const config = { configurable: { thread_id: "some_id" } }; // [!code highlight]

// Run the graph until the interrupt is hit.
const result = await agent.invoke(
    {
        messages: [new HumanMessage("Delete old records from the database")],
    },
    config // [!code highlight]
);


// The interrupt contains information about the actions to be approved.
console.log(result.__interrupt__);
// > [
// >    Interrupt(
// >       value=[
// >          {
// >             action: 'execute_sql',
// >             args: { query: 'DELETE FROM records WHERE created_at < NOW() - INTERVAL \'30 days\';' },
// >          }
// >       ],
// >    )
// > ]

// Resume with approval decision
await agent.invoke(
    new Command({ // [!code highlight]
        resume: [{ type: "accept" }], // or "edit", "respond" [!code highlight]
    }), // [!code highlight]
    config // Same thread ID to resume the paused conversation
);
```

### Response types

<Tabs>
  <Tab title="✅ accept">
    Use `accept` to approve the tool call as-is and execute it without changes.

    ```typescript  theme={null}
    await agent.invoke(
        new Command({
            // Responses are provided as a list, one per action under review.
            // The order of responses must match the order of actions
            // listed in the `__interrupt__` request.
            resume: [
                {
                    type: "accept",
                }
            ]
        }),
        config  // Same thread ID to resume the paused conversation
    );
    ```
  </Tab>

  <Tab title="✏️ edit">
    Use `edit` to modify the tool call before execution.
    Provide the new tool name and arguments.

    ```typescript  theme={null}
    await agent.invoke(
        new Command({
            // Responses are provided as a list, one per action under review.
            // The order of responses must match the order of actions
            // listed in the `__interrupt__` request.
            resume: [
                {
                    type: "edit",
                    // Tool name to call.
                    // Will usually be the same as the original action.
                    action: "new_tool_name",
                    // Arguments to pass to the tool.
                    args: { key1: "new_value", key2: "original_value" },
                }
            ]
        }),
        config  // Same thread ID to resume the paused conversation
    );
    ```

    <Tip>
      When **editing** tool arguments, make changes conservatively. Significant modifications to the original arguments may cause the model to re-evaluate its approach and potentially execute the tool multiple times or take unexpected actions.
    </Tip>
  </Tab>

  <Tab title="❌ respond">
    Use `respond` to reject the tool call and provide feedback instead of execution.

    ```typescript  theme={null}
    await agent.invoke(
        new Command({
            // Responses are provided as a list, one per action under review.
            // The order of responses must match the order of actions
            // listed in the `__interrupt__` request.
            resume: [
                {
                    type: "respond",
                    // An explanation about why the action was rejected
                    args: "No, this is wrong because ..., instead do this ...",
                }
            ]
        }),
        config  // Same thread ID to resume the paused conversation
    );
    ```
  </Tab>
</Tabs>

## Execution lifecycle

The middleware defines an `after_model` hook that runs after the model generates a response but before any tool calls are executed:

1. The agent invokes the model to generate a response.
2. The middleware inspects the response for tool calls.
3. If any calls require human input, the middleware builds a list of `HumanInterrupt` objects and calls [interrupt](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph.interrupt-2.html).
4. The agent waits for human responses.
5. Based on responses, the middleware executes approved or edited calls, synthesizes @\[ToolMessage]'s for rejected calls, and resumes execution.

## UI integration

The prebuilt `HumanInTheLoopMiddleware` is designed to work out-of-the-box with LangChain provided UI applications like [Agent ChatUI](/oss/javascript/langchain/ui). The middleware's interrupt messages include all the information needed to render a review interface, including tool names, arguments, and allowed response types.

## Custom HITL logic

For more specialized workflows, you can build custom HITL logic directly using the [interrupt](https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph.interrupt-2.html) primitive and [middleware](/oss/javascript/langchain/middleware) abstraction.

Review the [execution lifecycle](#execution-lifecycle) above to understand how to integrate interrupts into the agent's operation.
