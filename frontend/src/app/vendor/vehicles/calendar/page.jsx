"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorAvailabilityService } from "@/services/vendorAvailabilityService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthGrid(monthStart) {
  const firstDay = new Date(monthStart);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), d));
  return cells;
}

const STATUS_STYLES = {
  available: "bg-card hover:border-primary/50 cursor-pointer",
  blocked: "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 cursor-pointer",
  booked: "bg-destructive/10 border-destructive/30 text-destructive cursor-not-allowed",
  maintenance: "bg-violet-100 border-violet-300 text-violet-800 cursor-not-allowed",
};

export default function VehicleCalendarPage() {
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [vehicleId, setVehicleId] = useState("");
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const from = toDateKey(monthStart);
  const to = toDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-availability", from, to],
    queryFn: () => vendorAvailabilityService.getAll({ from, to }).then((r) => r.data.data),
  });

  const vehicles = data?.vehicles ?? [];
  const activeVehicleId = vehicleId || vehicles[0]?.id || "";

  const statusByDate = useMemo(() => {
    const map = {};
    (data?.rows ?? []).filter((r) => String(r.vehicle_id) === String(activeVehicleId)).forEach((r) => {
      map[r.date] = r.status;
    });
    return map;
  }, [data, activeVehicleId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-availability"] });

  const block = useMutation({
    mutationFn: ({ vehicleId, date }) => vendorAvailabilityService.block(vehicleId, { from: date, to: date }),
    onSuccess: () => { invalidate(); toast.success("Date blocked"); },
    onError: (err) => toast.error(err.response?.data?.message ?? err.response?.data?.errors?.from?.[0] ?? "Failed to block"),
  });

  const unblock = useMutation({
    mutationFn: ({ vehicleId, date }) => vendorAvailabilityService.unblock(vehicleId, { from: date, to: date }),
    onSuccess: () => { invalidate(); toast.success("Date unblocked"); },
    onError: () => toast.error("Failed to unblock"),
  });

  const canEdit = can("vendor-vehicles-calendar-edit");

  const handleDayClick = (date) => {
    if (!canEdit || !activeVehicleId) return;
    const key = toDateKey(date);
    const status = statusByDate[key] ?? "available";
    if (status === "booked" || status === "maintenance") return;
    if (status === "blocked") unblock.mutate({ vehicleId: activeVehicleId, date: key });
    else block.mutate({ vehicleId: activeVehicleId, date: key });
  };

  const cells = buildMonthGrid(monthStart);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Calendar" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SelectInput
          className="w-64"
          placeholder="Select a vehicle"
          options={vehicles.map((v) => ({ value: String(v.id), label: v.title }))}
          value={String(activeVehicleId)}
          onChange={setVehicleId}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !activeVehicleId ? (
        <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">You have no vehicles yet.</p>
      ) : (
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`blank-${i}`} />;
              const key = toDateKey(date);
              const status = statusByDate[key] ?? "available";
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleDayClick(date)}
                  disabled={!canEdit || status === "booked" || status === "maintenance"}
                  className={cn("flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors", STATUS_STYLES[status])}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border bg-card" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-amber-300 bg-amber-100" /> Blocked by you</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-destructive/30 bg-destructive/10" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-violet-300 bg-violet-100" /> Maintenance</span>
          </div>
        </div>
      )}
    </HomePageWrapper>
  );
}
