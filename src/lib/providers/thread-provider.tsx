/**
 * Thread Provider
 *
 * Provides thread management functionality using the LangGraph SDK's client.
 * Replaces the custom thread implementation.
 */

"use client";

import type { Thread } from "@langchain/langgraph-sdk";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useState,
} from "react";
import { createClient } from "@/lib/client";

type ThreadContextType = {
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  createThread: (title?: string) => Promise<string>;
  deleteThread: (threadId: string) => Promise<void>;
};

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const client = createClient();

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    setThreadsLoading(true);
    try {
      // Get threads from the SDK client
      const response = await client.threads.search({
        limit: 100,
      });
      return response;
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: <Error logging>
      console.error("Failed to fetch threads:", error);
      return [];
    } finally {
      setThreadsLoading(false);
    }
  }, [client]);

  const createThread = useCallback(
    async (title?: string): Promise<string> => {
      try {
        // Create a new thread using the SDK client
        const thread = await client.threads.create({
          metadata: title ? { title } : {},
        });

        // Refresh the threads list
        const updatedThreads = await getThreads();
        setThreads(updatedThreads);

        return thread.thread_id;
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: <Error logging>
        console.error("Failed to create thread:", error);
        throw error;
      }
    },
    [client, getThreads]
  );

  const deleteThread = useCallback(
    async (threadId: string): Promise<void> => {
      try {
        // Delete the thread using the SDK client
        await client.threads.delete(threadId);

        // Update the local state
        setThreads((prev) =>
          prev.filter((thread) => thread.thread_id !== threadId)
        );
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: <Error logging>
        console.error("Failed to delete thread:", error);
        throw error;
      }
    },
    [client]
  );

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    createThread,
    deleteThread,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
