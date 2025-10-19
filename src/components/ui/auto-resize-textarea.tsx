"use client";

// biome-ignore lint/performance/noNamespaceImport: <It is fine>
import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.ComponentProps<typeof TextareaAutosize> {
  maxHeightClassName?: string;
  invalid?: boolean;
}

// biome-ignore lint/nursery/noReactForwardRef: <It is fine>
export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(
  (
    {
      className,
      maxHeightClassName = "max-h-[50vh]",
      invalid,
      onChange,
      onInput,
      minRows = 1,
      maxRows = 12,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [clamped, setClamped] = React.useState(false);

    const measure = React.useCallback(() => {
      const el = innerRef.current;
      // biome-ignore lint/style/useBlockStatements: <Ignore>
      if (!el) return;
      const isClamped = el.scrollHeight > el.clientHeight + 1;
      if (isClamped !== clamped) {
        setClamped(isClamped);
      }
    }, [clamped]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <Ignore>
    React.useEffect(() => {
      queueMicrotask(measure);
    }, [measure, props.value]);

    const composedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
        if (node) {
          queueMicrotask(measure);
        }
      },
      [forwardedRef, measure]
    );

    return (
      <TextareaAutosize
        {...props}
        className={cn(
          "flex w-full resize-none rounded-none border-none bg-transparent px-3 py-2 text-base text-foreground leading-6 shadow-none outline-none transition-[height] duration-150 ease-out focus-visible:outline-none focus-visible:ring-0 dark:bg-transparent",
          maxHeightClassName,
          clamped ? "overflow-y-auto" : "overflow-y-hidden",
          invalid && "aria-invalid:border-destructive",
          className
        )}
        data-slot="input-group-control"
        inputMode="text"
        maxRows={maxRows}
        minRows={minRows}
        onChange={(event) => {
          onChange?.(event);
          queueMicrotask(measure);
        }}
        onInput={(event) => {
          onInput?.(event);
          queueMicrotask(measure);
        }}
        ref={composedRef}
        style={{
          WebkitOverflowScrolling: clamped ? "touch" : undefined,
        }}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
