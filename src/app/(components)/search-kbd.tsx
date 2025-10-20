/** biome-ignore-all lint/nursery/noReactForwardRef: <Ignore> */
import { SearchIcon } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type KbdInputGroupProps = {
  className?: string;
  inputClassName?: string;
  kbdKeys?: string[];
} & ComponentPropsWithoutRef<"input">;

export const KbdInputGroup = forwardRef<HTMLInputElement, KbdInputGroupProps>(
  function KbdInputGroupInner(
    {
      className,
      inputClassName,
      kbdKeys = ["⌘", "K"],
      placeholder = "Search...",
      type = "search",
      ...inputProps
    },
    ref
  ) {
    return (
      <InputGroup
        className={cn(
          // Rounded but restrained search surface with improved focus ring
          "h-10 w-full overflow-hidden rounded-xl",
          "bg-muted/40 ring-1 ring-border",
          "focus-within:ring-2 focus-within:ring-ring/60",
          "transition-colors",
          className
        )}
      >
        <InputGroupAddon className="pr-2 pl-3 text-muted-foreground">
          <SearchIcon className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          className={cn(
            "bg-transparent px-0",
            "focus-visible:outline-none focus-visible:ring-0",
            inputClassName
          )}
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...inputProps}
        />
        {kbdKeys.length > 0 ? (
          <InputGroupAddon align="inline-end" className="gap-1 pr-3">
            <KbdGroup>
              {kbdKeys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    );
  }
);
