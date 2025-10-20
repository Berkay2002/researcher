/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <Ignore> */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: <Ignore> */
/** biome-ignore-all lint/style/useBlockStatements: <Ignore> */
import type { ContentBlock } from "@langchain/core/messages";
import type React from "react";
import { cn } from "@/lib/utils";
import { MultimodalPreview } from "./MultimodalPreview";

interface ContentBlocksPreviewProps {
  blocks: (ContentBlock.Multimodal.Image | ContentBlock.Multimodal.File)[];
  onRemove: (idx: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders a preview of content blocks with optional remove functionality.
 * Uses cn utility for robust class merging.
 */
export const ContentBlocksPreview: React.FC<ContentBlocksPreviewProps> = ({
  blocks,
  onRemove,
  size = "md",
  className,
}) => {
  if (!blocks.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-2 p-3.5 pb-0", className)}>
      {blocks.map((block, idx) => (
        <MultimodalPreview
          block={block}
          key={idx}
          onRemove={() => onRemove(idx)}
          removable
          size={size}
        />
      ))}
    </div>
  );
};
