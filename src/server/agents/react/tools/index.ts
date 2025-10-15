import { createResearchSubagentTool } from "./research-subagent";
import { createSearchTools } from "./search";
import { thinkTool } from "./think";

export function buildReactAgentTools() {
  const searchTools = createSearchTools();
  const researchTool = createResearchSubagentTool();
  return [thinkTool, ...searchTools, researchTool];
}
