"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";

import { Calendar } from "@/components/calendar";

import { classNames } from "@/lib/class-names";

export type DatePickerProps = {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly disabledDates?: Matcher | Matcher[];
  readonly format?: Intl.DateTimeFormatOptions;
  readonly locale?: string;
  readonly onValueChange: (value: Date | undefined) => void;
  readonly placeholder?: string;
  readonly value?: Date;
};

export const DatePicker = ({
  ariaLabel,
  className,
  disabled = false,
  disabledDates,
  format = { day: "numeric", month: "long", year: "numeric" },
  locale,
  onValueChange,
  placeholder = "Choose a date",
  value,
}: DatePickerProps) => {
  const [open, setOpen] = useState(false);
  const label = value ? new Intl.DateTimeFormat(locale, format).format(value) : placeholder;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          aria-expanded={open}
          aria-label={ariaLabel}
          className={classNames(
            "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-950 shadow-sm outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          disabled={disabled}
          type="button"
        >
          <span className={value ? undefined : "text-neutral-500"}>{label}</span>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-neutral-500" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-50 rounded-lg border border-neutral-200 bg-white shadow-lg outline-none"
          sideOffset={6}
        >
          <Calendar
            defaultMonth={value}
            disabled={disabledDates}
            mode="single"
            onSelect={(date) => {
              onValueChange(date);
              if (date) setOpen(false);
            }}
            selected={value}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
