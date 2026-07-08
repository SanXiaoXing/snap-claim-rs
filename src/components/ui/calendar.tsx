"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button-variants"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * ponytail: shadcn Calendar (react-day-picker v9)。
 * 颜色全部映射到现有 CSS 变量（--accent/--card/--border/--fg/--fg-muted），
 * 不依赖 shadcn token 体系，可直接融入本项目 5 套主题。
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 justify-center",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-[var(--fg)]",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 p-0 absolute left-2 rounded-md bg-transparent",
          "hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-9 p-0 absolute right-2 rounded-md bg-transparent",
          "hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-[var(--fg-muted)] rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-range-start)]:rounded-l-md",
          props.mode === "range"
            ? "[&:has([aria-selected].day-outside)]:bg-transparent"
            : "[&:has([aria-selected].day-outside)]:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]",
          "[&:has([aria-selected].day-outside)]:text-[var(--fg-muted)]",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100",
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:text-white focus:bg-[var(--accent)] focus:text-white",
        today: cn(
          "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--fg)]",
        ),
        outside:
          "day-outside text-[var(--fg-muted)] aria-selected:text-[var(--fg-muted)]/50",
        disabled: "text-[var(--fg-muted)] opacity-50",
        range_middle:
          "aria-selected:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] aria-selected:text-[var(--fg)]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-5 w-5" />
          ) : orientation === "right" ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
