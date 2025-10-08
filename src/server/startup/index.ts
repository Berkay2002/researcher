import { initializeCheckpointerWithRetry } from "../shared/configs/database";

/**
 * Application initialization module
 *
 * This module handles the initialization of critical services
 * during application startup to ensure they're ready when needed.
 */

// Constants for initialization
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize all critical services
 *
 * @returns Promise<void> - Resolves when all services are initialized
 */
export async function initializeServices(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    return;
  }

  // If initialization is in progress, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }

  // Create a new initialization promise
  initializationPromise = performInitialization();

  try {
    await initializationPromise;
    isInitialized = true;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.log("[Startup] All services initialized successfully");
  } catch (error) {
    initializationPromise = null;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.error("[Startup] Failed to initialize services:", error);
    throw error;
  }
}

/**
 * Perform the actual initialization of services
 */
async function performInitialization(): Promise<void> {
  const startTime = Date.now();

  try {
    // Initialize the database checkpointer with retry logic
    await initializeCheckpointerWithRetry(
      DEFAULT_MAX_RETRIES,
      DEFAULT_RETRY_DELAY_MS
    );

    const initTime = Date.now() - startTime;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.log(`[Startup] Services initialized in ${initTime}ms`);
  } catch (error) {
    const initTime = Date.now() - startTime;
    // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
    console.error(
      `[Startup] Failed to initialize services after ${initTime}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Check if services are initialized
 *
 * @returns boolean - True if initialized, false otherwise
 */
export function areServicesInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the initialization promise if in progress
 *
 * @returns Promise<void> | null - The initialization promise or null
 */
export function getInitializationPromise(): Promise<void> | null {
  return initializationPromise;
}

/**
 * Reset the initialization state (useful for testing or error recovery)
 */
export function resetInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
  // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
  console.log("[Startup] Initialization state reset");
}

// Initialize services when this module is imported
// This ensures the database connection is established during application startup
initializeServices().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: Server-side logging is acceptable
  console.error(
    "[Startup] Critical: Failed to initialize services at startup:",
    error
  );
});
