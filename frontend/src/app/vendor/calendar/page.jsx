"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Home, Loader2, Lock, Wrench } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL = "all";

/** "YYYY-MM-DD" from the date's LOCAL parts — toISOString() would shift to UTC and land on the previous day east of UTC (e.g. Sri Lanka). */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMonthGrid(monthStart) {
  const firstDay = new Date(monthStart);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), d));
  // Pad the last week so every row has 7 cells and the grid edges line up.
  while (cells.length % 7) cells.push(null);
  return cells;
}

const STATUS_STYLES = {
  available: "bg-card hover:border-primary/50 cursor-pointer",
  blocked: "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 cursor-pointer",
  booked: "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 cursor-pointer",
  maintenance: "bg-violet-100 border-violet-300 text-violet-800 cursor-not-allowed",
};

export default function VehicleCalendarPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { can } = useAuthStore();
  const todayKey = toDateKey(new Date());
  const [vehicleId, setVehicleId] = useState(ALL);
  const [openDay, setOpenDay] = useState(null); // "YYYY-MM-DD" whose list is shown (All vehicles view)
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const from = toDateKey(monthStart);
  const to = toDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-availability", from, to],
    queryFn: () => vendorService.availability.getAll({ from, to }).then((r) => r.data.data),
  });

  const vehicles = useMemo(() => data?.vehicles ?? [], [data]);
  const isAll = vehicleId === ALL;
  const activeVehicleId = isAll ? null : vehicleId;
  const titleById = useMemo(() => Object.fromEntries(vehicles.map((v) => [String(v.id), v.title])), [vehicles]);

  // "All vehicles": per day, which vehicles are booked / blocked / in maintenance.
  const dayGroups = useMemo(() => {
    if (!isAll) return {};
    const map = {};
    (data?.rows ?? []).forEach((r) => {
      const day = (map[r.date] ??= { booked: [], blocked: [], maintenance: [] });
      day[r.status]?.push({
        vehicleId: String(r.vehicle_id),
        title: titleById[String(r.vehicle_id)] ?? "Vehicle",
        reference: r.booking?.reference,
        customer: r.booking?.customer,
        bookingStatus: r.booking?.status,
        note: r.note,
      });
    });
    return map;
  }, [data, isAll, titleById]);

  const rowByDate = useMemo(() => {
    const map = {};
    (data?.rows ?? []).filter((r) => String(r.vehicle_id) === String(activeVehicleId)).forEach((r) => {
      map[r.date] = r;
    });
    return map;
  }, [data, activeVehicleId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-availability"] });

  const block = useMutation({
    mutationFn: ({ vehicleId, date }) => vendorService.availability.block(vehicleId, { from: date, to: date }),
    onSuccess: () => { invalidate(); toast.success("Date blocked"); },
    onError: (err) => toast.error(err.response?.data?.message ?? err.response?.data?.errors?.from?.[0] ?? "Failed to block"),
  });

  const unblock = useMutation({
    mutationFn: ({ vehicleId, date }) => vendorService.availability.unblock(vehicleId, { from: date, to: date }),
    onSuccess: () => { invalidate(); toast.success("Date unblocked"); },
    onError: () => toast.error("Failed to unblock"),
  });

  const canEdit = can("vendor-vehicles-calendar-edit");

  const busy = block.isPending || unblock.isPending;

  const handleDayClick = (date) => {
    if (isAll) {
      // Any day with bookings or blocks opens the list of vehicles for that day.
      const key = toDateKey(date);
      const day = dayGroups[key];
      if (day && (day.booked.length || day.blocked.length || day.maintenance.length)) setOpenDay(key);
      return;
    }
    if (!activeVehicleId) return;
    const key = toDateKey(date);
    const row = rowByDate[key];
    const status = row?.status ?? "available";
    // A booked day opens its booking; free/blocked days toggle (future only).
    if (status === "booked") {
      if (row?.booking?.reference) router.push(`/vendor/bookings/${row.booking.reference}`);
      return;
    }
    if (!canEdit || busy || status === "maintenance" || key < todayKey) return;
    if (status === "blocked") unblock.mutate({ vehicleId: activeVehicleId, date: key });
    else block.mutate({ vehicleId: activeVehicleId, date: key });
  };

  const cells = buildMonthGrid(monthStart);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Calendar" },
  ];

  const goToMonth = (delta) => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const isCurrentMonth = toDateKey(monthStart) === toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="space-y-0 p-0 sm:p-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <SelectInput
          className="w-full sm:w-64"
          placeholder="Select a vehicle"
          options={[{ value: ALL, label: "All vehicles" }, ...vehicles.map((v) => ({ value: String(v.id), label: v.title }))]}
          value={String(vehicleId)}
          onChange={setVehicleId}
        />
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Today
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-semibold">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !vehicles.length ? (
        <p className="m-5 rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">You have no vehicles yet.</p>
      ) : (
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`blank-${i}`} className="h-14 rounded-lg bg-muted/30 sm:h-20" />;
              if (isAll) return <AllVehiclesDay key={toDateKey(date)} date={date} todayKey={todayKey} total={vehicles.length} day={dayGroups[toDateKey(date)]} onClick={() => handleDayClick(date)} />;
              const key = toDateKey(date);
              const row = rowByDate[key];
              const status = row?.status ?? "available";
              const past = key < todayKey;
              const today = key === todayKey;
              const clickable = status === "booked" ? !!row?.booking?.reference : canEdit && !past && status !== "maintenance";
              const title = status === "booked"
                ? `Booked${row?.booking ? ` — ${row.booking.reference}${row.booking.customer ? ` · ${row.booking.customer}` : ""}` : ""}`
                : status === "blocked" ? `Blocked by you${row?.note ? ` — ${row.note}` : ""}${clickable ? " · click to unblock" : ""}`
                : status === "maintenance" ? "Maintenance"
                : past ? "Past date" : clickable ? "Available · click to block" : "Available";
              return (
                <button
                  type="button"
                  key={key}
                  title={title}
                  onClick={() => handleDayClick(date)}
                  disabled={!clickable}
                  className={cn(
                    // Fixed height (not aspect-square) so a whole month fits on screen at any width.
                    "flex h-14 min-w-0 flex-col items-start justify-between rounded-lg border p-1.5 text-left text-sm transition-colors disabled:cursor-default sm:h-20 sm:p-2",
                    STATUS_STYLES[status],
                    past && "opacity-45",
                    today && "border-primary ring-1 ring-primary",
                  )}
                >
                  <span className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    today ? "bg-primary font-semibold text-primary-foreground" : "font-medium",
                  )}>
                    {date.getDate()}
                  </span>
                  {status !== "available" && (
                    <span className="hidden w-full truncate text-[10px] font-medium leading-tight sm:block">
                      {status === "booked" ? row?.booking?.reference ?? "Booked" : status === "blocked" ? "Blocked" : "Maintenance"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border bg-card" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-amber-300 bg-amber-100" /> Blocked by you</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-destructive/30 bg-destructive/10" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-violet-300 bg-violet-100" /> Maintenance</span>
            <span className="flex items-center gap-1.5"><span className="flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-semibold text-primary-foreground">1</span> Today</span>
            <span className="w-full sm:ml-auto sm:w-auto">
              {isAll
                ? "Showing all vehicles — click a busy day to see who has what. Pick a vehicle to block or free dates."
                : canEdit ? "Click a free day to block it, a blocked day to free it, a booked day to open it." : "Click a booked day to open its booking."}
            </span>
          </div>
        </div>
      )}

      {openDay && (
        <DayDetailsDialog
          dateKey={openDay}
          day={dayGroups[openDay]}
          total={vehicles.length}
          onClose={() => setOpenDay(null)}
          onShowVehicle={(id) => { setOpenDay(null); setVehicleId(id); }}
        />
      )}
    </HomePageWrapper>
  );
}

