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
      <InputGroup className={cn("h-9 w-full", className)}>
        <InputGroupAddon className="text-muted-foreground">
          <SearchIcon className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          className={cn("px-0", inputClassName)}
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...inputProps}
        />
        {kbdKeys.length > 0 ? (
          <InputGroupAddon align="inline-end" className="gap-1">
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
