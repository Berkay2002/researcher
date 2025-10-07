import { BookOpenIcon, SparklesIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-8">
        <div className="w-full max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="font-bold text-5xl tracking-tight sm:text-6xl">
              AI-Powered Research Assistant
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
              Transform broad questions into grounded, cited reports.
              Multi-agent system with human-in-the-loop planning.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/research/new">
              <Button className="h-12 px-8 text-base" size="lg" type="button">
                <SparklesIcon className="mr-2 size-5" />
                Start Research
              </Button>
            </Link>
            <Link href="#features">
              <Button
                className="h-12 px-8 text-base"
                size="lg"
                type="button"
                variant="outline"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="border-t bg-muted/30 px-8 py-16" id="features">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center font-bold text-3xl">Key Features</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <TargetIcon className="size-6" />
                </div>
                <h3 className="mb-2 font-semibold text-xl">Dual Modes</h3>
                <p className="text-muted-foreground text-sm">
                  Choose between Auto mode for immediate execution or Plan mode
                  for guided, human-in-the-loop research planning.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BookOpenIcon className="size-6" />
                </div>
                <h3 className="mb-2 font-semibold text-xl">Grounded Reports</h3>
                <p className="text-muted-foreground text-sm">
                  Every claim is backed by citations. Real-time source tracking
                  with metadata, excerpts, and explanations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <SparklesIcon className="size-6" />
                </div>
                <h3 className="mb-2 font-semibold text-xl">
                  Multi-Agent System
                </h3>
                <p className="text-muted-foreground text-sm">
                  Powered by LangGraph with specialized agents for planning,
                  research, fact-checking, and synthesis.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-8 py-6 text-center text-muted-foreground text-sm">
        <p>Built with Next.js 15, LangGraph, and AI</p>
      </footer>
    </div>
  );
}
