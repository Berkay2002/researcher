/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import { END, START, StateGraph } from "@langchain/langgraph";
import { ParentStateAnnotation } from "../../state";
import { dedupRerank } from "./nodes/dedup-rerank";
import { harvest } from "./nodes/harvest";
import { metaSearch } from "./nodes/meta-search";
import { queryPlan } from "./nodes/query-plan";

/**
 * Research Subgraph
 *
 * Flow: QueryPlan → MetaSearch → Harvest → DedupRerank
 *
 * Transforms user goal into grounded evidence:
 * 1. QueryPlan - Expands goal into 5-10 focused queries
 * 2. MetaSearch - Searches Tavily + Exa in parallel, normalizes results
 * 3. Harvest - Fetches full content, generates hashes, chunks documents
 * 4. DedupRerank - Deduplicates by content hash, reranks by authority/recency
 *
 * Uses ParentStateAnnotation to inherit state schema and reducers from parent graph
 */
export function buildResearchSubgraph() {
  const builder = new StateGraph(ParentStateAnnotation)
    // Add nodes
    .addNode("queryPlan", queryPlan)
    .addNode("metaSearch", metaSearch)
    .addNode("harvest", harvest)
    .addNode("dedupRerank", dedupRerank)
    // Wire linear flow
    .addEdge(START, "queryPlan")
    .addEdge("queryPlan", "metaSearch")
    .addEdge("metaSearch", "harvest")
    .addEdge("harvest", "dedupRerank")
    .addEdge("dedupRerank", END);

  return builder.compile();
}
