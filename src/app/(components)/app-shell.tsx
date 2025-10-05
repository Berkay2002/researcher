"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App Shell Props
 */
export type AppShellProps = {
  leftPanel?: ReactNode;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
};

/**
 * App Shell Component
 *
 * Three-panel desktop layout:
 * - Left: Thread history (collapsible)
 * - Center: Main research chat
 * - Right: Sources panel (collapsible)
 *
 * Responsive breakpoints:
 * - Desktop (lg+): All three panels visible
 * - Tablet (md): Left panel collapses, center + right
 * - Mobile (sm): Center panel only, panels become sheets/modals
 */
export function AppShell({
  leftPanel,
  centerPanel,
  rightPanel,
  className,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-full overflow-hidden bg-background",
        className
      )}
    >
      {/* Left Panel - Thread History */}
      {leftPanel && (
        <aside
          className={cn(
            "hidden flex-shrink-0 border-r bg-muted/30 lg:flex",
            "w-64 xl:w-80" // 256px on lg, 320px on xl
          )}
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            {leftPanel}
          </div>
        </aside>
      )}

      {/* Center Panel - Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-7xl">{centerPanel}</div>
      </main>

      {/* Right Panel - Sources */}
      {rightPanel && (
        <aside
          className={cn(
            "hidden flex-shrink-0 border-l bg-muted/30 lg:flex",
            "w-80 xl:w-96" // 320px on lg, 384px on xl
          )}
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            {rightPanel}
          </div>
        </aside>
      )}
    </div>
  );
}

/**
 * Panel Header Component
 *
 * Standard header for left/right panels with title and optional actions
 */
export type PanelHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PanelHeader({
  title,
  subtitle,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold text-sm">{title}</h2>
        {subtitle && (
          <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
        )}
      </div>
      {actions && <div className="ml-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * Panel Content Component
 *
 * Scrollable content area for panels
 */
export type PanelContentProps = {
  children: ReactNode;
  className?: string;
};

export function PanelContent({ children, className }: PanelContentProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-4", className)}>
      {children}
    </div>
  );
}

/**
 * Panel Footer Component
 *
 * Fixed footer for panels (e.g., actions, filters)
 */
export type PanelFooterProps = {
  children: ReactNode;
  className?: string;
};

export function PanelFooter({ children, className }: PanelFooterProps) {
  return <div className={cn("border-t px-4 py-3", className)}>{children}</div>;
}
