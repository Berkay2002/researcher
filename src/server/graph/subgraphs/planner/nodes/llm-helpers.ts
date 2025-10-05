/** biome-ignore-all lint/suspicious/noConsole: <For development> */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import type { Plan, Question, QuestionAnswer } from "../../../state";
import type { PromptAnalysis } from "../state";

// LLM Configuration
const ANALYSIS_MODEL = "gpt-5"; // GPT-5 for reasoning tasks (agentic)
const GENERATION_MODEL = "gpt-5-mini"; // GPT-5-mini for well-defined tasks
const DEFAULT_TEMPERATURE = 0.3;

// System prompt paths
const PROMPTS_DIR = join(process.cwd(), "src", "server", "configs", "prompts");

/**
 * Load system prompt from file
 */
async function loadSystemPrompt(filename: string): Promise<string> {
  const filePath = join(PROMPTS_DIR, filename);
  return await fs.readFile(filePath, "utf-8");
}

/**
 * Analyze prompt completeness
 *
 * Uses GPT-4o to identify missing information in user's research prompt
 */
export async function analyzePromptCompleteness(
  goal: string
): Promise<PromptAnalysis> {
  console.log("[analyzePromptCompleteness] Analyzing prompt:", goal);

  const systemPrompt = await loadSystemPrompt("prompt-analyzer.system.md");

  const llm = new ChatOpenAI({
    model: ANALYSIS_MODEL,
    temperature: DEFAULT_TEMPERATURE,
  }).bind({
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
 * Generate dynamic questions based on prompt analysis
 *
 * Uses GPT-4o-mini to create questions with contextual answer options
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

  const systemPrompt = await loadSystemPrompt("question-generator.system.md");

  const llm = new ChatOpenAI({
    model: GENERATION_MODEL,
    temperature: DEFAULT_TEMPERATURE,
  }).bind({
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
  const parsed = JSON.parse(content) as { questions: Question[] };

  console.log(
    `[generateDynamicQuestions] Generated ${parsed.questions.length} questions`
  );

  return parsed.questions;
}

/**
 * Construct plan directly from prompt (when complete)
 *
 * Uses GPT-4o to build research plan without Q&A
 */
export async function constructPlanFromPrompt(goal: string): Promise<Plan> {
  console.log("[constructPlanFromPrompt] Building plan from complete prompt");

  const systemPrompt = await loadSystemPrompt("plan-constructor.system.md");

  const llm = new ChatOpenAI({
    model: ANALYSIS_MODEL,
    temperature: DEFAULT_TEMPERATURE,
  }).bind({
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
    dag: planData.dag,
    constraints: planData.constraints,
  };

  console.log("[constructPlanFromPrompt] Plan constructed:", plan.goal);

  return plan;
}

/**
 * Construct plan from Q&A answers
 *
 * Uses GPT-4o to synthesize collected answers into research plan
 */
export async function constructPlanFromAnswers(
  goal: string,
  answers: QuestionAnswer[],
  questions: Question[]
): Promise<Plan> {
  console.log(
    `[constructPlanFromAnswers] Building plan from ${answers.length} answers`
  );

  const systemPrompt = await loadSystemPrompt("plan-constructor.system.md");

  const llm = new ChatOpenAI({
    model: ANALYSIS_MODEL,
    temperature: DEFAULT_TEMPERATURE,
  }).bind({
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
    dag: planData.dag,
    constraints: planData.constraints,
  };

  console.log("[constructPlanFromAnswers] Plan constructed:", plan.goal);

  return plan;
}

/**
 * Construct default plan with assumptions (for auto mode with incomplete prompts)
 *
 * Uses GPT-4o to build plan with best assumptions when user hasn't provided Q&A
 */
export async function constructDefaultPlan(goal: string): Promise<Plan> {
  console.log("[constructDefaultPlan] Building plan with default assumptions");

  const systemPrompt = await loadSystemPrompt("plan-constructor.system.md");

  const llm = new ChatOpenAI({
    model: ANALYSIS_MODEL,
    temperature: DEFAULT_TEMPERATURE,
  }).bind({
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
    dag: planData.dag,
    constraints: planData.constraints,
  };

  console.log("[constructDefaultPlan] Default plan constructed:", plan.goal);

  return plan;
}
