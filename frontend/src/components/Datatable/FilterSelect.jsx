"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A ServerDataTable toolbar filter — "" means "all" (Radix Select can't hold an empty value, so it's mapped to "all"). */
export function FilterSelect({ value, onChange, options, allLabel = "All", className }) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className={cn("h-8 w-full text-sm sm:w-44", className)}><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.filter((o) => o.value !== "").map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
