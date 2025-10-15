import { createResearchSubagentTool } from "./research-subagent";
import { createSearchTools } from "./search";
import { createTodoTools } from "./todo";

export function buildReactAgentTools() {
  const searchTools = createSearchTools();
  const todoTools = createTodoTools();
  const researchTool = createResearchSubagentTool();
  return [...searchTools, ...todoTools, researchTool];
}
