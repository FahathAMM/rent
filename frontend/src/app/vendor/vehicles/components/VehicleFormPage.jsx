"use client";

import Link from "next/link";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft, Home, Car, ClipboardList, Images, DollarSign, UploadCloud, ShieldCheck } from "lucide-react";

const STEPS = [
  { icon: ClipboardList, title: "Vehicle details", body: "Identity, specs and a short description customers will read." },
  { icon: DollarSign, title: "Set pricing", body: "Optional here — but a daily rate is required before the vehicle can be booked." },
  { icon: Images, title: "Add photos", body: "Optional here too. Listings with good photos get far more bookings; the first one is the cover." },
  { icon: UploadCloud, title: "Publish", body: "Publish when ready — the listing goes live once our team approves it." },
];

/** Page chrome shared by /vendor/vehicles/new and /vendor/vehicles/[id]/edit - header, form card and a next-steps panel. */
export function VehicleFormPage({ title, subtitle, vehicle, children }) {
  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Vehicles", href: "/vendor/vehicles" },
    { label: title },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Car className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Link href="/vendor/vehicles" className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground sm:self-auto">
          <ArrowLeft className="h-4 w-4" /> Back to vehicles
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px] xl:items-start">
        <div className="min-w-0">{children}</div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          {vehicle && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listing status</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={vehicle.status} /></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Moderation</span><StatusBadge status={vehicle.moderation_status} /></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Bookings</span><span className="font-medium">{vehicle.booking_count ?? 0}</span></div>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Getting a listing live</p>
            <ol className="space-y-3">
              {STEPS.map(({ icon: Icon, title: stepTitle, body }, i) => (
                <li key={stepTitle} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                  <div>
                    <p className="text-sm font-medium">{i + 1}. {stepTitle}</p>
                    <p className="text-xs text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Registration number and condition notes are never shown to customers.
          </div>
        </aside>
      </div>
    </HomePageWrapper>
  );
}
