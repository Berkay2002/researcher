"use client";

import { type FormEvent, useState } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
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
 * Combines PromptInput with ModeSwitch inside toolbar.
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
    <PromptInput className={className} onSubmit={handleSubmit}>
      <PromptInputBody>
        <PromptInputTextarea
          disabled={isSubmitting}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What would you like to research?"
          value={inputValue}
        />
      </PromptInputBody>
      <PromptInputToolbar>
        <PromptInputTools>
          {/* Mode Switch inside toolbar */}
          <ModeSwitch initialMode={mode} onChange={setMode} />
        </PromptInputTools>
        <PromptInputSubmit
          disabled={isSubmitting || !inputValue.trim()}
          status={isSubmitting ? "submitted" : undefined}
        />
      </PromptInputToolbar>
    </PromptInput>
  );
}
