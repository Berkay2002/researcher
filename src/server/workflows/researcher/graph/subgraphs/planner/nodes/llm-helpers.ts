/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createLLM } from "@/server/shared/configs/llm";
import { getCurrentDateString } from "@/server/shared/utils/current-date";
import type { Plan, Question, QuestionAnswer } from "../../../state";
import type { PromptAnalysis } from "../state";

// LLM Configuration - Using Gemini via OpenAI SDK compatibility
const ANALYSIS_MODEL = "gemini-2.5-pro"; // Gemini 2.5 Pro for reasoning tasks (agentic)
const GENERATION_MODEL = "gemini-flash-latest"; // Gemini 2.5 Flash for well-defined tasks
const DEFAULT_TEMPERATURE = 0.3;

// Logging constants
const LOG_PREVIEW_LENGTH = 500; // Characters to show in log previews
const LOG_ERROR_PREVIEW_LENGTH = 200; // Characters to show in error previews

// System prompt paths
const PROMPTS_DIR = join(
  process.cwd(),
  "src",
  "server",
  "shared",
  "configs",
  "prompts"
);

/**
 * Load system prompt from file
 */
async function loadSystemPrompt(filename: string): Promise<string> {
  const filePath = join(PROMPTS_DIR, filename);
  return await fs.readFile(filePath, "utf-8");
}

/**
 * Load system prompt and inject current date context
 */
async function loadSystemPromptWithDate(filename: string): Promise<string> {
  const basePrompt = await loadSystemPrompt(filename);
  const currentDate = getCurrentDateString();

  // Prepend date context to the prompt
  return `**CURRENT DATE: ${currentDate}**

Note: Today's date is ${currentDate}. When considering timeframes, recency, or temporal context, use this as your reference point.

---

${basePrompt}`;
}

/**
 * Analyze prompt completeness
 *
 * Uses Gemini 2.5 Pro to identify missing information in user's research prompt
 */
export async function analyzePromptCompleteness(
  goal: string
): Promise<PromptAnalysis> {
  console.log("[analyzePromptCompleteness] Analyzing prompt:", goal);

  const systemPrompt = await loadSystemPromptWithDate(
    "prompt-analyzer.system.md"
  );

  const llm = createLLM(ANALYSIS_MODEL, DEFAULT_TEMPERATURE).bind({
    response_format: { type: "json_object" },
  });

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Analyze this research prompt and identify any missing information:\n\n"${goal}"\n\nRespond with JSON following the schema in the system prompt.`
    ),
  ]);

  const content = response.content as string;
  const analysis = JSON.parse(content) as PromptAnalysis;

  console.log(
    `[analyzePromptCompleteness] Complete: ${analysis.isComplete}, Missing: ${analysis.missingAspects.length} aspects`
  );

  return analysis;
}

/**
 * Normalize raw questions from LLM to stable IDs
 *
 * Ensures consistent question IDs even if LLM slightly renames them
 */
function normalizeQuestions(raw: Record<string, unknown>[]): Question[] {
  return raw.map((q, i) => {
    const base =
      (typeof q.id === "string" && q.id.trim()) ||
      (typeof q.aspect === "string" &&
        `q${i + 1}_${q.aspect.toLowerCase().replace(/\W+/g, "_")}`) ||
      `q${i + 1}`;

    return {
      id: base,
      text: String(q.text ?? "").trim(),
      options: Array.isArray(q.options)
        ? q.options.map((o: Record<string, unknown>) => ({
            value: String(o.value ?? "").trim(),
            label: String(o.label ?? "").trim(),
            description:
              typeof o.description === "string" ? o.description : undefined,
          }))
        : [],
    };
  });
}

/**
 * Generate dynamic questions based on prompt analysis
 *
 * Uses Gemini 2.5 Flash to create questions with contextual answer options
 */
export async function generateDynamicQuestions(
  goal: string,
  analysis: PromptAnalysis
): Promise<Question[]> {
  if (analysis.isComplete) {
    console.log(
      "[generateDynamicQuestions] Prompt is complete, no questions needed"
    );
    return [];
  }

  console.log(
    `[generateDynamicQuestions] Generating questions for ${analysis.missingAspects.length} missing aspects`
  );

  const systemPrompt = await loadSystemPromptWithDate(
    "question-generator.system.md"
  );

  const llm = createLLM(GENERATION_MODEL, DEFAULT_TEMPERATURE).bind({
    response_format: { type: "json_object" },
  });

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Generate clarifying questions for this research prompt:

Original goal: "${goal}"

Missing aspects: ${analysis.missingAspects.join(", ")}

Suggested questions from analysis:
${analysis.suggestedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Respond with a JSON object containing a "questions" array following the schema in the system prompt.`
    ),
  ]);

  const content = response.content as string;
  console.log(
    "[generateDynamicQuestions] Raw LLM response length:",
    content.length
  );
  console.log(
    "[generateDynamicQuestions] First 500 chars:",
    content.substring(0, LOG_PREVIEW_LENGTH)
  );

  let questions: Question[] = [];
  try {
    const parsed = JSON.parse(content);
    console.log(
      "[generateDynamicQuestions] Parsed successfully, type:",
      Array.isArray(parsed) ? "array" : typeof parsed
    );

    // Handle both formats: raw array [...] or wrapped { questions: [...] }
    let rawQuestions: Record<string, unknown>[] = [];
    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
      console.log(
        "[generateDynamicQuestions] Using raw array format, items:",
        parsed.length
      );
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      rawQuestions = parsed.questions;
      console.log(
        "[generateDynamicQuestions] Using wrapped format, items:",
        parsed.questions.length
      );
    } else {
      console.error(
        "[generateDynamicQuestions] Unexpected response format:",
        typeof parsed,
        Object.keys(parsed)
      );
      return [];
    }

    // Normalize questions to stable IDs
    questions = normalizeQuestions(rawQuestions);
    console.log(
      "[generateDynamicQuestions] Questions after normalization:",
      questions.length
    );
  } catch (error) {
    console.error("[generateDynamicQuestions] JSON parse failed:", error);
    console.error("[generateDynamicQuestions] Content length:", content.length);
    console.error(
      "[generateDynamicQuestions] Content preview:",
      content.substring(0, LOG_ERROR_PREVIEW_LENGTH)
    );
    return [];
  }

  console.log(
    `[generateDynamicQuestions] Generated ${questions.length} questions`
  );

  if (questions.length === 0) {
    console.warn(
      "[generateDynamicQuestions] LLM returned no questions - check prompt/schema"
    );
  }

  return questions;
}

