import type { Experimental_GeneratedImage } from "ai";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export const AIImage = ({
  base64,
  uint8Array,
  mediaType,
  width = 512,
  height = 512,
  ...props
}: ImageProps) => (
  <Image
    {...props}
    alt={props.alt || "Generated image"}
    className={cn(
      "h-auto max-w-full overflow-hidden rounded-md",
      props.className
    )}
    height={height}
    src={`data:${mediaType};base64,${base64}`}
    width={width}
  />
);
