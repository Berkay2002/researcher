/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation } from "../../state";
import { assessCandidates } from "./nodes/assess-candidates";
import { dedupRerank } from "./nodes/dedup-rerank";
import { harvestSelected } from "./nodes/harvest-selected";
import { metaSearch } from "./nodes/meta-search";
import { queryPlan } from "./nodes/query-plan";

/**
 * Research Subgraph
 *
 * Flow: QueryPlan → MetaSearch → AssessCandidates → HarvestSelected → DedupRerank
 *
 * Transforms user goal into grounded evidence using two-pass search:
 * 1. QueryPlan - Expands goal into 5-10 focused queries
 * 2. MetaSearch - Searches Tavily + Exa in parallel, normalizes results (Phase A: discovery)
 * 3. AssessCandidates - Scores and selects best candidates for enrichment (Phase B: reason/curate)
 * 4. HarvestSelected - Fetches full content for selected URLs (Phase C: enrichment)
 * 5. DedupRerank - Deduplicates by content hash, reranks by authority/recency (Phase D: final)
 *
 * Uses ParentStateAnnotation to inherit state schema and reducers from parent graph
 */
export function buildResearchSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    // Add nodes
    .addNode("queryPlan", queryPlan)
    .addNode("metaSearch", metaSearch)
    .addNode("assessCandidates", assessCandidates)
    .addNode("harvestSelected", harvestSelected)
    .addNode("dedupRerank", dedupRerank)
    // Wire linear flow
    .addEdge(START, "queryPlan")
    .addEdge("queryPlan", "metaSearch")
    .addEdge("metaSearch", "assessCandidates")
    .addEdge("assessCandidates", "harvestSelected")
    .addEdge("harvestSelected", "dedupRerank")
    .addEdge("dedupRerank", END);

  return builder.compile();
}
