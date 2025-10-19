"use client";

// biome-ignore lint/performance/noNamespaceImport: <It is fine>
import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.ComponentProps<typeof TextareaAutosize> {
  maxHeightClassName?: string;
  invalid?: boolean;
  onHeightChange?: (height: number) => void;
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
      onHeightChange,
      onChange,
      onInput,
      onPaste,
      minRows = 1,
      maxRows = 12,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const lastReportedHeightRef = React.useRef<number | null>(null);
    const [clamped, setClamped] = React.useState(false);

    const measure = React.useCallback(() => {
      const el = innerRef.current;
      // biome-ignore lint/style/useBlockStatements: <Ignore>
      if (!el) return;
      const clientHeight = el.clientHeight;
      const scrollHeight = el.scrollHeight;
      const isClamped = scrollHeight > clientHeight + 1;
      if (isClamped !== clamped) {
        setClamped(isClamped);
      }

      if (onHeightChange) {
        const reportedHeight = isClamped
          ? clientHeight
          : Math.max(clientHeight, scrollHeight);

        if (lastReportedHeightRef.current !== reportedHeight) {
          lastReportedHeightRef.current = reportedHeight;
          onHeightChange(reportedHeight);
        }
      }
    }, [clamped, onHeightChange]);

    const scheduleMeasure = React.useCallback(() => {
      queueMicrotask(() => {
        measure();
      });
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          measure();
        });
      }
      setTimeout(() => {
        measure();
      }, 0);
    }, [measure]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <Ignore>
    React.useLayoutEffect(() => {
      scheduleMeasure();
    }, [scheduleMeasure, props.value]);

    const composedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (!node) {
          lastReportedHeightRef.current = null;
        }
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
        if (node) {
          scheduleMeasure();
        }
      },
      [forwardedRef, scheduleMeasure]
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
          scheduleMeasure();
        }}
        onInput={(event) => {
          onInput?.(event);
          scheduleMeasure();
        }}
        onPaste={(event) => {
          onPaste?.(event);
          scheduleMeasure();
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
