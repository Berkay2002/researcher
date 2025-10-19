"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  collapsed?: boolean;
  className?: string;
};

export function ThemeToggle({
  collapsed = false,
  className,
}: ThemeToggleProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark =
    theme === "system" ? resolvedTheme === "dark" : theme === "dark";

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <Button
        aria-label="Toggle theme"
        className={cn(collapsed && "rounded-lg", className)}
        disabled
        size={collapsed ? "icon" : "sm"}
        type="button"
        variant={collapsed ? "ghost" : "outline"}
      >
        <MoonIcon className="size-4" />
        {!collapsed && <span className="font-medium text-xs">Dark mode</span>}
      </Button>
    );
  }

  return (
    <Button
      aria-label={label}
      className={cn(collapsed && "rounded-lg", className)}
      onClick={handleToggle}
      size={collapsed ? "icon" : "sm"}
      type="button"
      variant={collapsed ? "ghost" : "outline"}
    >
      {isDark ? (
        <SunIcon aria-hidden className="size-4" />
      ) : (
        <MoonIcon aria-hidden className="size-4" />
      )}
      {!collapsed && (
        <span className="font-medium text-xs">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </Button>
  );
}
