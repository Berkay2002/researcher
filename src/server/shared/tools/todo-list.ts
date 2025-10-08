import { nanoid } from "nanoid";
import type { TodoItem } from "../../types/react-agent";

// ============================================================================
// In-memory Todo List Store (per session)
// ============================================================================

type TodoListKey = string;

export type CreateTodoInput = {
  sessionId: string;
  title: string;
  notes?: string;
};

export type CompleteTodoInput = {
  sessionId: string;
  todoId: string;
};

class TodoListStore {
  private readonly store = new Map<TodoListKey, TodoItem[]>();

  list(sessionId: string): TodoItem[] {
    return this.store.get(sessionId) ?? [];
  }

  create(input: CreateTodoInput): TodoItem {
    const todos = this.list(input.sessionId);
    const newTodo: TodoItem = {
      id: nanoid(),
      title: input.title,
      status: "pending",
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    this.store.set(input.sessionId, [...todos, newTodo]);
    return newTodo;
  }

  complete(input: CompleteTodoInput): TodoItem | null {
    const todos = this.list(input.sessionId);
    const updated = todos.map((todo): TodoItem => {
      if (todo.id !== input.todoId) {
        return todo;
      }
      const completedTodo: TodoItem = {
        ...todo,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      return completedTodo;
    });

    const completed = updated.find((todo) => todo.id === input.todoId) ?? null;
    this.store.set(input.sessionId, updated);
    return completed;
  }
}

export const todoListStore = new TodoListStore();
