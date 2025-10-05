"use client";

import { ResearchInput } from "@/app/(components)/research-input";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * New Research Page
 *
 * Entry point for starting new research sessions.
 * Large input box with mode toggle.
 */
export default function NewResearchPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (goal: string, mode: "auto" | "plan") => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/threads/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal,
          modeOverride: mode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start research: ${errorText}`);
      }

      const data = (await response.json()) as { threadId: string };

      // Navigate to thread view
      router.push(`/research/${data.threadId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <h1 className="mb-2 font-bold text-3xl">Start New Research</h1>
            <p className="text-muted-foreground">
              Enter your research question and choose execution mode
            </p>
          </div>

          <ResearchInput onSubmit={handleSubmit} isSubmitting={isSubmitting} />

          {error && (
            <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 space-y-2 text-center text-muted-foreground text-sm">
            <p>
              <strong>Auto Mode:</strong> Immediate execution with default plan
            </p>
            <p>
              <strong>Plan Mode:</strong> Guided planning with template
              selection and constraints
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