/** Everything on one day across all vehicles: bookings (linked) and blocks (jump to that vehicle's calendar to free them). */
function DayDetailsDialog({ dateKey, day, total, onClose, onShowVehicle }) {
  const booked = day?.booked ?? [];
  const blocked = day?.blocked ?? [];
  const maintenance = day?.maintenance ?? [];
  const free = Math.max(0, total - booked.length - blocked.length - maintenance.length);
  const [y, m, d] = dateKey.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {label}</DialogTitle>
          <DialogDescription>
            {booked.length} booked · {blocked.length + maintenance.length} blocked · {free} of {total} free
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto text-sm">
          {booked.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bookings</p>
              {booked.map((b) => (
                <Link
                  key={`${b.vehicleId}-${b.reference}`}
                  href={b.reference ? `/vendor/bookings/${b.reference}` : "#"}
                  className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 transition-colors hover:bg-destructive/10"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.reference}{b.customer ? ` · ${b.customer}` : ""}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary">Open →</span>
                </Link>
              ))}
            </section>
          )}

          {(blocked.length > 0 || maintenance.length > 0) && (
            <section className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not available</p>
              {[...blocked.map((b) => ({ ...b, kind: "blocked" })), ...maintenance.map((b) => ({ ...b, kind: "maintenance" }))].map((b) => (
                <div key={`${b.kind}-${b.vehicleId}`} className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-2.5",
                  b.kind === "blocked" ? "border-amber-300 bg-amber-50 dark:bg-amber-500/10" : "border-violet-300 bg-violet-50 dark:bg-violet-500/10",
                )}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {b.kind === "blocked" ? <Lock className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />} {b.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{b.kind === "blocked" ? "Blocked by you" : "Maintenance"}{b.note ? ` · ${b.note}` : ""}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => onShowVehicle(b.vehicleId)}>
                    View calendar
                  </Button>
                </div>
              ))}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A day in the "All vehicles" view: how many are booked / blocked / free. Hover summarises; click opens the full list. */
