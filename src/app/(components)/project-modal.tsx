"use client";

import { useEffect, useMemo, useState } from "react";
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

export type Project = {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
};

export type ProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (project: Project) => void;
};

export default function ProjectModal({
  open,
  onOpenChange,
  onCreate,
}: ProjectModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [color, setColor] = useState<string>("");

  // tiny color palette – tweak freely
  const colors = useMemo(
    () => ["#64748b", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"],
    []
  );

  useEffect(() => {
    if (!open) {
      setName("");
      setEmoji("📁");
      setColor("");
    }
  }, [open]);

  const canCreate = name.trim().length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Group threads under a named project. You can label it with an emoji
            and an accent color.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Project name</Label>
            <Input
              autoFocus
              id="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Copenhagen Trip"
              value={name}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="emoji">Emoji (optional)</Label>
            <Input
              id="emoji"
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📁"
              value={emoji}
            />
          </div>

          <div className="grid gap-2">
            <Label>Accent color (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  aria-label={`Pick ${c}`}
                  className="h-7 w-7 rounded-full border"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    backgroundColor: c,
                    boxShadow:
                      color === c ? "0 0 0 2px var(--ring)" : undefined,
                  }}
                  type="button"
                />
              ))}
              <button
                className="h-7 rounded-md border px-2 text-xs"
                onClick={() => setColor("")}
                type="button"
              >
                None
              </button>
            </div>
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
              const project = {
                id: crypto.randomUUID(),
                name: name.trim(),
                emoji: emoji.trim() || undefined,
                color: color || undefined,
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
