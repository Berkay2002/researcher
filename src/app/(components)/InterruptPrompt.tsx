"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { InterruptPayload } from "@/server/graph/subgraphs/planner/state";
import { AlertCircleIcon, HelpCircleIcon } from "lucide-react";
import { useCallback, useState } from "react";

/**
 * Interrupt Prompt Props
 */
export type InterruptPromptProps = {
  interrupt: InterruptPayload;
  onSubmit: (response: unknown) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  className?: string;
};

/**
 * Interrupt Prompt Component
 *
 * Production-ready HITL question handler for Plan mode:
 * - Displays one LLM-generated question at a time
 * - Shows 4 contextual options + "Custom" option
 * - Iterative multi-question flow (1-4 questions total)
 * - Full validation and error handling
 * - Accessibility compliance
 */
export function InterruptPrompt({
  interrupt,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: InterruptPromptProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customAnswer, setCustomAnswer] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isCustomSelected = selectedOption === "custom";

  /**
   * Handle submission with validation
   */
  const handleSubmit = useCallback(() => {
    setValidationError(null);

    // Validation: must select an option
    if (!selectedOption) {
      setValidationError("Please select an option");
      return;
    }

    // Validation: if custom selected, must provide text
    if (isCustomSelected && !customAnswer.trim()) {
      setValidationError("Please enter your custom answer");
      return;
    }

    // Build response payload
    const response = {
      questionId: interrupt.questionId,
      selectedOption,
      customAnswer: isCustomSelected ? customAnswer.trim() : undefined,
    };

    onSubmit(response);
  }, [
    selectedOption,
    customAnswer,
    isCustomSelected,
    interrupt.questionId,
    onSubmit,
  ]);

  /**
   * Handle cancel action
   */
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  /**
   * Handle option change
   */
  const handleOptionChange = useCallback((value: string) => {
    setSelectedOption(value);
    setValidationError(null);

    // Clear custom answer if switching away from custom
    if (value !== "custom") {
      setCustomAnswer("");
    }
  }, []);

  // Question stage
  if (interrupt.stage === "question") {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-start gap-2">
            <HelpCircleIcon className="mt-1 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-lg">Research Planning</CardTitle>
              <CardDescription className="mt-2 text-base">
                {interrupt.questionText}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {validationError && (
            <Alert variant="destructive">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Options */}
          <RadioGroup
            value={selectedOption}
            onValueChange={handleOptionChange}
            disabled={isSubmitting}
          >
            {interrupt.options?.map((option) => {
              const isCustomOption = option.value === "custom";

              return (
                <div
                  key={option.value}
                  className="flex items-start space-x-3 space-y-0 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={option.value}
                      className="cursor-pointer font-medium leading-tight"
                    >
                      {option.label}
                    </Label>
                    {option.description && !isCustomOption && (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          {/* Custom Answer Input */}
          {isCustomSelected && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="customAnswer">Your Custom Answer</Label>
              <Textarea
                id="customAnswer"
                placeholder="Enter your specific requirements or answer..."
                value={customAnswer}
                onChange={(e) => {
                  setCustomAnswer(e.target.value);
                  setValidationError(null);
                }}
                disabled={isSubmitting}
                rows={4}
                className="resize-none"
                aria-describedby="custom-help"
              />
              <p className="text-muted-foreground text-xs" id="custom-help">
                Provide as much detail as possible to help tailor the research
              </p>
            </div>
          )}

          {/* Question Metadata (if any) */}
          {interrupt.metadata?.totalQuestions && (
            <div className="flex items-center justify-between border-t pt-3 text-muted-foreground text-xs">
              <span>Question progress</span>
              <span>
                {(interrupt.metadata.currentQuestion as number) || 1} of{" "}
                {interrupt.metadata.totalQuestions}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {onCancel && (
            <Button
              onClick={handleCancel}
              disabled={isSubmitting}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!selectedOption || isSubmitting}
            className="flex-1"
            type="button"
          >
            {isSubmitting ? "Submitting..." : "Continue"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Unknown stage (should never happen with current schema)
  return (
    <Alert variant="destructive">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>Unknown Interrupt Stage</AlertTitle>
      <AlertDescription>
        The interrupt stage "{interrupt.stage}" is not recognized.
      </AlertDescription>
    </Alert>
  );
}
