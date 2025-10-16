import type { HumanInterrupt } from "@langchain/langgraph/prebuilt";
import { useState } from "react";
import { useStreamContext } from "@/providers/Stream";
import { StateView } from "./components/state-view";
import { ThreadActionsView } from "./components/thread-actions-view";

interface ThreadViewProps {
  interrupt: HumanInterrupt | HumanInterrupt[];
}

export function ThreadView({ interrupt }: ThreadViewProps) {
  const interruptObj = Array.isArray(interrupt) ? interrupt[0] : interrupt;
  const thread = useStreamContext();
  const [showDescription, setShowDescription] = useState(false);
  const [showState, setShowState] = useState(false);
  const showSidePanel = showDescription || showState;

  const handleShowSidePanel = (
    showState: boolean,
    showDescription: boolean
  ) => {
    if (showState && showDescription) {
      console.error("Cannot show both state and description");
      return;
    }
    if (showState) {
      setShowDescription(false);
      setShowState(true);
    } else if (showDescription) {
      setShowState(false);
      setShowDescription(true);
    } else {
      setShowState(false);
      setShowDescription(false);
    }
  };

  return (
    <div className="flex h-[80vh] w-full flex-col overflow-y-scroll rounded-2xl bg-gray-50/50 p-8 lg:flex-row [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
      {showSidePanel ? (
        <StateView
          description={interruptObj.description}
          handleShowSidePanel={handleShowSidePanel}
          values={thread.values}
          view={showState ? "state" : "description"}
        />
      ) : (
        <ThreadActionsView
          handleShowSidePanel={handleShowSidePanel}
          interrupt={interruptObj}
          showDescription={showDescription}
          showState={showState}
        />
      )}
    </div>
  );
}
