/** biome-ignore-all lint/style/useBlockStatements: <Ignore> */
/** biome-ignore-all lint/style/noNestedTernary: <Ignore> */
/** biome-ignore-all lint/complexity/noUselessFragments: <Ignore> */
/** biome-ignore-all lint/style/useShorthandAssign: <Ignore> */
/** biome-ignore-all lint/style/useAtIndex: <Ignore> */

import type { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { ArrowDown, LoaderCircle, Plus, WrenchIcon, XIcon } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { v4 as uuidv4 } from "uuid";
import { AppShell } from "@/app/(components)/app-shell";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { AutoResizeTextarea } from "../ui/auto-resize-textarea";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "../ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
  useArtifactOpen,
} from "./artifact";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import ThreadHistory from "./history";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      className={props.className}
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
    >
      <div className={props.contentClassName} ref={context.contentRef}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      className={cn("rounded-full", props.className)}
      onClick={() => scrollToBottom()}
      size="icon"
      type="button"
      variant="outline"
    >
      <ArrowDown className="h-4 w-4" />
    </Button>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <Ignore>
export function Thread() {
  const [artifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [_threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(true)
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false)
  );
  const [input, setInput] = useState("");
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolsVisible = !(hideToolCalls ?? false);
  const [toolToggleHovered, setToolToggleHovered] = useState(false);

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as unknown as Error).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        streamMode: ["values", "messages"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      }
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values", "messages"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool"
  );

  // Get empty state description
  const getEmptyStateDescription = () => {
    if (stream.interrupt) {
      return "Please respond to continue...";
    }
    if (stream.isLoading) {
      return "Your session is starting...";
    }
    return "Start a conversation to see messages here";
  };

  const getEmptyStateTitle = () => {
    if (stream.interrupt) {
      return "Awaiting Response";
    }
    return "No messages yet";
  };

  // Left panel - Thread History
  const leftPanel = <ThreadHistory />;

  // Right panel - Artifacts
  const rightPanel = artifactOpen ? (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <ArtifactTitle className="truncate font-semibold text-sm" />
        </div>
        <Button
          className="ml-2 size-7 rounded-lg"
          onClick={closeArtifact}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
      <ArtifactContent className="min-h-0 flex-1 overflow-y-auto p-4" />
    </div>
  ) : undefined;

  // Center panel - Main conversation
  const centerPanel = (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {/* Conversation Area */}
      <StickToBottom className="relative flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>div::-webkit-scrollbar]:hidden [&>div]:[-ms-overflow-style:none] [&>div]:[scrollbar-width:none]">
        <StickyToBottomContent
          className="relative"
          content={
            <>
              {messages.length === 0 && !stream.interrupt ? (
                <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="space-y-1">
                    <h3 className="font-medium text-sm">
                      {getEmptyStateTitle()}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {getEmptyStateDescription()}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    .map((message, index) =>
                      message.type === "human" ? (
                        <HumanMessage
                          isLoading={isLoading}
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                        />
                      ) : (
                        <AssistantMessage
                          handleRegenerate={handleRegenerate}
                          isLoading={isLoading}
                          key={message.id || `${message.type}-${index}`}
                          message={message}
                        />
                      )
                    )}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt. */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      handleRegenerate={handleRegenerate}
                      isLoading={isLoading}
                      key="interrupt-msg"
                      message={undefined}
                    />
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                </>
              )}
            </>
          }
          contentClassName={cn(
            "relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 pb-24"
          )}
          footer={
            <div className="sticky bottom-0">
              <ScrollToBottom className="-translate-x-1/2 absolute bottom-full left-1/2 mb-4" />
            </div>
          }
        />
      </StickToBottom>

      {/* Prompt Input */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-transparent pb-3">
        <div
          className="pointer-events-auto relative mx-auto w-full max-w-3xl px-4"
          ref={dropRef}
        >
          <form
            className={cn(
              "relative z-20 flex w-full flex-col gap-3",
              dragOver && "rounded-xl border-2 border-primary border-dotted p-3"
            )}
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-3">
              <input
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                id="thread-file-input"
                multiple
                onChange={handleFileUpload}
                ref={fileInputRef}
                type="file"
              />
              <ContentBlocksPreview
                blocks={contentBlocks}
                onRemove={removeBlock}
              />
              <div
                className={cn(
                  "flex w-full items-end rounded-xl border border-input bg-background px-3 py-2 shadow-sm transition-[border-color,box-shadow]",
                  "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
                )}
              >
                <div className="flex flex-1 items-end gap-2">
                  <Button
                    aria-label="Upload files"
                    className="size-10 shrink-0 rounded-lg hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Plus className="size-5" />
                  </Button>

                  <AutoResizeTextarea
                    aria-label="Message input"
                    className="flex-1 resize-none rounded-lg border border-transparent px-3 py-1.5 text-base leading-6"
                    maxRows={8}
                    minRows={1}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.metaKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        const el = event.target as HTMLElement | undefined;
                        const form = el?.closest("form");
                        form?.requestSubmit();
                      }
                    }}
                    onPaste={handlePaste}
                    placeholder="Send a message..."
                    value={input}
                  />
                </div>

                <div className="ml-2 flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={
                          hideToolCalls ? "Show tool calls" : "Hide tool calls"
                        }
                        aria-pressed={toolsVisible}
                        className="size-10 rounded-lg hover:text-primary"
                        data-active={toolsVisible}
                        onClick={() =>
                          setHideToolCalls(!(hideToolCalls ?? false))
                        }
                        onMouseEnter={() => setToolToggleHovered(true)}
                        onMouseLeave={() => setToolToggleHovered(false)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <WrenchIcon
                          className={cn(
                            "size-5 transition-colors",
                            toolsVisible
                              ? toolToggleHovered
                                ? "text-muted-foreground"
                                : "text-primary"
                              : toolToggleHovered
                                ? "text-primary"
                                : "text-muted-foreground"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hideToolCalls ? "Show tool calls" : "Hide tool calls"}
                    </TooltipContent>
                  </Tooltip>

                  {stream.isLoading ? (
                    <Button
                      aria-label="Cancel streaming"
                      className="size-10 rounded-lg"
                      onClick={() => stream.stop()}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <LoaderCircle className="size-5 animate-spin" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {/* Original button group retained for reference */}
              <ButtonGroup className="hidden w-full [--radius:9999rem]">
                <ButtonGroup className="flex-1">
                  <InputGroup className="h-auto min-h-12 flex-1 items-start bg-background py-2">
                    <InputGroupAddon align="inline-start">
                      <Button
                        aria-label="Upload files"
                        className="size-10 hover:text-primary"
                        onClick={() => fileInputRef.current?.click()}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Plus className="size-5" />
                      </Button>
                    </InputGroupAddon>
                    <AutoResizeTextarea
                      aria-label="Message input"
                      className="text-base leading-6"
                      maxRows={8}
                      minRows={1}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.metaKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          const el = event.target as HTMLElement | undefined;
                          const form = el?.closest("form");
                          form?.requestSubmit();
                        }
                      }}
                      onPaste={handlePaste}
                      placeholder="Send a message..."
                      value={input}
                    />
                    <InputGroupAddon align="inline-end" className="gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InputGroupButton
                            aria-label={
                              hideToolCalls
                                ? "Show tool calls"
                                : "Hide tool calls"
                            }
                            aria-pressed={toolsVisible}
                            className="size-10 hover:bg-transparent"
                            data-active={toolsVisible}
                            onClick={() =>
                              setHideToolCalls(!(hideToolCalls ?? false))
                            }
                            onMouseEnter={() => setToolToggleHovered(true)}
                            onMouseLeave={() => setToolToggleHovered(false)}
                            size="icon-sm"
                            type="button"
                          >
                            <WrenchIcon
                              className={cn(
                                "size-5 transition-colors",
                                toolsVisible
                                  ? toolToggleHovered
                                    ? "text-muted-foreground"
                                    : "text-primary"
                                  : toolToggleHovered
                                    ? "text-primary"
                                    : "text-muted-foreground"
                              )}
                            />
                          </InputGroupButton>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hideToolCalls
                            ? "Show tool calls"
                            : "Hide tool calls"}
                        </TooltipContent>
                      </Tooltip>

                      {stream.isLoading ? (
                        <InputGroupButton
                          aria-label="Cancel streaming"
                          className="size-10"
                          onClick={() => stream.stop()}
                          size="icon-sm"
                          type="button"
                        >
                          <LoaderCircle className="size-5 animate-spin" />
                        </InputGroupButton>
                      ) : null}
                    </InputGroupAddon>
                  </InputGroup>
                </ButtonGroup>
              </ButtonGroup>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      centerPanel={centerPanel}
      leftPanel={leftPanel}
      leftPanelCollapsed={!chatHistoryOpen}
      rightPanel={rightPanel}
      rightPanelCollapsed={!artifactOpen}
      rightPanelVisible={artifactOpen}
    />
  );
}
