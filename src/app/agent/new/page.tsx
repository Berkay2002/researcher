"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getLangGraphClient } from "@/lib/langgraph-client";

const PLACEHOLDER_TEXT = "What would you like me to help you with today?";
const MIN_INPUT_LENGTH = 3;
const REACT_AGENT_ASSISTANT_ID = "researcher";

/**
 * New Agent Session Page
 *
 * Entry point for creating new React agent threads.
 * Uses LangGraph SDK to create threads and start runs.
 *
 * Flow:
 * 1. User enters initial message
 * 2. Create thread via SDK
 * 3. Start run with user message
 * 4. Navigate to thread view page
 */
export default function NewAgentPage() {
  const [input, setInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || trimmedInput.length < MIN_INPUT_LENGTH) {
      setError(
        `Please enter at least ${MIN_INPUT_LENGTH} characters to start.`
      );
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const client = getLangGraphClient();

      // Create new thread
      const thread = await client.threads.create();

      // Start run with initial message
      await client.runs.create(thread.thread_id, REACT_AGENT_ASSISTANT_ID, {
        input: {
          messages: [
            {
              role: "user",
              content: trimmedInput,
            },
          ],
        },
      });

      // Navigate to thread view
      router.push(`/agent/${thread.thread_id}`);
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: Error logging for user feedback
      console.error("Failed to start agent:", err);
      setError(
        err instanceof Error ? err.message : "Failed to start agent session"
      );
      setIsStarting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div className="container flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Start New Agent Session</CardTitle>
          <CardDescription>
            Describe what you need help with, and the React agent will assist
            you with research, web scraping, and information gathering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              className="min-h-32 resize-none"
              disabled={isStarting}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={PLACEHOLDER_TEXT}
              value={input}
            />
            <p className="text-muted-foreground text-sm">
              Press Cmd/Ctrl + Enter to start
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={isStarting || !input.trim()}
            onClick={handleStart}
            size="lg"
            type="button"
          >
            {isStarting ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Starting Agent...
              </>
            ) : (
              "Start Agent Session"
            )}
          </Button>

          <div className="rounded-md border bg-muted/50 p-4">
            <p className="font-medium text-sm">Example tasks:</p>
            <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
              <li>
                • Research the latest developments in quantum computing and
                summarize key findings
              </li>
              <li>
                • Find and compare pricing information for cloud storage
                providers
              </li>
              <li>
                • Gather data about recent AI model releases and their
                capabilities
              </li>
              <li>
                • Search for best practices in React performance optimization
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
