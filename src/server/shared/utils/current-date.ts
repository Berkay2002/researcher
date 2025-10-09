/**
 * Get current date for temporal context in LLM prompts
 *
 * This helps prevent LLMs from hallucinating about the current date,
 * especially for models trained before 2025.
 */
export function getCurrentDateString(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Standard temporal context message for LLM system prompts
 */
export function getTemporalContext(): string {
  const currentDate = getCurrentDateString();
  return `CURRENT DATE: ${currentDate}

IMPORTANT - Temporal Context:
- Today's date is ${currentDate}
- All real-world events, publications, and citations are from the PAST (before today)
- Do NOT claim anything is "dated 2025" or reference future dates
- When describing sources, use appropriate tenses based on their actual publication dates`;
}
