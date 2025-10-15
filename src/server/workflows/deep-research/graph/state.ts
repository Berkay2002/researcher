/**
 * Graph state definitions and data structures for the Deep Research agent.
 *
 * This module defines all state annotations, schemas, and types following
 * LangGraph 1.0-alpha patterns with Zod validation.
 */

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

// ============================================================================
// Structured Outputs
// ============================================================================

/**
 * Call this tool to conduct research on a specific topic
 */
export const ConductResearchSchema = z.object({
  research_topic: z
    .string()
    .describe(
      "The topic to research. Should be a single topic, and should be described in high detail (at least a paragraph)."
    ),
});

export type ConductResearch = z.infer<typeof ConductResearchSchema>;

/**
 * Call this tool to indicate that the research is complete
 */
export const ResearchCompleteSchema = z.object({});

export type ResearchComplete = z.infer<typeof ResearchCompleteSchema>;

/**
 * Research summary with key findings
 */
export const SummarySchema = z.object({
  summary: z.string(),
  key_excerpts: z.string(),
});

export type Summary = z.infer<typeof SummarySchema>;

/**
 * Model for user clarification requests
 */
export const ClarifyWithUserSchema = z.object({
  need_clarification: z
    .boolean()
    .describe("Whether the user needs to be asked a clarifying question."),
  question: z
    .string()
    .describe("A question to ask the user to clarify the report scope"),
  verification: z
    .string()
    .describe(
      "Verify message that we will start research after the user has provided the necessary information."
    ),
});

export type ClarifyWithUser = z.infer<typeof ClarifyWithUserSchema>;

/**
 * Research question and brief for guiding research
 */
export const ResearchQuestionSchema = z.object({
  research_brief: z
    .string()
    .describe("A research question that will be used to guide the research."),
});

export type ResearchQuestion = z.infer<typeof ResearchQuestionSchema>;

// ============================================================================
// State Reducer Functions
// ============================================================================

/**
 * Reducer function that allows overriding values in state.
 * Used for fields that need explicit override semantics.
 */
function overrideReducer<T>(
  currentValue: T[] | undefined,
  newValue: T[] | { type: "override"; value: T[] }
): T[] {
  if (
    typeof newValue === "object" &&
    newValue !== null &&
    "type" in newValue &&
    newValue.type === "override"
  ) {
    return newValue.value;
  }
  return [...(currentValue ?? []), ...(newValue as T[])];
}

// ============================================================================
// Main Agent State Annotations
// ============================================================================

/**
 * Input state for the agent - only messages
 */
export const AgentInputStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),
});

export type AgentInputState = typeof AgentInputStateAnnotation.State;

/**
 * Main agent state containing messages and research data
 */
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  supervisor_messages: Annotation<BaseMessage[]>({
    reducer: overrideReducer,
    default: () => [],
  }),

  research_brief: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  raw_notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),

  notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),

  final_report: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

// ============================================================================
// Supervisor State Annotation
// ============================================================================

/**
 * State for the supervisor that manages research tasks
 */
export const SupervisorStateAnnotation = Annotation.Root({
  supervisor_messages: Annotation<BaseMessage[]>({
    reducer: overrideReducer,
    default: () => [],
  }),

  research_brief: Annotation<string>({
    reducer: (_, next) => next,
  }),

  notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),

  raw_notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),
});

export type SupervisorState = typeof SupervisorStateAnnotation.State;

// ============================================================================
// Researcher State Annotations
// ============================================================================

/**
 * State for individual researchers conducting research
 */
export const ResearcherStateAnnotation = Annotation.Root({
  researcher_messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...(prev ?? []), ...next],
    default: () => [],
  }),

  research_topic: Annotation<string>({
    reducer: (_, next) => next,
  }),

  compressed_research: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  raw_notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),
});

export type ResearcherState = typeof ResearcherStateAnnotation.State;

/**
 * Output state from individual researchers
 */
export const ResearcherOutputStateAnnotation = Annotation.Root({
  compressed_research: Annotation<string>({
    reducer: (_, next) => next,
  }),

  raw_notes: Annotation<string[]>({
    reducer: overrideReducer,
    default: () => [],
  }),
});

export type ResearcherOutputState =
  typeof ResearcherOutputStateAnnotation.State;
