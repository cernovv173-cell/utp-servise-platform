"use client";

import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";

import { classNames } from "@/lib/class-names";

export type CalendarProps = ComponentProps<typeof DayPicker>;

export const Calendar = ({
  className,
  classNames: dayPickerClassNames,
  ...props
}: CalendarProps) => (
  <DayPicker
    className={classNames("w-fit p-3", className)}
    classNames={{
      root: "text-sm text-neutral-950",
      months: "flex flex-col gap-4 sm:flex-row",
      month: "space-y-4",
      month_caption: "relative flex h-9 items-center justify-center",
      caption_label: "text-sm font-medium",
      nav: "absolute inset-x-3 top-3 flex items-center justify-between",
      button_previous:
        "inline-flex size-9 items-center justify-center rounded-md text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-40",
      button_next:
        "inline-flex size-9 items-center justify-center rounded-md text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-40",
      month_grid: "w-full border-collapse",
      weekdays: "flex",
      weekday: "w-9 py-1 text-center text-xs font-normal text-neutral-500",
      week: "mt-1 flex w-full",
      day: "size-9 p-0 text-center",
      day_button:
        "size-9 rounded-md outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-950 aria-selected:bg-neutral-950 aria-selected:text-white",
      today: "font-semibold underline decoration-2 underline-offset-4",
      outside: "text-neutral-400",
      disabled: "pointer-events-none opacity-40",
      ...dayPickerClassNames,
    }}
    showOutsideDays
    {...props}
  />
);
