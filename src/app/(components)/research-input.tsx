"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { useState, type FormEvent } from "react";
import { ModeSwitch } from "./ModeSwitch";

/**
 * Research Input Props
 */
export type ResearchInputProps = {
  onSubmit: (goal: string, mode: "auto" | "plan") => void;
  isSubmitting?: boolean;
  className?: string;
};

/**
 * Research Input Component
 *
 * Main input for starting research sessions.
 * Combines PromptInput with ModeSwitch.
 */
export function ResearchInput({
  onSubmit,
  isSubmitting = false,
  className,
}: ResearchInputProps) {
  const [mode, setMode] = useState<"auto" | "plan">("auto");
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (
    message: { text?: string },
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const goal = message.text?.trim() || "";

    if (!goal) {
      return;
    }

    onSubmit(goal, mode);
    setInputValue(""); // Clear input after submit
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mode Switch */}
      <ModeSwitch initialMode={mode} onChange={setMode} />

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="What would you like to research?"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isSubmitting}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>{/* Tools can go here */}</PromptInputTools>
          <PromptInputSubmit
            disabled={isSubmitting || !inputValue.trim()}
            status={isSubmitting ? "submitted" : undefined}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
