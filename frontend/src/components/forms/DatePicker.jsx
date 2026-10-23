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
 * Form-ready date picker built on reui/shadcn's Calendar (react-day-picker).
 * Value/onChange stay plain "YYYY-MM-DD" strings — the same shape every
 * existing form in this app already uses for dates — so it's a drop-in
 * replacement for <input type="date"> without touching how forms store state.
 */
export function DatePicker({ label, value, onChange, error, required, placeholder = "Pick a date", disabled, className }) {
  const [open, setOpen] = useState(false);

  const selected = value ? parseISO(value) : undefined;
  const displayDate = selected && isValid(selected) ? selected : undefined;

  const handleSelect = (date) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "");
    setOpen(false);
  };

  return (
    <FormField label={label} error={error} required={required} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-8 w-full justify-start text-left font-normal",
              !displayDate && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {displayDate ? format(displayDate, "dd MMM yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={displayDate} onSelect={handleSelect} autoFocus />
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