function AllVehiclesDay({ date, todayKey, total, day, onClick }) {
  const key = toDateKey(date);
  const past = key < todayKey;
  const today = key === todayKey;
  const booked = day?.booked ?? [];
  const blocked = [...(day?.blocked ?? []), ...(day?.maintenance ?? [])];
  const free = Math.max(0, total - booked.length - blocked.length);
  const title = [
    booked.length && `Booked:\n${booked.map((b) => `• ${b.title}${b.reference ? ` (${b.reference})` : ""}`).join("\n")}`,
    blocked.length && `Blocked / maintenance:\n${blocked.map((b) => `• ${b.title}`).join("\n")}`,
    `${free} of ${total} free`,
  ].filter(Boolean).join("\n\n");
  const busyDay = booked.length > 0 || blocked.length > 0;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!busyDay}
      className={cn(
        "flex h-14 min-w-0 flex-col items-start justify-between rounded-lg border bg-card p-1.5 text-left text-sm transition-colors disabled:cursor-default sm:h-20 sm:p-2",
        busyDay && "cursor-pointer hover:border-primary/50 hover:shadow-sm",
        free === 0 && "bg-destructive/5",
        past && "opacity-45",
        today && "border-primary ring-1 ring-primary",
      )}
    >
      <span className={cn(
        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
        today ? "bg-primary font-semibold text-primary-foreground" : "font-medium",
      )}>
        {date.getDate()}
      </span>
      <span className="flex w-full flex-wrap gap-1 text-[10px] font-medium leading-none">
        {booked.length > 0 && <span className="rounded bg-destructive/10 px-1 py-0.5 text-destructive">{booked.length}<span className="hidden sm:inline"> booked</span></span>}
        {blocked.length > 0 && <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-800">{blocked.length}<span className="hidden sm:inline"> blocked</span></span>}
        {(booked.length > 0 || blocked.length > 0) && <span className="hidden text-muted-foreground sm:inline">{free} free</span>}
      </span>
    </button>
  );
}
