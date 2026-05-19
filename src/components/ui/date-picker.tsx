"use client";

import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  align = "start",
  clearable = true,
  size = "default",
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  clearable?: boolean;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={cn(
            "group justify-start gap-2 font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
          <span className="tabular-nums" suppressHydrationWarning>
            {value ? formatDate(value, "medium") : placeholder}
          </span>
          {clearable && value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(undefined);
              }}
              className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d ?? undefined);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

