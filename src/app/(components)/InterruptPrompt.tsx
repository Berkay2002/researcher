/** biome-ignore-all assist/source/useSortedAttributes: <It's fine> */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { InterruptPayload } from "@/server/graph/subgraphs/planner/state";

type InterruptPromptProps = {
  interrupt: InterruptPayload;
  onSubmit: (response: unknown) => void;
  isSubmitting?: boolean;
};

/**
 * Interrupt Prompt Component
 *
 * Displays HITL prompts and collects user responses:
 * - Stage 1: Template selection (radio buttons)
 * - Stage 2: Constraints (form inputs)
 */
export function InterruptPrompt({
  interrupt,
  onSubmit,
  isSubmitting,
}: InterruptPromptProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [constraints, setConstraints] = useState({
    deadline: "",
    budget: "",
    depth: "moderate",
    sources: "diverse",
  });

  const handleTemplateSubmit = () => {
    if (!selectedTemplate) {
      return;
    }
    onSubmit({ template: selectedTemplate });
  };

  const handleConstraintsSubmit = () => {
    onSubmit({
      constraints: {
        deadline: constraints.deadline || undefined,
        budget: constraints.budget ? Number(constraints.budget) : undefined,
        depth: constraints.depth,
        sources: constraints.sources,
      },
    });
  };

  if (interrupt.stage === "template_selection") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Choose Research Strategy</CardTitle>
          <CardDescription>{interrupt.question}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selectedTemplate}
            onValueChange={setSelectedTemplate}
          >
            {interrupt.options?.map((option) => (
              <div
                key={option.value}
                className="flex items-start space-x-3 space-y-0 py-3"
              >
                <RadioGroupItem value={option.value} id={option.value} />
                <div className="space-y-1">
                  <Label
                    htmlFor={option.value}
                    className="cursor-pointer font-medium"
                  >
                    {option.label}
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleTemplateSubmit}
            disabled={!selectedTemplate || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Continue"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (interrupt.stage === "constraints") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Specify Constraints</CardTitle>
          <CardDescription>{interrupt.question}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input
              id="deadline"
              placeholder="e.g., 3 hours, 1 day"
              value={constraints.deadline}
              onChange={(e) =>
                setConstraints({ ...constraints, deadline: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget USD (optional)</Label>
            <Input
              id="budget"
              type="number"
              placeholder="e.g., 50"
              value={constraints.budget}
              onChange={(e) =>
                setConstraints({ ...constraints, budget: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="depth">Research Depth</Label>
            <RadioGroup
              value={constraints.depth}
              onValueChange={(value) =>
                setConstraints({ ...constraints, depth: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="surface" id="depth-surface" />
                <Label htmlFor="depth-surface">Surface</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="depth-moderate" />
                <Label htmlFor="depth-moderate">Moderate</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deep" id="depth-deep" />
                <Label htmlFor="depth-deep">Deep</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sources">Source Coverage</Label>
            <RadioGroup
              value={constraints.sources}
              onValueChange={(value) =>
                setConstraints({ ...constraints, sources: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="minimal" id="sources-minimal" />
                <Label htmlFor="sources-minimal">Minimal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="diverse" id="sources-diverse" />
                <Label htmlFor="sources-diverse">Diverse</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="comprehensive"
                  id="sources-comprehensive"
                />
                <Label htmlFor="sources-comprehensive">Comprehensive</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleConstraintsSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Start Research"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
