"use client";

import type {
  Message as LangGraphMessage,
  Thread,
} from "@langchain/langgraph-sdk";
import {
  AlertCircleIcon,
  ListTodoIcon,
  SearchIcon,
  WandIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
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
import {
  StreamProvider,
  useStreamContext,
} from "@/lib/providers/stream-provider";
import { ThreadProvider, useThreads } from "@/lib/providers/thread-provider";

const STORAGE_KEY = "agent-threads";
const THREAD_ID_PREVIEW_LENGTH = 8;

function AgentThreadContent() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const isMountedRef = useRef(true);

  // Get threads from ThreadProvider
  const { getThreads, setThreads, threads, deleteThread } = useThreads();

  // Get stream from StreamProvider
  const stream = useStreamContext();

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
      const parsed = JSON.parse(storedThreads) as Thread[];
      setThreads(parsed);
    } catch {
      // Ignore parse errors
    }
  }, [setThreads]);

  // Load threads from SDK
  useEffect(() => {
    getThreads()
      .then(setThreads)
      .catch((error) => {
        // biome-ignore lint/suspicious/noConsole: <Error logging>
        console.error("Failed to load threads:", error);
      });
  }, [getThreads, setThreads]);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setIsLeftPanelVisible(open);
  }, []);

  const handleDeleteThread = useCallback(
    (id: string) => {
      deleteThread(id).catch((error) => {
        // biome-ignore lint/suspicious/noConsole: <Error logging>
        console.error("Failed to delete thread:", error);
      });
    },
    [deleteThread]
  );

  // Helper to extract content from SDK message
  const extractMessageContent = useCallback(
    (content: LangGraphMessage["content"]): string => {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (item.type === "text") {
              return item.text;
            }
            if (item.type === "image_url") {
              const url =
                typeof item.image_url === "string"
                  ? item.image_url
                  : item.image_url.url;
              return `[Image: ${url}]`;
            }
            return "";
          })
          .join("\n");
      }
      return "";
    },
    []
  );

  // Convert SDK messages to display format
  const conversationMessages = useMemo(() => {
    if (!stream.messages || stream.messages.length === 0) {
      return [];
    }

    return stream.messages
      .filter((message) => message.type === "human" || message.type === "ai")
      .map((message: LangGraphMessage, index: number) => {
        const metadata = stream.getMessagesMetadata(message, index);
        const content = extractMessageContent(message.content);

        return {
          id: message.id || `message-${index}`,
          role:
            message.type === "human"
              ? "user"
              : ("assistant" as "user" | "assistant"),
          content,
          timestamp: new Date().toISOString(),
          metadata,
        };
      });
  }, [stream.messages, stream.getMessagesMetadata, extractMessageContent]);

  // Extract agent state from SDK stream values
  const agentState = useMemo(
    () => ({
      todos:
        stream.values &&
        "todos" in stream.values &&
        Array.isArray(stream.values.todos)
          ? stream.values.todos
          : [],
      toolCalls:
        stream.values &&
        "recentToolCalls" in stream.values &&
        Array.isArray(stream.values.recentToolCalls)
          ? stream.values.recentToolCalls
          : [],
      searchRuns:
        stream.values &&
        "searchRuns" in stream.values &&
        Array.isArray(stream.values.searchRuns)
          ? stream.values.searchRuns
          : [],
    }),
    [stream.values]
  );

  const { todos, toolCalls, searchRuns } = agentState;

  const handlePromptSubmit = useCallback(
    async (message: { text?: string }) => {
      if (!(threadId && message.text?.trim())) {
        return;
      }
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setInputValue("");

      try {
        // Send the new message using the SDK
        await stream.submit({
          messages: [
            {
              type: "human",
              content: message.text,
            },
          ],
        });
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: <Error logging>
        console.error("Failed to send message:", error);
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [isSubmitting, threadId, stream]
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
                  {conversationMessages.map((message) => (
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
                    stream.isLoading
                      ? "Loading agent session..."
                      : "Start a new request to see the agent in action."
                  }
                  title="Agent is idle"
                />
              )}
            </ConversationContent>
          </Conversation>

          {stream.error ? (
            <Alert className="mx-4 mb-4" variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertDescription>
                {(() => {
                  if (stream.error instanceof Error) {
                    return stream.error.message;
                  }
                  if (typeof stream.error === "string") {
                    return stream.error;
                  }
                  return "An error occurred";
                })()}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex-shrink-0 border-t bg-background p-4">
            <div className="mx-auto w-full max-w-3xl">
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4 text-sm">
                <div>
                  <h3 className="font-semibold text-sm">
                    Continue the conversation
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Send another instruction to continue working with the agent.
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
                    placeholder="Send another instruction..."
                    rows={2}
                    value={inputValue}
                  />
                  <button
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting || !inputValue.trim()}
                    type="submit"
                  >
                    {isSubmitting ? "Sending..." : "Send"}
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
          threads={threads.map((thread) => ({
            threadId: thread.thread_id,
            title:
              (thread.metadata?.title as string) ||
              `Thread ${thread.thread_id.slice(0, THREAD_ID_PREVIEW_LENGTH)}`,
            createdAt: thread.created_at,
            updatedAt: thread.updated_at,
            goal: "",
            status: "running" as const,
            messageCount: 0,
            mode: "plan" as const,
          }))}
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

// Wrapper component that provides the contexts
export default function AgentThreadPage() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  return (
    <ThreadProvider>
      <StreamProvider threadId={threadId ?? null}>
        <AgentThreadContent />
      </StreamProvider>
    </ThreadProvider>
  );
}

// Card components (keeping the existing ones for now)
type AgentToolCallCardProps = {
  toolCalls: unknown[];
};

type AgentTodoCardProps = {
  todos: unknown[];
};

type AgentSearchRunCardProps = {
  searchRuns: unknown[];
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
            {todos.map((todo, index) => (
              <li
                className="rounded-md border border-border/60 bg-muted/30 p-2"
                key={`todo-${index}-${typeof todo === "object" && todo !== null && "id" in todo ? String(todo.id) : index}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {typeof todo === "object" &&
                    todo !== null &&
                    "title" in todo
                      ? String(todo.title)
                      : "Task"}
                  </span>
                </div>
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
                key={`tool-${index}-${typeof toolCall === "object" && toolCall !== null && "toolName" in toolCall ? String(toolCall.toolName) : index}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {typeof toolCall === "object" &&
                    toolCall !== null &&
                    "toolName" in toolCall
                      ? String(toolCall.toolName)
                      : "Tool"}
                  </span>
                </div>
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
            {searchRuns.map((run, index) => (
              <li
                className="rounded-md border border-border/60 bg-muted/30 p-2"
                key={`search-${index}-${typeof run === "object" && run !== null && "query" in run ? String(run.query) : index}`}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {typeof run === "object" && run !== null && "query" in run
                      ? String(run.query)
                      : "Unknown query"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
