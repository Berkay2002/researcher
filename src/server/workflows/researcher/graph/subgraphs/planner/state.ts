import { z } from "zod";

/**
 * Prompt Analysis Result
 *
 * LLM analysis of user prompt completeness
 */
export const PromptAnalysisSchema = z.object({
  isComplete: z.boolean(),
  missingAspects: z.array(z.string()),
  suggestedQuestions: z.array(z.string()),
});

export type PromptAnalysis = z.infer<typeof PromptAnalysisSchema>;

/**
 * Interrupt Payloads
 *
 * Structures returned during HITL pauses
 */
export const InterruptPayloadSchema = z.object({
  stage: z.enum(["question"]),
  questionId: z.string(),
  questionText: z.string(),
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })
  ),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InterruptPayload = z.infer<typeof InterruptPayloadSchema>;
