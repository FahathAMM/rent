"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormField } from "@/components/forms/FormField";
import { cn } from "@/lib/utils";

/* Dates are plain "YYYY-MM-DD" strings throughout (compare as strings, do the maths in UTC). */
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
};
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const monthKey = (s) => s.slice(0, 7); // "YYYY-MM"
const addMonths = (key, n) => {
  const d = toDate(`${key}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toStr(d).slice(0, 7);
};
const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** The days of one month, padded to whole Monday-first weeks (null = padding). */
function monthCells(key) {
  const first = `${key}-01`;
  const lead = (toDate(first).getUTCDay() + 6) % 7;
  const days = diffDays(first, `${addMonths(key, 1)}-01`);
  const cells = Array(lead).fill(null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Pickup & return picker for one vehicle. Booked, blocked and maintenance
 * days come from /public/vehicles/{slug}/availability and can't be picked,
 * nor can a range run across them. Same rule as BookingService: a rental
 * from A to B (10:00 pickup and return) uses the days A … B-1, so the return
 * may land on the first taken day — that booking only starts at 10:00.
 * Value/onChange: { from, to } as "YYYY-MM-DD" (or "").
 */
export function BookingDateRange({ vehicle, label, value, onChange, error, placeholder = "Choose your dates" }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const from = value?.from || "";
  const to = value?.to || "";

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-availability", vehicle.slug],
    queryFn: () => publicService.vehicleAvailability(vehicle.slug).then((r) => r.data.data),
    staleTime: 60_000,
  });

  const rules = useMemo(() => {
    const today = todayStr();
    return {
      taken: new Set(data?.unavailable_dates ?? []),
      earliest: data?.earliest_pickup_date && data.earliest_pickup_date > today ? data.earliest_pickup_date : today,
      until: data?.bookable_until ?? addDays(today, 365),
      minDays: Math.max(1, Number(data?.min_rental_days ?? 1)),
      maxDays: data?.max_rental_days ? Number(data.max_rental_days) : null,
    };
  }, [data]);

  const canStart = (d) => !!data && d >= rules.earliest && d < rules.until && !rules.taken.has(d);

  // Latest possible return for a pickup on `start`: the first taken day after it (returned by 10:00), or the horizon.
  const lastReturnFor = (start) => {
    let d = addDays(start, 1);
    while (d < rules.until && !rules.taken.has(d)) d = addDays(d, 1);
    return rules.maxDays ? (addDays(start, rules.maxDays) < d ? addDays(start, rules.maxDays) : d) : d;
  };
  const canEnd = (start, d) => {
    if (!start || d <= start) return false;
    const days = diffDays(start, d);
    return days >= rules.minDays && d <= lastReturnFor(start);
  };

  const pickingReturn = !!from && !to;
  const isEnabled = (d) => (pickingReturn ? canEnd(from, d) || (d < from && canStart(d)) : canStart(d));

  // A restored draft (or a stale tab) can hold dates that have since been taken - drop them.
  useEffect(() => {
    if (!data || !from) return;
    if (!canStart(from) || (to && !canEnd(from, to))) onChange({ from: "", to: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const [month, setMonth] = useState(() => monthKey(from || todayStr()));
  useEffect(() => {
    if (open) setMonth(monthKey(from || rules.earliest));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (d) => {
    if (!isEnabled(d)) return;
    if (pickingReturn && canEnd(from, d)) {
      onChange({ from, to: d });
      setOpen(false);
    } else {
      onChange({ from: d, to: "" });
    }
  };

  const rangeEnd = to || (pickingReturn && hover && canEnd(from, hover) ? hover : "");
  const display = from
    ? `${format(parseISO(from), "dd MMM yyyy")} – ${to ? format(parseISO(to), "dd MMM yyyy") : "…"}`
    : placeholder;
  const canGoBack = month > monthKey(todayStr());
  const canGoForward = addMonths(month, 1) <= monthKey(rules.until);

  const renderMonth = (key, className) => (
    <div key={key} className={cn("w-[252px]", className)}>
      <p className="mb-2 text-center text-sm font-semibold">{format(parseISO(`${key}-01`), "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {monthCells(key).map((d, i) => {
          if (!d) return <span key={`pad-${i}`} />;
          const enabled = isEnabled(d);
          const taken = rules.taken.has(d);
          const isFrom = d === from;
          const isTo = d === rangeEnd;
          const inRange = from && rangeEnd && d > from && d < rangeEnd;
          return (
            <button
              key={d}
              type="button"
              disabled={!enabled}
              onClick={() => pick(d)}
              onMouseEnter={() => setHover(d)}
              title={taken ? "Not available" : undefined}
              aria-pressed={isFrom || isTo}
              className={cn(
                "relative mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                enabled && "hover:bg-accent",
                !enabled && "cursor-not-allowed text-muted-foreground/40",
                taken && "line-through decoration-muted-foreground/60",
                inRange && "rounded-none bg-primary/10 text-foreground",
                (isFrom || isTo) && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                d === todayStr() && !isFrom && !isTo && "ring-1 ring-inset ring-border",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <FormField label={label} error={error}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("h-8 w-full justify-start text-left font-normal", !from && "text-muted-foreground", error && "border-destructive")}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {display}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start" onMouseLeave={() => setHover(null)}>
          {isLoading ? (
            <div className="flex h-64 w-[252px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="relative flex gap-6">
                <button type="button" onClick={() => setMonth(addMonths(month, -1))} disabled={!canGoBack} className="absolute left-0 top-0 rounded-md p-1 hover:bg-accent disabled:opacity-30" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setMonth(addMonths(month, 1))} disabled={!canGoForward} className="absolute right-0 top-0 rounded-md p-1 hover:bg-accent disabled:opacity-30" aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
                {renderMonth(month)}
                {renderMonth(addMonths(month, 1), "hidden sm:block")}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t pt-2 text-xs text-muted-foreground">
                <p>
                  {pickingReturn ? "Now pick your return date" : "Pick your pickup date"} · 10:00
                  {rules.minDays > 1 && ` · min ${rules.minDays} days`}
                  {rules.maxDays && ` · max ${rules.maxDays} days`}
                  <span className="ml-2 line-through">12</span> = not available
                </p>
                {from && (
                  <button type="button" onClick={() => onChange({ from: "", to: "" })} className="font-medium text-primary hover:underline">Clear</button>
                )}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
