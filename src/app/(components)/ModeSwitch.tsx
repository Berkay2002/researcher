"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ModeSwitchProps = {
  initialMode?: "auto" | "plan";
  onChange?: (mode: "auto" | "plan") => void;
};

/**
 * Mode Switch Component
 *
 * Toggles between Auto and Plan modes:
 * - Auto: Immediate execution with default plan
 * - Plan: Human-in-the-loop planning with template selection
 */
export function ModeSwitch({
  initialMode = "auto",
  onChange,
}: ModeSwitchProps) {
  const [mode, setMode] = useState<"auto" | "plan">(initialMode);

  const handleToggle = (checked: boolean) => {
    const newMode = checked ? "plan" : "auto";
    setMode(newMode);
    onChange?.(newMode);
  };

  return (
    <div className="flex items-center gap-3">
      <Label className="font-medium text-sm" htmlFor="mode-switch">
        {mode === "auto" ? "Auto Mode" : "Plan Mode"}
      </Label>
      <Switch
        checked={mode === "plan"}
        id="mode-switch"
        onCheckedChange={handleToggle}
      />
      <span className="text-muted-foreground text-xs">
        {mode === "auto"
          ? "Immediate execution with default plan"
          : "Guided planning with template selection"}
      </span>
    </div>
  );
}
