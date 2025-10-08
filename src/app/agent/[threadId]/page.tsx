"use client";

import {
  AlertCircleIcon,
  ListTodoIcon,
  SearchIcon,
  WandIcon,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/app/(components)/app-shell";
import { ThreadList } from "@/app/(components)/thread-list";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSSEStream } from "@/lib/hooks/use-sse-stream";
import { useThreadState } from "@/lib/hooks/use-thread-state";
import type {
  MessageData,
  ThreadMetadata,
  TodoItem,
  ToolCallMetadata,
} from "@/types/ui";

const STORAGE_KEY = "agent-threads";

export default function AgentThreadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const threadId = params?.threadId as string | undefined;
  const urlPrompt = searchParams?.get("prompt") ?? null;

  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    const storedThreads = localStorage.getItem(STORAGE_KEY);
    if (!storedThreads) {
      return;
    }
    try {
      const parsed = JSON.parse(storedThreads) as ThreadMetadata[];
      setThreads(parsed);
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setIsLeftPanelVisible(open);
  }, []);

  const handleDeleteThread = useCallback((id: string) => {
    setThreads((current) => current.filter((thread) => thread.threadId !== id));
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored) as ThreadMetadata[];
      const filtered = parsed.filter((thread) => thread.threadId !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore persistence errors
    }
  }, []);

  const {
    snapshot,
    isLoading,
    error: stateError,
  } = useThreadState({
    threadId: threadId ?? null,
    autoFetch: true,
  });

  const sseStream = useSSEStream({
    threadId: threadId ?? null,
    autoConnect: true,
    endpoint: "/api/agent/stream",
  });

  const snapshotMessages = useMemo<MessageData[]>(() => {
    if (
      !(snapshot?.values?.messages && Array.isArray(snapshot.values.messages))
    ) {
      return [];
    }
    return convertAgentMessagesToMessageData(snapshot.values.messages);
  }, [snapshot]);

  const streamedMessages = useMemo<MessageData[]>(() => {
    if (
      !Array.isArray(sseStream.agentMessages) ||
      sseStream.agentMessages.length === 0
    ) {
      return [];
    }
    return convertAgentMessagesToMessageData(sseStream.agentMessages);
  }, [sseStream.agentMessages]);

  const conversationMessages = useMemo<MessageData[]>(() => {
    if (streamedMessages.length > 0) {
      return streamedMessages;
    }
    if (snapshotMessages.length > 0) {
      return snapshotMessages;
    }
    if (urlPrompt) {
      return [
        {
          id: "initial-url-prompt",
          role: "user",
          content: urlPrompt,
          timestamp: new Date().toISOString(),
        } satisfies MessageData,
      ];
    }
    return [];
  }, [snapshotMessages, streamedMessages, urlPrompt]);

  const todos = useMemo(() => {
    if (sseStream.todos.length > 0) {
      return sseStream.todos;
    }
    if (
      snapshot?.values &&
      "todos" in snapshot.values &&
      Array.isArray((snapshot.values as Record<string, unknown>).todos)
    ) {
      return (snapshot.values as { todos: TodoItem[] }).todos;
    }
    return [] as TodoItem[];
  }, [sseStream.todos, snapshot]);

  const toolCalls = useMemo(() => {
    if (sseStream.toolCalls.length > 0) {
      return sseStream.toolCalls;
    }
    if (
      snapshot?.values &&
      "recentToolCalls" in snapshot.values &&
      Array.isArray(
        (snapshot.values as Record<string, unknown>).recentToolCalls
      )
    ) {
      return (snapshot.values as { recentToolCalls: ToolCallMetadata[] })
        .recentToolCalls;
    }
    return [] as ToolCallMetadata[];
  }, [sseStream.toolCalls, snapshot]);

  const searchRuns = useMemo(() => {
    if (sseStream.searchRuns.length > 0) {
      return sseStream.searchRuns;
    }
    if (
      snapshot?.values &&
      "searchRuns" in snapshot.values &&
      Array.isArray((snapshot.values as Record<string, unknown>).searchRuns)
    ) {
      return (snapshot.values as { searchRuns: Record<string, unknown>[] })
        .searchRuns;
    }
    return [] as Record<string, unknown>[];
  }, [sseStream.searchRuns, snapshot]);

  const handlePromptSubmit = useCallback(
    (message: { text?: string }) => {
      if (!(threadId && message.text?.trim())) {
        return;
      }
      if (isSubmitting) {
        return;
      }
      setIsSubmitting(true);
      setInputValue("");
      // Placeholder for future multi-turn support
      setTimeout(() => {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }, 0);
    },
    [isSubmitting, threadId]
  );

  const hasMessages = conversationMessages.length > 0;

  return (
    <AppShell
      centerPanel={
        <div className="flex h-full flex-col overflow-hidden">
          <Conversation>
            <ConversationContent>
              {hasMessages ? (
                <div className="space-y-4 px-4 pt-4 pb-6">
                  {conversationMessages.map((message: MessageData) => (
                    <Message from={message.role} key={message.id}>
                      <MessageAvatar
                        name={message.role === "user" ? "You" : "Agent"}
                        src={message.role === "user" ? "/user.png" : "/ai.png"}
                      />
                      <MessageContent variant="flat">
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      </MessageContent>
                    </Message>
                  ))}
                </div>
              ) : (
                <ConversationEmptyState
                  description={
                    isLoading
                      ? "Loading agent session..."
                      : "Start a new request to see the agent in action."
                  }
                  title="Agent is idle"
                />
              )}
            </ConversationContent>
          </Conversation>

          {stateError && (
            <Alert className="mx-4 mb-4" variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>{stateError}</AlertDescription>
            </Alert>
          )}

          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl">
              <div className="space-y-3 rounded-lg border border-border/70 border-dashed bg-muted/20 p-4 text-sm">
                <div>
                  <h3 className="font-semibold text-sm">
                    Multi-turn support coming soon
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    For now, start a new agent thread to run another
                    instruction.
                  </p>
                </div>
                <form
                  className="flex items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handlePromptSubmit({ text: inputValue });
                  }}
                >
                  <textarea
                    className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    disabled={isSubmitting}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder="Send another instruction (disabled)"
                    rows={2}
                    value={inputValue}
                  />
                  <button
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled
                    type="submit"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      }
      leftPanel={
        <ThreadList
          activeThreadId={threadId}
          basePath="/agent"
          isSidebarOpen={isLeftPanelVisible}
          onDeleteThread={handleDeleteThread}
          onSidebarOpenChange={handleSidebarOpenChange}
          threads={threads}
        />
      }
      leftPanelCollapsed={!isLeftPanelVisible}
      rightPanel={
        <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
          <AgentTodoCard todos={todos} />
          <AgentToolCallCard toolCalls={toolCalls} />
          <AgentSearchRunCard searchRuns={searchRuns} />
        </div>
      }
      rightPanelCollapsed={false}
      rightPanelVisible
    />
  );
}

