import { z } from "zod";

/**
 * Plan Template Types
 *
 * Predefined research strategies for Plan mode
 */
export type PlanTemplate =
  | "quick_scan"
  | "systematic_review"
  | "competitive_landscape"
  | "deep_technical"
  | "custom";

export const PlanTemplateSchema = z.enum([
  "quick_scan",
  "systematic_review",
  "competitive_landscape",
  "deep_technical",
  "custom",
]);

/**
 * Constraint Options
 *
 * User-specified constraints for research execution
 */
export const ConstraintsSchema = z.object({
  deadline: z.string().optional(), // e.g., "3 hours", "1 day"
  budget: z.number().optional(), // USD
  domains: z.array(z.string()).optional(), // Domain scoping
  depth: z.enum(["surface", "moderate", "deep"]).optional(),
  sources: z.enum(["minimal", "diverse", "comprehensive"]).optional(),
});

export type Constraints = z.infer<typeof ConstraintsSchema>;

/**
 * Plan Templates with Default DAGs
 */
export const PLAN_TEMPLATES: Record<
  PlanTemplate,
  {
    name: string;
    description: string;
    deliverable: string;
    dag: string[];
    defaultConstraints: Constraints;
  }
> = {
  quick_scan: {
    name: "Quick Scan",
    description: "Fast overview with minimal depth, 5-10 sources",
    deliverable: "Brief summary with key findings and top sources",
    dag: ["query", "search", "harvest", "write"],
    defaultConstraints: {
      depth: "surface",
      sources: "minimal",
    },
  },
  systematic_review: {
    name: "Systematic Review",
    description:
      "Comprehensive analysis across multiple domains, 20-50 sources",
    deliverable:
      "Detailed report with methodology, findings, and recommendations",
    dag: ["query", "search", "harvest", "verify", "write"],
    defaultConstraints: {
      depth: "deep",
      sources: "comprehensive",
    },
  },
  competitive_landscape: {
    name: "Competitive Landscape",
    description: "Market analysis with competitor comparisons, 15-30 sources",
    deliverable:
      "Competitive matrix with strengths, weaknesses, and opportunities",
    dag: ["query", "search", "harvest", "verify", "write"],
    defaultConstraints: {
      depth: "moderate",
      sources: "diverse",
    },
  },
  deep_technical: {
    name: "Deep Technical Dossier",
    description:
      "In-depth technical analysis with verification, 30-100 sources",
    deliverable: "Technical report with code examples, diagrams, and citations",
    dag: ["query", "search", "harvest", "verify", "write"],
    defaultConstraints: {
      depth: "deep",
      sources: "comprehensive",
    },
  },
  custom: {
    name: "Custom",
    description: "User-defined research strategy",
    deliverable: "Custom deliverable based on user requirements",
    dag: ["query", "search", "harvest", "verify", "write"],
    defaultConstraints: {
      depth: "moderate",
      sources: "diverse",
    },
  },
};

/**
 * Interrupt Payloads
 *
 * Structures returned during HITL pauses
 */
export const InterruptPayloadSchema = z.object({
  stage: z.enum(["template_selection", "constraints"]),
  question: z.string(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        description: z.string(),
      })
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InterruptPayload = z.infer<typeof InterruptPayloadSchema>;