/**
 * Construct plan directly from prompt (when complete)
 *
 * Uses Gemini 2.5 Pro to build research plan without Q&A
 */
export async function constructPlanFromPrompt(goal: string): Promise<Plan> {
  console.log("[constructPlanFromPrompt] Building plan from complete prompt");

  const systemPrompt = await loadSystemPromptWithDate(
    "plan-constructor.system.md"
  );

  const llm = createLLM(ANALYSIS_MODEL, DEFAULT_TEMPERATURE).bind({
    response_format: { type: "json_object" },
  });

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Construct a research plan from this complete prompt:

"${goal}"

This prompt is complete and contains all necessary information. Build a comprehensive research plan without needing additional Q&A.

Respond with JSON following the schema in the system prompt.`
    ),
  ]);

  const content = response.content as string;
  const planData = JSON.parse(content);

  const plan: Plan = {
    goal: planData.goal,
    deliverable: planData.deliverable,
    dag: planData.dag ?? undefined, // Optional: no longer used by research system
    constraints: planData.constraints,
  };

  console.log("[constructPlanFromPrompt] Plan constructed:", plan.goal);

  return plan;
}

/**
 * Construct plan from Q&A answers
 *
 * Uses Gemini 2.5 Pro to synthesize collected answers into research plan
 */
export async function constructPlanFromAnswers(
  goal: string,
  answers: QuestionAnswer[],
  questions: Question[]
): Promise<Plan> {
  console.log(
    `[constructPlanFromAnswers] Building plan from ${answers.length} answers`
  );

  const systemPrompt = await loadSystemPromptWithDate(
    "plan-constructor.system.md"
  );

  const llm = createLLM(ANALYSIS_MODEL, DEFAULT_TEMPERATURE).bind({
    response_format: { type: "json_object" },
  });

  // Format Q&A for LLM context
  const qaContext = answers
    .map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        return "";
      }

      const selectedOption = answer.selectedOption
        ? question.options.find((opt) => opt.value === answer.selectedOption)
        : null;

      return `Q: ${question.text}
A: ${selectedOption ? selectedOption.label : answer.customAnswer || "Not answered"}${
        selectedOption?.description ? ` (${selectedOption.description})` : ""
      }`;
    })
    .join("\n\n");

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Construct a research plan from the original goal and user's Q&A answers:

Original goal: "${goal}"

User's answers:
${qaContext}

Synthesize these answers into a comprehensive, executable research plan.

Respond with JSON following the schema in the system prompt.`
    ),
  ]);

  const content = response.content as string;
  const planData = JSON.parse(content);

  const plan: Plan = {
    goal: planData.goal,
    deliverable: planData.deliverable,
    dag: planData.dag ?? undefined, // Optional: no longer used by research system
    constraints: planData.constraints,
  };

  console.log("[constructPlanFromAnswers] Plan constructed:", plan.goal);

  return plan;
}

/**
 * Construct default plan with assumptions (for auto mode with incomplete prompts)
 *
 * Uses Gemini 2.5 Pro to build plan with best assumptions when user hasn't provided Q&A
 */
export async function constructDefaultPlan(goal: string): Promise<Plan> {
  console.log("[constructDefaultPlan] Building plan with default assumptions");

  const systemPrompt = await loadSystemPromptWithDate(
    "plan-constructor.system.md"
  );

  const llm = createLLM(ANALYSIS_MODEL, DEFAULT_TEMPERATURE).bind({
    response_format: { type: "json_object" },
  });

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Construct a research plan from this prompt using reasonable default assumptions:

"${goal}"

This prompt may be incomplete. Make sensible assumptions about:
- Scope: Cover all major relevant aspects
- Timeframe: Focus on recent developments (past 1-3 years unless otherwise clear)
- Depth: Moderate depth suitable for comprehensive understanding
- Use case: General research with balanced coverage

Respond with JSON following the schema in the system prompt.`
    ),
  ]);

  const content = response.content as string;
  const planData = JSON.parse(content);

  const plan: Plan = {
    goal: planData.goal,
    deliverable: planData.deliverable,
    dag: planData.dag ?? undefined, // Optional: no longer used by research system
    constraints: planData.constraints,
  };

  console.log("[constructDefaultPlan] Default plan constructed:", plan.goal);

  return plan;
}