type SerializedAgentMessage = {
  type?: string;
  data?: {
    content?: unknown;
    additional_kwargs?: Record<string, unknown>;
    response_metadata?: Record<string, unknown>;
  } & Record<string, unknown>;
};

function convertAgentMessagesToMessageData(messages: unknown[]): MessageData[] {
  return messages.reduce<MessageData[]>((acc, message, index) => {
    if (!message || typeof message !== "object") {
      return acc;
    }

    const serialized = message as SerializedAgentMessage;
    const role = mapAgentRoleToMessageRole(serialized.type);
    const content = extractMessageText(serialized.data?.content);
    const metadata = extractMessageMetadata(serialized);

    const messageData: MessageData = {
      id: `agent-message-${index}`,
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    if (metadata) {
      messageData.metadata = metadata;
    }

    acc.push(messageData);

    return acc;
  }, []);
}

function mapAgentRoleToMessageRole(role?: string): MessageData["role"] {
  switch (role) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "system":
      return "system";
    case "tool":
      return "assistant";
    default:
      return "assistant";
  }
}

function extractMessageMetadata(
  message: SerializedAgentMessage
): MessageData["metadata"] | undefined {
  const additionalKwargs = message.data?.additional_kwargs;

  if (!additionalKwargs || typeof additionalKwargs !== "object") {
    return;
  }

  const metadata: MessageData["metadata"] = {};

  const nodeCandidate = (additionalKwargs as Record<string, unknown>)
    .langgraph_node;
  if (typeof nodeCandidate === "string") {
    metadata.node = nodeCandidate;
  }

  if (Object.keys(metadata).length === 0) {
    return;
  }

  return metadata;
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text?: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  if (
    content &&
    typeof content === "object" &&
    "text" in content &&
    typeof (content as { text?: unknown }).text === "string"
  ) {
    return (content as { text: string }).text;
  }
  return "";
}

type AgentToolCallCardProps = {
  toolCalls: ToolCallMetadata[];
};

type AgentTodoCardProps = {
  todos: TodoItem[];
};

type AgentSearchRunCardProps = {
  searchRuns: Record<string, unknown>[];
};

function AgentTodoCard({ todos }: AgentTodoCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">
          <div className="flex items-center gap-2">
            <ListTodoIcon className="size-4" />
            Agent TODOs
          </div>
        </CardTitle>
        <Badge variant="secondary">{todos.length}</Badge>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks queued.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {todos.map((todo) => (
              <li
                className="rounded-md border border-border/60 bg-muted/30 p-2"
                key={todo.id}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{todo.title}</span>
                  <Badge
                    variant={
                      todo.status === "completed" ? "default" : "outline"
                    }
                  >
                    {todo.status}
                  </Badge>
                </div>
                {todo.notes && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {todo.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgentToolCallCard({ toolCalls }: AgentToolCallCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">
          <div className="flex items-center gap-2">
            <WandIcon className="size-4" />
            Tool Calls
          </div>
        </CardTitle>
        <Badge variant="secondary">{toolCalls.length}</Badge>
      </CardHeader>
      <CardContent>
        {toolCalls.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tool calls recorded yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {toolCalls.map((toolCall, index) => (
              <li
                className="rounded-md border border-border/60 bg-muted/30 p-2"
                key={`${toolCall.toolName}-${toolCall.invokedAt}-${index}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{toolCall.toolName}</span>
                  <span className="text-muted-foreground">
                    {new Date(toolCall.invokedAt).toLocaleTimeString()}
                  </span>
                </div>
                {toolCall.correlationId && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Correlation ID: {toolCall.correlationId}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgentSearchRunCard({ searchRuns }: AgentSearchRunCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4" />
            Search Runs
          </div>
        </CardTitle>
        <Badge variant="secondary">{searchRuns.length}</Badge>
      </CardHeader>
      <CardContent>
        {searchRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No search activity yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {searchRuns.map((run, index) => {
              const completedAt =
                typeof run.completedAt === "string" ? run.completedAt : null;

              return (
                <li
                  className="rounded-md border border-border/60 bg-muted/30 p-2"
                  key={`${String(run.query ?? index)}-${index}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {String(run.query ?? "Unknown query")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Provider: {String(run.provider ?? "unknown")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Started: {formatTimestamp(run.startedAt)}
                    </span>
                    {completedAt ? (
                      <span className="text-muted-foreground text-xs">
                        Completed: {formatTimestamp(completedAt)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== "string") {
    return "–";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
