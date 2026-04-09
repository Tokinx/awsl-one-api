import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "children" | "onChange" | "size">;

interface SelectProps extends NativeSelectProps {
  children: React.ReactNode;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
  contentClassName?: string;
}

interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

const TRIGGER_BASE_CLASS =
  "group relative flex h-10 w-full items-center rounded-lg border border-input/90 bg-card/90 px-3 py-2 pr-12 text-sm text-foreground shadow-sm outline-none transition-all duration-200 hover:border-primary/25 hover:bg-card focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground";

const CONTENT_BASE_CLASS =
  "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border/70 bg-popover/95 p-1.5 text-popover-foreground shadow-md backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 dark:shadow-[0_24px_70px_-24px_hsl(0_0%_0%_/_0.8)]";

const ITEM_BASE_CLASS =
  "relative flex w-full select-none items-center rounded-lg px-3 py-2 pr-9 text-xs text-foreground outline-none transition-all duration-150 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-primary/10 data-[highlighted]:text-foreground data-[state=checked]:bg-primary/8";

const isElementOfType = (
  child: React.ReactNode,
  type: "option" | "optgroup",
): child is React.ReactElement<React.HTMLAttributes<HTMLElement>> => React.isValidElement(child) && child.type === type;

const extractOptions = (children: React.ReactNode): SelectOption[] => {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!child) return;

    if (React.isValidElement(child) && child.type === React.Fragment) {
      options.push(...extractOptions(child.props.children));
      return;
    }

    if (isElementOfType(child, "optgroup")) {
      options.push(...extractOptions(child.props.children));
      return;
    }

    if (!isElementOfType(child, "option")) {
      return;
    }

    const rawValue = child.props.value;
    if (rawValue == null) {
      return;
    }

    options.push({
      value: String(rawValue),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });

  return options;
};

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      className,
      contentClassName,
      disabled,
      form,
      id,
      name,
      required,
      autoComplete,
      dir,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      onKeyDown,
      placeholder = "请选择",
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      "aria-labelledby": ariaLabelledBy,
    },
    ref,
  ) => {
    const options = React.useMemo(() => extractOptions(children), [children]);

    const normalizedValue = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
    const normalizedDefaultValue =
      typeof defaultValue === "string" || typeof defaultValue === "number" ? String(defaultValue) : undefined;

    const handleValueChange = React.useCallback(
      (nextValue: string) => {
        if (!onChange) return;

        const syntheticEvent = {
          target: { value: nextValue, name },
          currentTarget: { value: nextValue, name },
        } as React.ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
      },
      [name, onChange],
    );

    return (
      <SelectPrimitive.Root
        value={normalizedValue}
        defaultValue={normalizedDefaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={name}
        autoComplete={autoComplete}
        required={required}
        form={form}
        dir={dir}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          className={cn(TRIGGER_BASE_CLASS, className)}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-labelledby={ariaLabelledBy}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <span className="pointer-events-none absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-all duration-200 ">
              <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </span>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(CONTENT_BASE_CLASS, contentClassName)}
            position="popper"
            sideOffset={10}
            collisionPadding={12}
          >
            <SelectPrimitive.ScrollUpButton className="flex h-8 cursor-default items-center justify-center rounded-md text-muted-foreground">
              <ChevronUp className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>

            <SelectPrimitive.Viewport className="p-0.5">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={ITEM_BASE_CLASS}
                  textValue={typeof option.label === "string" ? option.label : option.value}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center justify-center text-primary">
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>

            <SelectPrimitive.ScrollDownButton className="flex h-8 cursor-default items-center justify-center rounded-md text-muted-foreground">
              <ChevronDown className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);

Select.displayName = "Select";

export { Select };
