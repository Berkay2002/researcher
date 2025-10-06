import type { ThreadHistoryEntry } from "@/types/ui";

/**
 * In-memory thread history store
 * In production, this would be stored in a database table
 */
const threadHistory = new Map<string, ThreadHistoryEntry>();

/**
 * Get all thread history entries
 */
export function getAllThreadHistory(): ThreadHistoryEntry[] {
  return Array.from(threadHistory.values());
}

/**
 * Get a specific thread history entry
 */
export function getThreadHistoryEntry(
  id: string
): ThreadHistoryEntry | undefined {
  return threadHistory.get(id);
}

/**
 * Create or update a thread history entry
 */
export function setThreadHistoryEntry(entry: ThreadHistoryEntry): void {
  threadHistory.set(entry.id, entry);
}

/**
 * Delete a thread history entry
 */
export function deleteThreadHistoryEntry(id: string): boolean {
  return threadHistory.delete(id);
}

/**
 * Delete multiple thread history entries
 */
export function deleteThreadHistoryEntries(ids: string[]): number {
  let deleted = 0;
  for (const id of ids) {
    if (threadHistory.has(id)) {
      threadHistory.delete(id);
      deleted++;
    }
  }
  return deleted;
}

/**
 * Get thread history count
 */
export function getThreadHistoryCount(): number {
  return threadHistory.size;
}

/**
 * Clear all thread history (for testing/dev)
 */
export function clearThreadHistory(): void {
  threadHistory.clear();
}
