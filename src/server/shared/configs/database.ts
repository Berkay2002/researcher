import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { DATABASE_URL } from "./env";

/**
 * Database configuration and initialization module
 *
 * This module handles the initialization of the PostgreSQL checkpointer
 * used by LangGraph for persistence. It implements a singleton pattern
 * to ensure only one connection is created.
 */

let checkpointerSingleton: PostgresSaver | null = null;
let initializationPromise: Promise<PostgresSaver> | null = null;
let isInitialized = false;

/**
 * Initialize the PostgreSQL checkpointer
 *
 * @returns Promise<PostgresSaver> - The initialized checkpointer instance
 */
export async function initializeCheckpointer(): Promise<PostgresSaver> {
  // If already initialized, return the existing instance
  if (checkpointerSingleton) {
    return checkpointerSingleton;
  }

  // If initialization is in progress, return the promise
  if (initializationPromise) {
    return initializationPromise;
  }

  // Create a new initialization promise
  initializationPromise = createCheckpointerAsync();

  try {
    const checkpointer = await initializationPromise;
    checkpointerSingleton = checkpointer;
    isInitialized = true;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.log("[Database] PostgreSQL checkpointer initialized successfully");
    return Promise.resolve(checkpointer);
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.error(
      "[Database] Failed to initialize PostgreSQL checkpointer:",
      error
    );
    initializationPromise = null;
    throw error;
  }
}

/**
 * Create a new PostgresSaver instance asynchronously
 *
 * @returns Promise<PostgresSaver> - The created checkpointer instance
 */
function createCheckpointerAsync(): Promise<PostgresSaver> {
  const startTime = Date.now();

  try {
    const checkpointer = PostgresSaver.fromConnString(DATABASE_URL);

    const initTime = Date.now() - startTime;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.log(`[Database] Checkpointer created in ${initTime}ms`);

    return Promise.resolve(checkpointer);
  } catch (error) {
    const initTime = Date.now() - startTime;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.error(
      `[Database] Failed to create checkpointer after ${initTime}ms:`,
      error
    );
    throw new Error(
      `Failed to initialize database checkpointer: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the checkpointer instance
 *
 * @returns PostgresSaver | null - The checkpointer instance or null if not initialized
 */
export function getCheckpointer(): PostgresSaver | null {
  return checkpointerSingleton;
}

/**
 * Check if the checkpointer is initialized
 *
 * @returns boolean - True if initialized, false otherwise
 */
export function isCheckpointerInitialized(): boolean {
  return isInitialized && checkpointerSingleton !== null;
}

/**
 * Reset the checkpointer singleton (useful for testing or error recovery)
 */
export function resetCheckpointer(): void {
  checkpointerSingleton = null;
  initializationPromise = null;
  isInitialized = false;
  // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
  console.log("[Database] Checkpointer singleton reset");
}

/**
 * Initialize the database connection with retry logic
 *
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in ms (default: 1000)
 * @returns Promise<PostgresSaver> - The initialized checkpointer
 */
export async function initializeCheckpointerWithRetry(
  maxRetries = 3,
  retryDelay = 1000
): Promise<PostgresSaver> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await initializeCheckpointer();
    } catch (error) {
      lastError = error;
      // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
      console.warn(
        `[Database] Initialization attempt ${attempt} failed:`,
        error
      );

      if (attempt < maxRetries) {
        // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
        console.log(`[Database] Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
  console.error(
    `[Database] Failed to initialize after ${maxRetries} attempts:`,
    lastError
  );
  throw lastError;
}
