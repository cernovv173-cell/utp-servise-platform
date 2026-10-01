"use client";

import * as Popover from "@radix-ui/react-popover";
import { useId, useMemo, useRef, useState } from "react";

import { classNames } from "@/lib/class-names";

export type SelectOption = {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
};

export type SelectProps = {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly disabled?: boolean;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value?: string;
};

export const Select = ({
  ariaLabel,
  className,
  contentClassName,
  disabled = false,
  onValueChange,
  options,
  placeholder = "Select an option",
  value,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);
  const selectedOption = options.find((option) => option.value === value);

  const focusOption = (nextValue?: string) => {
    const fallback = enabledOptions[0]?.value;
    optionRefs.current.get(nextValue ?? fallback ?? "")?.focus();
  };

  const moveFocus = (currentValue: string, direction: -1 | 1) => {
    const index = enabledOptions.findIndex((option) => option.value === currentValue);
    const nextIndex = (index + direction + enabledOptions.length) % enabledOptions.length;
    focusOption(enabledOptions[nextIndex]?.value);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={classNames(
            "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-950 shadow-sm outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          disabled={disabled}
          role="combobox"
          type="button"
        >
          <span className={selectedOption ? undefined : "text-neutral-500"}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span aria-hidden="true" className="text-xs text-neutral-500">
            ▾
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className={classNames(
            "z-50 max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 text-sm text-neutral-950 shadow-lg outline-none",
            contentClassName,
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusOption(value);
          }}
          sideOffset={6}
        >
          <div aria-label={ariaLabel} id={listboxId} role="listbox">
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className="flex min-h-9 w-full items-center justify-between rounded-md px-3 py-2 text-left outline-none hover:bg-neutral-100 focus:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40 aria-selected:bg-neutral-100 aria-selected:font-medium"
                disabled={option.disabled}
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(option.value, event.key === "ArrowDown" ? 1 : -1);
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    focusOption(
                      event.key === "Home"
                        ? enabledOptions[0]?.value
                        : enabledOptions.at(-1)?.value,
                    );
                  }
                }}
                ref={(node) => {
                  if (node) optionRefs.current.set(option.value, node);
                  else optionRefs.current.delete(option.value);
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {option.value === value ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
