"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Calendar,
  DollarSign,
  FlaskConical,
  Folder,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Leaf,
  Lightbulb,
  Music,
  Palette,
  PenLine,
  Plane,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* -------------------------------- Types ---------------------------------- */

export type Project = {
  id: string;
  name: string;
  icon?: string; // Lucide icon name (e.g., "Folder"). Optional.
  color?: string; // Color token (e.g., "emerald"). Optional.
};

export type ProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (project: Project) => void;
};

/* ------------------------------ Config ----------------------------------- */

// Minimal, high-signal icon set. Add/remove as you like.
const ICON_OPTIONS = [
  "Folder",
  "DollarSign",
  "GraduationCap",
  "PenLine",
  "HeartPulse",
  "Plane",
  "BriefcaseBusiness",
  "Brain",
  "FlaskConical",
  "Lightbulb",
  "Calendar",
  "BookOpen",
  "Sparkles",
  "Palette",
  "Music",
  "Gamepad2",
  "Dumbbell",
  "Leaf",
] as const;

type ColorKey =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "emerald"
  | "teal"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "pink";

const COLOR_CLASSES: Record<
  ColorKey,
  { icon: string; ring: string; dot: string }
> = {
  gray: { icon: "text-gray-500", ring: "ring-gray-500/50", dot: "bg-gray-500" },
  red: { icon: "text-red-500", ring: "ring-red-500/50", dot: "bg-red-500" },
  orange: {
    icon: "text-orange-500",
    ring: "ring-orange-500/50",
    dot: "bg-orange-500",
  },
  yellow: {
    icon: "text-yellow-500",
    ring: "ring-yellow-500/50",
    dot: "bg-yellow-500",
  },
  green: {
    icon: "text-green-500",
    ring: "ring-green-500/50",
    dot: "bg-green-500",
  },
  emerald: {
    icon: "text-emerald-500",
    ring: "ring-emerald-500/50",
    dot: "bg-emerald-500",
  },
  teal: { icon: "text-teal-500", ring: "ring-teal-500/50", dot: "bg-teal-500" },
  blue: { icon: "text-blue-500", ring: "ring-blue-500/50", dot: "bg-blue-500" },
  indigo: {
    icon: "text-indigo-500",
    ring: "ring-indigo-500/50",
    dot: "bg-indigo-500",
  },
  violet: {
    icon: "text-violet-500",
    ring: "ring-violet-500/50",
    dot: "bg-violet-500",
  },
  purple: {
    icon: "text-purple-500",
    ring: "ring-purple-500/50",
    dot: "bg-purple-500",
  },
  pink: { icon: "text-pink-500", ring: "ring-pink-500/50", dot: "bg-pink-500" },
};

// Quick-pick “premade projects” (your former “Project Icons” row)
const EXAMPLES: Array<{
  name: string;
  icon: (typeof ICON_OPTIONS)[number];
  color: ColorKey;
}> = [
  { name: "Investing", icon: "DollarSign", color: "emerald" },
  { name: "Homework", icon: "GraduationCap", color: "blue" },
  { name: "Writing", icon: "PenLine", color: "violet" },
  { name: "Health", icon: "HeartPulse", color: "red" },
  { name: "Travel", icon: "Plane", color: "orange" },
  { name: "Work", icon: "BriefcaseBusiness", color: "indigo" },
];

/* ---------------------------- Helpers ------------------------------------ */

function getIconByName(name: string | undefined): LucideIcon {
  const fallback = Folder;
  if (!name) {
    return fallback;
  }

  // Map icon names to their corresponding components
  const iconMap: Record<string, LucideIcon> = {
    Brain,
    BookOpen,
    BriefcaseBusiness,
    Calendar,
    DollarSign,
    FlaskConical,
    Folder,
    Gamepad2,
    GraduationCap,
    HeartPulse,
    Leaf,
    Lightbulb,
    Music,
    Palette,
    PenLine,
    Plane,
    Sparkles,
  };

  return iconMap[name] ?? fallback;
}

/* ------------------------------ Component -------------------------------- */

