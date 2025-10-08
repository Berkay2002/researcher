import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { createReactAgent } from "./agent";

let cachedAgent: ReturnType<typeof createReactAgent> | null = null;
let checkpointerSingleton: PostgresSaver | null = null;

function getCheckpointer() {
  if (!checkpointerSingleton) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for React agent persistence"
      );
    }
    checkpointerSingleton = PostgresSaver.fromConnString(databaseUrl);
  }
  return checkpointerSingleton;
}

export function getReactAgent() {
  if (!cachedAgent) {
    const checkpointer = getCheckpointer();
    cachedAgent = createReactAgent({
      checkpointer,
    });
  }
  return cachedAgent;
}
