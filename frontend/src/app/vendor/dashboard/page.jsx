"use client";

import { useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, CheckCircle2, Clock, Archive } from "lucide-react";
import Link from "next/link";
import { Home } from "lucide-react";

function StatTile({ label, value, icon: Icon, tone }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VendorDashboardPage() {
  const { user } = useAuthStore();

  // No dedicated /vendor/dashboard endpoint exists yet (Phase 6) — these
  // tiles derive from the real vehicle list, which is already live.
  const { data } = useQuery({
    queryKey: ["vendor-dashboard-vehicles"],
    queryFn: () => vehicleService.getAll({ perPage: 1 }).then((r) => r.data.record),
  });

  const { data: published } = useQuery({
    queryKey: ["vendor-dashboard-vehicles", "published"],
    queryFn: () => vehicleService.getAll({ perPage: 1, status: "published" }).then((r) => r.data.record),
  });

  const { data: draft } = useQuery({
    queryKey: ["vendor-dashboard-vehicles", "draft"],
    queryFn: () => vehicleService.getAll({ perPage: 1, status: "draft" }).then((r) => r.data.record),
  });

  const { data: archived } = useQuery({
    queryKey: ["vendor-dashboard-vehicles", "archived"],
    queryFn: () => vehicleService.getAll({ perPage: 1, status: "archived" }).then((r) => r.data.record),
  });

  const breadcrumbItems = [{ label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> }];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your vehicles.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total Vehicles" value={data?.total ?? "—"} icon={Car} tone="bg-blue-100 text-blue-700" />
          <StatTile label="Published" value={published?.total ?? "—"} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
          <StatTile label="Draft / Pending" value={draft?.total ?? "—"} icon={Clock} tone="bg-amber-100 text-amber-700" />
          <StatTile label="Archived" value={archived?.total ?? "—"} icon={Archive} tone="bg-slate-100 text-slate-700" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Manage your fleet from <Link href="/vendor/vehicles" className="text-primary font-medium hover:underline">Vehicles</Link> —
              add a listing, set its pricing, then publish it once it&apos;s approved.
            </p>
            <p>
              Booking requests, finance and staff management are coming in a later phase —
              this dashboard will grow alongside them.
            </p>
          </CardContent>
        </Card>
      </div>
    </HomePageWrapper>
  );
}
