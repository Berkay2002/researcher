"use client";

import { type FormEvent, useState } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";

export type AgentInputProps = {
  onSubmit: (prompt: string) => void;
  isSubmitting?: boolean;
  className?: string;
};

export function AgentInput({
  onSubmit,
  isSubmitting = false,
  className,
}: AgentInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (
    message: { text?: string },
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const prompt = message.text?.trim() || "";
    if (!prompt) {
      return;
    }

    onSubmit(prompt);
    setInputValue("");
  };

  return (
    <PromptInput className={className} onSubmit={handleSubmit}>
      <PromptInputBody>
        <PromptInputTextarea
          disabled={isSubmitting}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="What should the agent do?"
          value={inputValue}
        />
      </PromptInputBody>
      <PromptInputToolbar>
        <PromptInputSubmit
          disabled={isSubmitting || !inputValue.trim()}
          status={isSubmitting ? "submitted" : undefined}
        />
      </PromptInputToolbar>
    </PromptInput>
  );
}
