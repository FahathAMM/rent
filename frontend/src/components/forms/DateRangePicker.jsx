"use client";

import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormField } from "@/components/forms/FormField";

/**
 * One-calendar date-range filter built on reui/shadcn's Calendar
 * (react-day-picker mode="range") — a single popover picks both ends of
 * the range instead of pairing two separate <DatePicker>s. Value/onChange
 * stay a plain { from, to } pair of "YYYY-MM-DD" strings (or "").
 */
export function DateRangePicker({ label, value, onChange, error, placeholder = "Pick a date range", disabled, className }) {
  const [open, setOpen] = useState(false);

  const from = value?.from ? parseISO(value.from) : undefined;
  const to = value?.to ? parseISO(value.to) : undefined;
  const selected = {
    from: from && isValid(from) ? from : undefined,
    to: to && isValid(to) ? to : undefined,
  };

  const handleSelect = (range) => {
    onChange({
      from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
      to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
    });
    if (range?.from && range?.to) setOpen(false);
  };

  const display = selected.from
    ? selected.to
      ? `${format(selected.from, "dd MMM yyyy")} – ${format(selected.to, "dd MMM yyyy")}`
      : `${format(selected.from, "dd MMM yyyy")} – …`
    : placeholder;

  return (
    <FormField label={label} error={error} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-start text-left font-normal",
              !selected.from && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {display}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" selected={selected} onSelect={handleSelect} numberOfMonths={2} autoFocus />
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
