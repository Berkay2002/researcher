import type { ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

// Returns a Promise of a typed multimodal block for images or PDFs
export async function fileToContentBlock(
  file: File
): Promise<ContentBlock.Multimodal.Image | ContentBlock.Multimodal.File> {
  const supportedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const supportedFileTypes = [...supportedImageTypes, "application/pdf"];

  if (!supportedFileTypes.includes(file.type)) {
    toast.error(
      `Unsupported file type: ${file.type}. Supported types are: ${supportedFileTypes.join(", ")}`
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  const data = await fileToBase64(file);

  if (supportedImageTypes.includes(file.type)) {
    return {
      type: "image",
      mimeType: file.type,
      data,
      metadata: { name: file.name },
    };
  }

  // PDF
  return {
    type: "file",
    mimeType: "application/pdf",
    data,
    metadata: { filename: file.name },
  };
}

// Helper to convert File to base64 string
// biome-ignore lint/suspicious/useAwait: <Ignore>
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Type guard for multimodal content blocks (Image or File)
export function isMultimodalContentBlock(
  block: unknown
): block is ContentBlock.Multimodal.Image | ContentBlock.Multimodal.File {
  // biome-ignore lint/style/useBlockStatements: <Ignore>
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;

  const blockType = (block as { type: unknown }).type;

  // Check for image or file type with data
  if ((blockType === "image" || blockType === "file") && "data" in block) {
    return typeof (block as { data: unknown }).data === "string";
  }

  return false;
}

// Alias for backward compatibility
export const isBase64ContentBlock = isMultimodalContentBlock;