export default function ProjectModal({
  open,
  onOpenChange,
  onCreate,
}: ProjectModalProps) {
  // Required name
  const [name, setName] = useState("");

  // Optional icon/color (fallbacks used at submit/render time if undefined)
  const [iconName, setIconName] = useState<string | undefined>(undefined);
  const [iconColor, setIconColor] = useState<ColorKey>("emerald");
  const [pickerOpen, setPickerOpen] = useState(false);

  const canCreate = name.trim().length > 0;

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setIconName(undefined);
      setIconColor("emerald");
      setPickerOpen(false);
    }
  }, [open]);

  const ActiveIcon = getIconByName(iconName ?? "Folder");
  const activeColorClass = COLOR_CLASSES[iconName ? iconColor : "gray"].icon;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Project name</DialogTitle>
          <DialogDescription>
            Name your project. Pick an icon if you like—or just use one of the
            examples below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Project Name + embedded icon picker */}
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <div className="relative">
              <Input
                autoFocus
                className="pr-11"
                id="project-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Copenhagen Trip"
                value={name}
              />
              <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    aria-label="Choose project icon"
                    className={cn(
                      "absolute top-1 right-1 h-8 w-8 rounded-md",
                      iconName
                        ? COLOR_CLASSES[iconColor].ring
                        : "ring-transparent"
                    )}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ActiveIcon className={cn("h-4 w-4", activeColorClass)} />
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="end" className="w-72 p-3">
                  {/* Color row */}
                  <div className="mb-2 flex items-center gap-2">
                    {(Object.keys(COLOR_CLASSES) as ColorKey[]).map((c) => (
                      <button
                        aria-label={`Choose ${c} color`}
                        className={cn(
                          "h-6 w-6 rounded-full ring-2 ring-offset-2 transition focus:outline-none",
                          COLOR_CLASSES[c].dot,
                          iconColor === c
                            ? COLOR_CLASSES[c].ring
                            : "ring-transparent"
                        )}
                        key={c}
                        onClick={() => setIconColor(c)}
                        title={c}
                        type="button"
                      />
                    ))}
                  </div>

                  <div className="my-2 h-px w-full bg-border" />

                  {/* Icon grid */}
                  <div className="grid grid-cols-6 gap-2">
                    {ICON_OPTIONS.map((nameOpt) => {
                      const Ico = getIconByName(nameOpt);
                      const active = iconName === nameOpt;
                      return (
                        <button
                          aria-label={`Choose ${nameOpt} icon`}
                          className={cn(
                            "flex items-center justify-center rounded-md border p-2 transition hover:bg-muted/50",
                            active && "border-ring shadow-sm"
                          )}
                          key={nameOpt}
                          onClick={() => {
                            setIconName(nameOpt);
                            setPickerOpen(false);
                          }}
                          title={nameOpt}
                          type="button"
                        >
                          <Ico
                            className={cn(
                              "h-4 w-4",
                              COLOR_CLASSES[iconColor].icon
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-muted-foreground text-xs">
                    Icon is optional. If you skip this, we’ll use a general
                    default.
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Examples (quick-pick premade projects) */}
          <div className="grid gap-2">
            <Label>Project examples</Label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => {
                const Ico = getIconByName(ex.icon);
                return (
                  <button
                    aria-label={`Use example "${ex.name}"`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                      "hover:bg-muted/40"
                    )}
                    key={ex.name}
                    onClick={() => {
                      setName(ex.name);
                      setIconName(ex.icon);
                      setIconColor(ex.color);
                    }}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          COLOR_CLASSES[ex.color].dot
                        )}
                      />
                      <Ico
                        className={cn("h-4 w-4", COLOR_CLASSES[ex.color].icon)}
                      />
                    </span>
                    <span className="font-medium">{ex.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Friendly explainer */}
          <div className="flex gap-3 rounded-md border p-3 text-muted-foreground text-sm">
            <Sparkles className="mt-0.5 h-4 w-4" />
            <p>
              Projects keep chats, files, and custom instructions in one place.
              Use them for ongoing work—or just to keep things tidy.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => {
              const project: Project = {
                id: crypto.randomUUID(),
                name: name.trim(),
                icon: iconName ?? "Folder",
                color: iconName ? iconColor : "gray", // neutral if icon was skipped
              };
              onCreate(project);
              onOpenChange(false);
            }}
            type="button"
          >
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
