"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App Shell Props
 */
export type AppShellProps = {
  leftPanel?: ReactNode;
  leftPanelCollapsed?: boolean;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  className?: string;
  rightPanelVisible?: boolean;
  rightPanelCollapsed?: boolean;
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
  leftPanelCollapsed = false,
  centerPanel,
  rightPanel,
  className,
  rightPanelVisible,
  rightPanelCollapsed = false,
}: AppShellProps) {
  const showRightPanel = rightPanelVisible ?? Boolean(rightPanel);
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
            leftPanelCollapsed ? "w-16" : "w-64 xl:w-80"
          )}
        >
          <div
            className={cn(
              "flex h-full w-full flex-col overflow-hidden",
              leftPanelCollapsed && "items-center justify-start pt-4"
            )}
          >
            {leftPanel}
          </div>
        </aside>
      )}

      {/* Center Panel - Main Content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col overflow-hidden">
          {centerPanel}
        </div>
      </main>

      {/* Right Panel - Sources */}
      {showRightPanel && (
        <aside
          className={cn(
            "hidden flex-shrink-0 border-l bg-muted/30 lg:flex",
            rightPanelCollapsed ? "w-16" : "w-80 xl:w-96" // 320px on lg, 384px on xl
          )}
        >
          <div
            className={cn(
              "flex h-full w-full flex-col overflow-hidden",
              rightPanelCollapsed && "items-center"
            )}
          >
            {rightPanel ?? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-muted-foreground text-sm">
                Research starting...
                <div className="mt-2 text-xs">
                  Sources will appear here once collection begins
                </div>
              </div>
            )}
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
  middle?: ReactNode;
  className?: string;
};

export function PanelHeader({
  title,
  subtitle,
  actions,
  middle,
  className,
}: PanelHeaderProps) {
  if (middle) {
    return (
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-3",
          className
        )}
      >
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-sm">{title}</h2>
          {subtitle && (
            <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
          )}
        </div>
        <div className="justify-self-center">{middle}</div>
        <div className="flex justify-end gap-1">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center border-b px-4 py-3", className)}
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold text-sm">{title}</h2>
        {subtitle && (
          <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
        )}
      </div>
      {actions ? (
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      ) : null}
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
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}>
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
