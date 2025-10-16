import type { Thread } from "@langchain/langgraph-sdk";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect } from "react";
import {
  PanelContent,
  PanelFooter,
  PanelHeader,
} from "@/app/(components)/app-shell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useThreads } from "@/providers/Thread";
import { getContentString } from "../utils";

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="space-y-1">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        return (
          <Button
            className="h-auto w-full items-start justify-start rounded-md px-3 py-2 text-left font-normal transition hover:bg-muted/40"
            key={t.thread_id}
            onClick={(e) => {
              e.preventDefault();
              onThreadClick?.(t.thread_id);
              if (t.thread_id === threadId) return;
              setThreadId(t.thread_id);
            }}
            variant="ghost"
          >
            <p className="truncate text-ellipsis text-sm">{itemText}</p>
          </Button>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 15 }).map((_, i) => (
        <Skeleton className="h-12 w-full" key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(true)
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  return (
    <>
      <div className="hidden h-full flex-col lg:flex">
        <PanelHeader
          actions={
            <Button
              aria-label="Hide threads"
              className="size-7 rounded-lg hover:bg-accent/60"
              onClick={() => setChatHistoryOpen((p) => !p)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <PanelLeftCloseIcon className="size-5" />
            </Button>
          }
          subtitle={`${threads.length} total`}
          title="Thread History"
        />
        <PanelContent className="space-y-2">
          {threadsLoading ? (
            <ThreadHistoryLoading />
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground text-sm">No threads yet</p>
            </div>
          ) : (
            <ThreadList threads={threads} />
          )}
        </PanelContent>
        <PanelFooter className="text-center">
          <p className="text-muted-foreground text-xs">
            {threads.length} thread{threads.length !== 1 ? "s" : ""}
          </p>
        </PanelFooter>
      </div>

      {/* Mobile Sheet */}
      <div className="lg:hidden">
        <Sheet
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
          open={!!chatHistoryOpen && !isLargeScreen}
        >
          <SheetContent className="flex lg:hidden" side="left">
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            {threadsLoading ? (
              <ThreadHistoryLoading />
            ) : (
              <ThreadList
                onThreadClick={() => setChatHistoryOpen((o) => !o)}
                threads={threads}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
