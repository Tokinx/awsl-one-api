import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonGroupValue = string | number;

export interface ButtonGroupOption<T extends ButtonGroupValue = ButtonGroupValue> {
  label: React.ReactNode;
  value: T;
  disabled?: boolean;
}

export interface ButtonGroupProps<T extends ButtonGroupValue = ButtonGroupValue>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T;
  options: readonly ButtonGroupOption<T>[];
  onValueChange: (value: T) => void;
  size?: ButtonProps["size"];
  activeVariant?: ButtonProps["variant"];
  inactiveVariant?: ButtonProps["variant"];
  buttonClassName?: string;
}

export function ButtonGroup<T extends ButtonGroupValue = ButtonGroupValue>({
  value,
  options,
  onValueChange,
  size = "sm",
  activeVariant = "default",
  inactiveVariant = "outline",
  className,
  buttonClassName,
  ...props
}: ButtonGroupProps<T>) {
  return (
    <div
      {...props}
      role="radiogroup"
      className={cn("inline-flex flex-wrap rounded-md border border-border", className)}
    >
      {options.map((option) => {
        const isActive = Object.is(option.value, value);

        return (
          <Button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            variant={isActive ? activeVariant : inactiveVariant}
            size={size}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn("border-0", size === "sm" && "h-8", buttonClassName)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
