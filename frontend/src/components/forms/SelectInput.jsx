"use client";

import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Radix disallows "" as a SelectItem value, so we use this sentinel internally.
const EMPTY_VAL = "__empty__";

export function SelectInput({ label, error, required, options = [], placeholder = "Select...", value, onChange, className, triggerClassName, disabled }) {
  const hasEmptyOption = options.some((o) => String(o.value) === "");

  // "" → EMPTY_VAL when an empty-string option exists, otherwise keep "" (shows placeholder)
  const toInternal = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s === "" ? (hasEmptyOption ? EMPTY_VAL : "") : s;
  };

  const toExternal = (v) => (v === EMPTY_VAL ? "" : v);

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>
          {label}
        </Label>
      )}
      <Select value={toInternal(value)} onValueChange={(v) => onChange(toExternal(v))} disabled={disabled}>
        <SelectTrigger className={cn(error && "border-destructive", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => {
            const iv = String(opt.value) === "" ? EMPTY_VAL : String(opt.value);
            return (
              <SelectItem key={iv} value={iv}>
                {opt.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
