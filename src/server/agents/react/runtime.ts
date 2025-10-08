import { getCheckpointer } from "../../shared/configs/database";
import { createReactAgent } from "./agent";

let cachedAgent: ReturnType<typeof createReactAgent> | null = null;

export function getReactAgent() {
  if (!cachedAgent) {
    const checkpointer = getCheckpointer();
    if (!checkpointer) {
      throw new Error(
        "Database checkpointer not initialized. Make sure initializeServices() has been called during application startup."
      );
    }
    cachedAgent = createReactAgent({
      checkpointer,
    });
  }
  return cachedAgent;
}
