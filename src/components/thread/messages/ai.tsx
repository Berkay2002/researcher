/** biome-ignore-all lint/style/useBlockStatements: <Ignore> */
/** biome-ignore-all lint/style/useAtIndex: <Ignore> */
/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: <Ignore> */
/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <Ignore> */
/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <Ignore> */
/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <Ignore> */

import type { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { ThreadView } from "../agent-inbox";
import { useArtifact } from "../artifact";
import { MarkdownText } from "../markdown-text";
import { getContentString } from "../utils";
import { GenericInterruptView } from "./generic-interrupt";
import { BranchSwitcher, CommandBar } from "./shared";
import { ToolCalls, ToolResult } from "./tool-calls";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
          stream={thread}
        />
      ))}
    </Fragment>
  );
}

interface InterruptProps {
  interruptValue?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interruptValue,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  return (
    <>
      {isAgentInboxInterruptSchema(interruptValue) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interruptValue} />
        )}
      {interruptValue &&
      !isAgentInboxInterruptSchema(interruptValue) &&
      (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView interrupt={interruptValue} />
      ) : null}
    </>
  );
}

/**
 * Extract node name from metadata for subgraph context display
 */
function getNodeName(meta: unknown): string | null {
  // Check if metadata exists and has langgraph_node
  if (!meta || typeof meta !== "object") return null;

  // Get node from various possible metadata locations
  const metaObj = meta as Record<string, unknown>;
  const firstSeenState = metaObj.firstSeenState as
    | Record<string, unknown>
    | undefined;
  const stateMetadata = firstSeenState?.metadata as
    | Record<string, unknown>
    | undefined;
  const nodeFromState = stateMetadata?.langgraph_node as string | undefined;

  if (nodeFromState) return nodeFromState;

  return null;
}

/**
 * Badge component to display the subgraph/node context
 */
function NodeBadge({ nodeName }: { nodeName: string }) {
  // Map node names to display labels
  const displayName = nodeName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700 text-xs ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
      {displayName}
    </span>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false)
  );

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool"
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;
  const isToolResult = message?.type === "tool";
  const nodeName = getNodeName(meta);

  if (isToolResult && hideToolCalls) {
    return null;
  }

  return (
    <div className="group flex w-full justify-center py-4">
      <div className="flex w-full max-w-3xl flex-col gap-3">
        {isToolResult ? (
          <>
            <ToolResult message={message} />
            <Interrupt
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
            />
          </>
        ) : (
          <>
            {nodeName && (
              <div className="flex items-center gap-2">
                <NodeBadge nodeName={nodeName} />
              </div>
            )}

            {contentString.length > 0 && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {!hideToolCalls && hasToolCalls && (
              <ToolCalls toolCalls={message.tool_calls} />
            )}

            {message && <CustomComponent message={message} thread={thread} />}
            <Interrupt
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
            />
            <div
              className={cn(
                "flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              )}
            >
              <BranchSwitcher
                branch={meta?.branch}
                branchOptions={meta?.branchOptions}
                isLoading={isLoading}
                onSelect={(branch) => thread.setBranch(branch)}
              />
              <CommandBar
                content={contentString}
                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
                isAiMessage={true}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="flex w-full justify-center py-4">
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <div className="flex h-8 w-fit items-center gap-1 rounded-2xl bg-muted px-4 py-2">
          <div className="h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full bg-foreground/50" />
          <div className="h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full bg-foreground/50" />
          <div className="h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full bg-foreground/50" />
        </div>
      </div>
    </div>
  );
}
