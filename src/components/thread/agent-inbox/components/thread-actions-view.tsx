/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <Ignore> */
import type { HumanInterrupt } from "@langchain/langgraph/prebuilt";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useInterruptedActions from "../hooks/use-interrupted-actions";
import { constructOpenInStudioURL } from "../utils";
import { InboxItemInput } from "./inbox-item-input";
import { ThreadIdCopyable } from "./thread-id";

interface ThreadActionsViewProps {
  interrupt: HumanInterrupt;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  showState: boolean;
  showDescription: boolean;
}

function ButtonGroup({
  handleShowState,
  handleShowDescription,
  showingState,
  showingDescription,
}: {
  handleShowState: () => void;
  handleShowDescription: () => void;
  showingState: boolean;
  showingDescription: boolean;
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-0">
      <Button
        className={cn(
          "rounded-r-none rounded-l-md border-r-[0px]",
          showingState ? "text-black" : "bg-white"
        )}
        onClick={handleShowState}
        size="sm"
        variant="outline"
      >
        State
      </Button>
      <Button
        className={cn(
          "rounded-r-md rounded-l-none border-l-[0px]",
          showingDescription ? "text-black" : "bg-white"
        )}
        onClick={handleShowDescription}
        size="sm"
        variant="outline"
      >
        Description
      </Button>
    </div>
  );
}

export function ThreadActionsView({
  interrupt,
  handleShowSidePanel,
  showDescription,
  showState,
}: ThreadActionsViewProps) {
  const [threadId] = useQueryState("threadId");
  const {
    acceptAllowed,
    hasEdited,
    hasAddedResponse,
    streaming,
    supportsMultipleMethods,
    streamFinished,
    loading,
    handleSubmit,
    handleIgnore,
    handleResolve,
    setSelectedSubmitType,
    setHasAddedResponse,
    setHasEdited,
    humanResponse,
    setHumanResponse,
    initialHumanInterruptEditValue,
  } = useInterruptedActions({
    interrupt,
  });
  const [apiUrl] = useQueryState("apiUrl");

  const handleOpenInStudio = () => {
    if (!apiUrl) {
      toast.error("Error", {
        description: "Please set the LangGraph deployment URL in settings.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const studioUrl = constructOpenInStudioURL(apiUrl, threadId ?? undefined);
    window.open(studioUrl, "_blank");
  };

  const threadTitle = interrupt.action_request.action || "Unknown";
  const actionsDisabled = loading || streaming;
  const ignoreAllowed = interrupt.config.allow_ignore;

  return (
    <div className="flex min-h-full w-full flex-col gap-9">
      {/* Header */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center justify-start gap-3">
          <p className="text-pretty text-2xl tracking-tighter">{threadTitle}</p>
          {threadId && <ThreadIdCopyable threadId={threadId} />}
        </div>
        <div className="flex flex-row items-center justify-start gap-2">
          {apiUrl && (
            <Button
              className="flex items-center gap-1 bg-white"
              onClick={handleOpenInStudio}
              size="sm"
              variant="outline"
            >
              Studio
            </Button>
          )}
          <ButtonGroup
            handleShowDescription={() => handleShowSidePanel(false, true)}
            handleShowState={() => handleShowSidePanel(true, false)}
            showingDescription={showDescription}
            showingState={showState}
          />
        </div>
      </div>

      <div className="flex w-full flex-row items-center justify-start gap-2">
        <Button
          className="border-gray-500 bg-white font-normal text-gray-800"
          disabled={actionsDisabled}
          onClick={handleResolve}
          variant="outline"
        >
          Mark as Resolved
        </Button>
        {ignoreAllowed && (
          <Button
            className="border-gray-500 bg-white font-normal text-gray-800"
            disabled={actionsDisabled}
            onClick={handleIgnore}
            variant="outline"
          >
            Ignore
          </Button>
        )}
      </div>

      {/* Actions */}
      <InboxItemInput
        acceptAllowed={acceptAllowed}
        handleSubmit={handleSubmit}
        hasAddedResponse={hasAddedResponse}
        hasEdited={hasEdited}
        humanResponse={humanResponse}
        initialValues={initialHumanInterruptEditValue.current}
        interruptValue={interrupt}
        setHasAddedResponse={setHasAddedResponse}
        setHasEdited={setHasEdited}
        setHumanResponse={setHumanResponse}
        setSelectedSubmitType={setSelectedSubmitType}
        streamFinished={streamFinished}
        streaming={streaming}
        supportsMultipleMethods={supportsMultipleMethods}
      />
    </div>
  );
}
