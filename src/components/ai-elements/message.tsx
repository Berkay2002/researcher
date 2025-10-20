import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-start gap-3 py-4",
      from === "user"
        ? "is-user flex-row-reverse justify-end"
        : "is-assistant justify-start",
      className
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "flex flex-col text-sm leading-relaxed",
  {
    variants: {
      variant: {
        default: [
          "group-[.is-user]:max-w-[70%] group-[.is-user]:rounded-3xl group-[.is-user]:bg-primary group-[.is-user]:px-5 group-[.is-user]:py-3 group-[.is-user]:text-primary-foreground group-[.is-user]:shadow-sm",
          "group-[.is-user]:ml-auto",
          "group-[.is-assistant]:w-full group-[.is-assistant]:max-w-full group-[.is-assistant]:rounded-none group-[.is-assistant]:bg-transparent group-[.is-assistant]:px-0 group-[.is-assistant]:py-0",
        ],
        flat: [
          "group-[.is-user]:max-w-[70%] group-[.is-user]:rounded-3xl group-[.is-user]:bg-secondary group-[.is-user]:px-5 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-user]:shadow-sm",
          "group-[.is-user]:ml-auto",
          "group-[.is-assistant]:w-full group-[.is-assistant]:max-w-full group-[.is-assistant]:bg-transparent group-[.is-assistant]:px-0 group-[.is-assistant]:py-0",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants>;

export const MessageContent = ({
  children,
  className,
  variant,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(messageContentVariants({ variant, className }))}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("size-8 ring-1 ring-border", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);
