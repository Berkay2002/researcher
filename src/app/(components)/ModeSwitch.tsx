"use client";

import { InfoIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Mode Switch Props
 */
export type ModeSwitchProps = {
  initialMode?: "auto" | "plan";
  onChange?: (mode: "auto" | "plan") => void;
  disabled?: boolean;
  showHelp?: boolean;
  className?: string;
};

/**
 * Mode Switch Component
 *
 * Production-ready toggle between Auto and Plan modes with:
 * - Controlled/uncontrolled support
 * - Disabled state handling
 * - Tooltips and help text
 * - Accessibility compliance
 * - Confirmation for mode switching (optional)
 */
export function ModeSwitch({
  initialMode = "auto",
  onChange,
  disabled = false,
  showHelp = true,
  className,
}: ModeSwitchProps) {
  const [mode, setMode] = useState<"auto" | "plan">(initialMode);

  // Sync with initialMode changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (disabled) {
        return;
      }

      const newMode = checked ? "plan" : "auto";
      setMode(newMode);
      onChange?.(newMode);
    },
    [disabled, onChange]
  );

  const modeConfig = getModeConfig(mode);

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <Label
          className="cursor-pointer font-medium text-sm"
          htmlFor="mode-switch"
        >
          {modeConfig.label}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative inline-flex items-center">
                <Switch
                  aria-describedby="mode-description"
                  aria-label={`Switch to ${mode === "auto" ? "plan" : "auto"} mode`}
                  checked={mode === "plan"}
                  disabled={disabled}
                  id="mode-switch"
                  onCheckedChange={handleToggle}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="max-w-xs text-xs">{modeConfig.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-muted-foreground text-xs" id="mode-description">
          {modeConfig.description}
        </span>
        {showHelp && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="size-4 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-2 text-xs">
                  <p>
                    <strong>Auto Mode:</strong> Immediately executes with a
                    default research plan. Best for quick queries.
                  </p>
                  <p>
                    <strong>Plan Mode:</strong> Guides you through template
                    selection and constraint specification. Best for complex
                    research.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Help Alert (optional) */}
      {showHelp && mode === "plan" && (
        <Alert className="mt-3">
          <InfoIcon className="size-4" />
          <AlertDescription className="text-xs">
            Plan mode will prompt you to choose a research strategy and specify
            constraints before execution.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Get mode configuration
 */
type ModeConfig = {
  label: string;
  description: string;
  tooltip: string;
};

function getModeConfig(mode: "auto" | "plan"): ModeConfig {
  if (mode === "auto") {
    return {
      label: "Auto Mode",
      description: "Immediate execution with default plan",
      tooltip:
        "Research will start immediately with sensible defaults. No human input required.",
    };
  }

  return {
    label: "Plan Mode",
    description: "Guided planning with template selection",
    tooltip:
      "You'll be asked to select a research strategy and specify constraints before execution begins.",
  };
}
