import { ToolMessage } from "@langchain/core/messages";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";
import { todoListStore } from "../../../shared/tools/todo-list";
import type { ReactAgentState } from "../state";

const requireSessionId = (context: unknown): string => {
  const sessionId =
    typeof context === "object" &&
    context !== null &&
    "sessionId" in context &&
    typeof (context as { sessionId: unknown }).sessionId === "string"
      ? (context as { sessionId: string }).sessionId
      : null;
  if (!sessionId) {
    throw new Error("Todo tools require a sessionId in runtime context");
  }
  return sessionId;
};

const CreateTodoInputSchema = z.object({
  title: z.string().min(1).describe("Task title"),
  notes: z.string().optional(),
});

const CompleteTodoInputSchema = z.object({
  todoId: z.string().min(1).describe("Todo identifier to complete"),
});

export function createTodoTools() {
  const listTodos = tool(
    (_, config) => {
      const sessionId = requireSessionId(config?.context);
      const todos = todoListStore.list(sessionId);
      const observation = JSON.stringify({ todos });
      const toolCallId = config.toolCall?.id ?? `todo-list-${Date.now()}`;
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: observation,
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "todo_list",
      description: "Display the current todo items for this session.",
      schema: z.object({}),
    }
  );

  const createTodo = tool(
    (input, config) => {
      const sessionId = requireSessionId(config?.context);
      const args = CreateTodoInputSchema.parse(input);
      const created = todoListStore.create({
        sessionId,
        title: args.title,
        notes: args.notes,
      });
      const state = getCurrentTaskInput<ReactAgentState>();
      const toolCallId = config.toolCall?.id ?? `todo-create-${Date.now()}`;
      return new Command({
        update: {
          todos: [...(state.todos ?? []), created],
          messages: [
            new ToolMessage({
              content: JSON.stringify({ created }),
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "todo_create",
      description: "Create a todo item that should be tracked.",
      schema: CreateTodoInputSchema,
    }
  );

  const completeTodo = tool(
    (input, config) => {
      const sessionId = requireSessionId(config?.context);
      const args = CompleteTodoInputSchema.parse(input);
      const completed = todoListStore.complete({
        sessionId,
        todoId: args.todoId,
      });
      if (!completed) {
        throw new Error(`Todo item ${args.todoId} not found`);
      }
      const state = getCurrentTaskInput<ReactAgentState>();
      const nextTodos = state.todos.map((todo) =>
        todo.id === completed.id ? completed : todo
      );
      const toolCallId = config.toolCall?.id ?? `todo-complete-${Date.now()}`;
      return new Command({
        update: {
          todos: nextTodos,
          messages: [
            new ToolMessage({
              content: JSON.stringify({ completed }),
              tool_call_id: toolCallId,
            }),
          ],
        },
      });
    },
    {
      name: "todo_complete",
      description: "Mark a todo item as completed by id.",
      schema: CompleteTodoInputSchema,
    }
  );

  return [listTodos, createTodo, completeTodo];
}
