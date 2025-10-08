"use client";

import { ScrollTextIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PlanSummaryProps = {
  goal?: string | null;
  originalGoal?: string | null;
  deliverable?: string | null;
  dag?: string[] | null;
  constraints?: Record<string, unknown> | null;
  /**
   * Additional classes for the trigger button wrapper. Useful for positioning.
   */
  triggerContainerClassName?: string;
  /**
   * Hide the trigger button (modal can still auto-open when plan changes).
   */
  hideTrigger?: boolean;
};

export function PlanSummary({
  goal,
  originalGoal,
  deliverable,
  dag,
  constraints,
  triggerContainerClassName,
  hideTrigger = false,
}: PlanSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const lastGoalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!goal) {
      setIsOpen(false);
      lastGoalRef.current = null;
      return;
    }

    if (goal !== lastGoalRef.current) {
      lastGoalRef.current = goal;
      setIsOpen(true);
    }
  }, [goal]);

  const hasGoalChanged = useMemo(() => {
    if (!(goal && originalGoal)) {
      return false;
    }
    return goal.replace(/\s+/g, " ") !== originalGoal.replace(/\s+/g, " ");
  }, [goal, originalGoal]);

  const constraintEntries = useMemo(() => {
    if (!constraints || typeof constraints !== "object") {
      return [] as Array<[string, unknown]>;
    }

    return Object.entries(constraints).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === "object") {
        return Object.keys(value as Record<string, unknown>).length > 0;
      }
      return true;
    });
  }, [constraints]);

  const formattedGoal = goal?.trim();
  const formattedDeliverable = deliverable?.trim();
  const dagSteps = Array.isArray(dag) ? dag.filter(Boolean) : [];

  if (!formattedGoal) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const formatConstraintValue = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <>
      {!hideTrigger && (
        <div className={cn(triggerContainerClassName)}>
          <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
            <ScrollTextIcon className="mr-2 size-4" />
            Plan Summary
          </Button>
        </div>
      )}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planner Objective</DialogTitle>
            {hasGoalChanged && originalGoal ? (
              <DialogDescription>
                Refined from your original prompt: "{originalGoal}"
              </DialogDescription>
            ) : (
              <DialogDescription>
                Review the synthesized brief before continuing your session.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <section className="space-y-2">
              <p className="font-medium text-sm uppercase text-muted-foreground">
                Goal
              </p>
              <p className="text-sm leading-6 text-foreground">{formattedGoal}</p>
            </section>
            {formattedDeliverable ? (
              <section className="space-y-2">
                <p className="font-medium text-sm uppercase text-muted-foreground">
                  Deliverable
                </p>
                <p className="text-sm leading-6 text-foreground">
                  {formattedDeliverable}
                </p>
              </section>
            ) : null}
            {dagSteps.length > 0 ? (
              <section className="space-y-2">
                <p className="font-medium text-sm uppercase text-muted-foreground">
                  Workflow
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dagSteps.map((step) => (
                    <span
                      className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                      key={step}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
            {constraintEntries.length > 0 ? (
              <section className="space-y-2">
                <p className="font-medium text-sm uppercase text-muted-foreground">
                  Constraints
                </p>
                <dl className="space-y-1 text-sm">
                  {constraintEntries.map(([key, value]) => (
                    <div className="flex gap-2" key={key}>
                      <dt className="w-24 shrink-0 text-muted-foreground capitalize">
                        {key}
                      </dt>
                      <dd className="flex-1 text-foreground">
                        {formatConstraintValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
