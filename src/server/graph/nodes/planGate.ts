/** biome-ignore-all lint/suspicious/noConsole: <For development> */
import type { ParentState } from "../state";

/**
 * Plan Gate Node
 *
 * Determines whether to use Auto mode or Plan mode based on:
 * - User's explicit mode override
 * - Auto-gate heuristics (clarity, coherence, cost)
 *
 * Phase 1: Simple pass-through
 * Phase 2: Will implement auto-gate logic
 */
export async function planGate(
  _state: ParentState
): Promise<Partial<ParentState>> {
  console.log("[planGate] Evaluating mode selection...");

  // For now, simply pass through
  // Phase 2 will add auto-gate logic to override mode if needed

  return {};
}
