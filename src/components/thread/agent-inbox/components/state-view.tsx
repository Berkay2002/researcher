/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <ignore> */
/** biome-ignore-all lint/nursery/noShadow: <ignore> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <ignore> */
/** biome-ignore-all lint/style/noMagicNumbers: <ignore> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <ignore> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <ignore> */
/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: <ignore> */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: <ignore> */
import type { BaseMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import { motion } from "framer-motion";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownText } from "../../markdown-text";
import {
  baseMessageObject,
  isArrayOfMessages,
  prettifyText,
  unknownToPrettyDate,
} from "../utils";
import { ToolCallTable } from "./tool-call-table";

interface StateViewRecursiveProps {
  value: unknown;
  expanded?: boolean;
}

const messageTypeToLabel = (message: BaseMessage) => {
  let type = "";
  if ("type" in message && typeof message.type === "string") {
    type = message.type;
  } else if ("_getType" in message && typeof message._getType === "function") {
    type = message._getType();
  }

  switch (type) {
    case "human":
      return "User";
    case "ai":
      return "Assistant";
    case "tool":
      return "Tool";
    case "System":
      return "System";
    default:
      return "";
  }
};

function MessagesRenderer({ messages }: { messages: BaseMessage[] }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {messages.map((msg, idx) => {
        const messageTypeLabel = messageTypeToLabel(msg);
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content, null);
        return (
          <div
            className="ml-2 flex w-full flex-col gap-[2px]"
            key={msg.id ?? `message-${idx}`}
          >
            <p className="font-medium text-gray-700">{messageTypeLabel}:</p>
            {content && <MarkdownText>{content}</MarkdownText>}
            {"tool_calls" in msg && msg.tool_calls ? (
              <div className="flex w-full flex-col items-start gap-1">
                {(msg.tool_calls as ToolCall[]).map((tc, idx) => (
                  <ToolCallTable
                    key={tc.id ?? `tool-call-${idx}`}
                    toolCall={tc}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StateViewRecursive(props: StateViewRecursiveProps) {
  const date = unknownToPrettyDate(props.value);
  if (date) {
    return <p className="font-light text-gray-600">{date}</p>;
  }

  if (["string", "number"].includes(typeof props.value)) {
    return <MarkdownText>{props.value as string}</MarkdownText>;
  }

  if (typeof props.value === "boolean") {
    return <MarkdownText>{JSON.stringify(props.value)}</MarkdownText>;
  }

  if (props.value == null) {
    return <p className="whitespace-pre-wrap font-light text-gray-600">null</p>;
  }

  if (Array.isArray(props.value)) {
    if (props.value.length > 0 && isArrayOfMessages(props.value)) {
      return <MessagesRenderer messages={props.value} />;
    }

    const valueArray = props.value as unknown[];
    return (
      <div className="flex w-full flex-row items-start justify-start gap-1">
        <span className="font-normal text-black">[</span>
        {valueArray.map((item, idx) => {
          const itemRenderValue = baseMessageObject(item);
          return (
            <div
              className="flex w-full flex-row items-start whitespace-pre-wrap"
              key={`state-view-${idx}`}
            >
              <StateViewRecursive value={itemRenderValue} />
              {idx < valueArray?.length - 1 && (
                <span className="font-normal text-black">,&nbsp;</span>
              )}
            </div>
          );
        })}
        <span className="font-normal text-black">]</span>
      </div>
    );
  }

  if (typeof props.value === "object") {
    if (Object.keys(props.value).length === 0) {
      return <p className="font-light text-gray-600">{"{}"}</p>;
    }
    return (
      <div className="relative ml-6 flex w-full flex-col items-start justify-start gap-1">
        {/* Vertical line */}
        <div className="absolute top-0 left-[-24px] h-full w-[1px] bg-gray-200" />

        {Object.entries(props.value).map(([key, value], idx) => (
          <div
            className="relative w-full"
            key={`state-view-object-${key}-${idx}`}
          >
            {/* Horizontal connector line */}
            <div className="absolute top-[10px] left-[-20px] h-[1px] w-[18px] bg-gray-200" />
            <StateViewObject
              expanded={props.expanded}
              keyName={key}
              value={value}
            />
          </div>
        ))}
      </div>
    );
  }
}

function HasContentsEllipsis({ onClick }: { onClick?: () => void }) {
  return (
    <span
      className={cn(
        "rounded-md p-[2px] font-mono text-[10px] leading-3",
        "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800",
        "cursor-pointer transition-colors ease-in-out",
        "-translate-y-[2px] inline-block"
      )}
      onClick={onClick}
    >
      {"{...}"}
    </span>
  );
}

interface StateViewProps {
  keyName: string;
  value: unknown;
  /**
   * Whether or not to expand or collapse the view
   * @default true
   */
  expanded?: boolean;
}

export function StateViewObject(props: StateViewProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (props.expanded != null) {
      setExpanded(props.expanded);
    }
  }, [props.expanded]);

  return (
    <div className="relative flex flex-row items-start justify-start gap-2 text-sm">
      <motion.div
        animate={{ rotate: expanded ? 90 : 0 }}
        initial={false}
        transition={{ duration: 0.2 }}
      >
        <div
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors ease-in-out hover:bg-gray-100 hover:text-black"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <ChevronRight className="h-4 w-4" />
        </div>
      </motion.div>
      <div className="flex w-full flex-col items-start justify-start gap-1">
        <p className="font-normal text-black">
          {prettifyText(props.keyName)}{" "}
          {!expanded && (
            <HasContentsEllipsis onClick={() => setExpanded((prev) => !prev)} />
          )}
        </p>
        <motion.div
          animate={{
            height: expanded ? "auto" : 0,
            opacity: expanded ? 1 : 0,
          }}
          className="relative w-full"
          initial={false}
          style={{ overflow: "hidden" }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
        >
          <StateViewRecursive expanded={props.expanded} value={props.value} />
        </motion.div>
      </div>
    </div>
  );
}

interface StateViewComponentProps {
  values: Record<string, any>;
  description: string | undefined;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  view: "description" | "state";
}

export function StateView({
  handleShowSidePanel,
  view,
  values,
  description,
}: StateViewComponentProps) {
  const [expanded, setExpanded] = useState(false);

  if (!values) {
    return <div>No state found</div>;
  }

  return (
    <div
      className={cn(
        "flex w-full flex-row gap-0",
        view === "state" &&
          "border-gray-100 border-t-[1px] lg:border-t-[0px] lg:border-l-[1px]"
      )}
    >
      {view === "description" && (
        <div className="pt-6 pb-2">
          <MarkdownText>
            {description ?? "No description provided"}
          </MarkdownText>
        </div>
      )}
      {view === "state" && (
        <div className="flex flex-col items-start justify-start gap-1">
          {Object.entries(values).map(([k, v], idx) => (
            <StateViewObject
              expanded={expanded}
              key={`state-view-${k}-${idx}`}
              keyName={k}
              value={v}
            />
          ))}
        </div>
      )}
      <div className="flex items-start justify-end gap-2">
        {view === "state" && (
          <Button
            className="text-gray-600"
            onClick={() => setExpanded((prev) => !prev)}
            size="sm"
            variant="ghost"
          >
            {expanded ? (
              <ChevronsUpDown className="h-4 w-4" />
            ) : (
              <ChevronsDownUp className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          className="text-gray-600"
          onClick={() => handleShowSidePanel(false, false)}
          size="sm"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
