"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col sm:flex-row sm:justify-center gap-y-3 sm:gap-x-6 sm:gap-y-0",
        month: "shrink-0 space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-[12px] font-medium tracking-tight",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground/70 w-8 font-normal text-[10px] uppercase tracking-wider",
        row: "flex mt-1",
        cell: cn(
          "relative p-0 text-center text-[12px] focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent/40",
          "[&:has([aria-selected].day-range-start)]:rounded-l-md",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-7 w-8 p-0 font-normal aria-selected:opacity-100 tabular-nums rounded-md"
        ),
        day_range_start:
          "day-range-start bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
        day_range_end:
          "day-range-end bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
        day_selected:
          "bg-foreground text-background hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background",
        day_today: "underline underline-offset-4 decoration-foreground/40",
        day_outside: "day-outside text-muted-foreground/40",
        day_disabled: "text-muted-foreground/30 opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-foreground rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: () => <ChevronRight className="h-3.5 w-3.5" />,
      }}
      {...props}
    />
  );
}
