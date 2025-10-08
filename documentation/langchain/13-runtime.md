# Runtime

<Warning>
  **Alpha Notice:** These docs cover the [**v1-alpha**](../releases/langchain-v1) release. Content is incomplete and subject to change.

  For the latest stable version, see the v0 [LangChain Python](https://python.langchain.com/docs/introduction/) or [LangChain JavaScript](https://js.langchain.com/docs/introduction/) docs.
</Warning>

## Overview

LangChain's `createAgent` runs on LangGraph's runtime under the hood.

LangGraph exposes a [Runtime](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.Runtime.html) object with the following information:

1. **Context**: static information like user id, db connections, or other dependencies for an agent invocation
2. **Store**: a [BaseStore](https://langchain-ai.github.io/langgraphjs/reference/classes/checkpoint.BaseStore.html) instance used for [long-term memory](/oss/javascript/langchain/long-term-memory)
3. **Stream writer**: an object used for streaming information via the `"custom"` stream mode

You can access the runtime information within [tools](#inside-tools), [prompt](#inside-prompt), and [pre and post model hooks](#inside-pre-and-post-model-hooks).

## Access

When creating an agent with `createAgent`, you can specify a `contextSchema` to define the structure of the `context` stored in the agent [Runtime](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.Runtime.html).

When invoking the agent, pass the `context` argument with the relevant configuration for the run:

```ts
import { z } from "zod";
import { createAgent } from "langchain";

const contextSchema = z.object({ // [!code highlight]
  userName: z.string(), // [!code highlight]
}); // [!code highlight]

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: [
    /* ... */
  ],
  contextSchema, // [!code highlight]
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  { context: { userName: "John Smith" } } // [!code highlight]
);
```

### Inside tools

You can access the runtime information inside tools to:

* Access the context
* Read or write long-term memory
* Write to the [custom stream](/oss/javascript/langchain/streaming#custom-updates) (ex, tool progress / updates)

Use the `runtime` parameter to access the [Runtime](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.Runtime.html) object inside a tool.

```ts
import { z } from "zod";
import { tool } from "langchain";
import { type Runtime } from "@langchain/langgraph"; // [!code highlight]

const contextSchema = z.object({
  userName: z.string(),
});

const fetchUserEmailPreferences = tool(
  async (_, runtime: Runtime<z.infer<typeof contextSchema>>) => { // [!code highlight]
    const userName = runtime.context?.userName; // [!code highlight]
    if (!userName) {
      throw new Error("userName is required");
    }

    let preferences = "The user prefers you to write a brief and polite email.";
    if (runtime.store) { // [!code highlight]
      const memory = await runtime.store?.get(["users"], userName); // [!code highlight]
      if (memory) {
        preferences = memory.value.preferences;
      }
    }
    return preferences;
  },
  {
    name: "fetch_user_email_preferences",
    description: "Fetch the user's email preferences.",
    schema: z.object({}),
  }
);
```

### Inside prompt

Use the `runtime` parameter to access the [Runtime](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.Runtime.html) object inside a prompt function.

```ts
import { z } from "zod";
import { createAgent, type AgentState, SystemMessage } from "langchain";
import { type Runtime } from "@langchain/langgraph"; // [!code highlight]

const contextSchema = z.object({
  userName: z.string(),
});

const prompt = (
  state: AgentState,
  runtime: Runtime<z.infer<typeof contextSchema>> // [!code highlight]
) => {
  const userName = runtime.context?.userName; // [!code highlight]
  if (!userName) {
    throw new Error("userName is required");
  }

  const systemMsg = `You are a helpful assistant. Address the user as ${userName}.`; // [!code highlight]
  return [new SystemMessage(systemMsg), ...state.messages];
};

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: [
    /* ... */
  ],
  prompt,
  contextSchema,
});

const result = await agent.invoke(
  { messages: [{ role: "user", content: "What's my name?" }] },
  { context: { userName: "John Smith" } }
);
```

### Inside pre and post model hooks

Use the `runtime` parameter to access the [Runtime](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.Runtime.html) object inside a pre or post model hook.

```ts
import { z } from "zod";
import { type Runtime } from "@langchain/langgraph"; // [!code highlight]
import { createAgent, type AgentState } from "langchain";

const contextSchema = z.object({
  userName: z.string(),
});

const preModelHook = (
  state: AgentState,
  runtime: Runtime<z.infer<typeof contextSchema>> // [!code highlight]
) => {
  const userName = runtime.context?.userName; // [!code highlight]
  if (!userName) {
    throw new Error("userName is required");
  }

  return {
    // ...
  };
};

const postModelHook = (
  state: AgentState,
  runtime: Runtime<z.infer<typeof contextSchema>> // [!code highlight]
) => {
  const userName = runtime.context?.userName; // [!code highlight]
  if (!userName) {
    throw new Error("userName is required");
  }

  return {
    // ...
  };
};

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [
    /* ... */
  ],
  contextSchema,
  preModelHook,
  postModelHook,
});
```
