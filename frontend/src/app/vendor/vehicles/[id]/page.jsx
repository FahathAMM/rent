"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car, Users, Fuel, Settings2, Pencil, ImageOff, MapPin, Wallet, Home } from "lucide-react";

function Detail({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function Money({ label, value, format }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-0"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-semibold">{format(value)}</span></div>;
}

export default function VendorVehicleViewPage() {
  const { id } = useParams();
  const { format } = useCurrencyFormat();
  const { can } = useAuthStore();
  const { data: vehicle, isLoading, isError } = useQuery({
    queryKey: ["vendor-vehicle", id],
    queryFn: () => vehicleService.getOne(id).then((r) => r.data.data),
    enabled: !!id,
    retry: false,
  });
  const primaryImage = vehicle?.images?.find((image) => image.is_primary) ?? vehicle?.images?.[0];
  const galleryImages = (vehicle?.images ?? []).filter((image) => image.id !== primaryImage?.id).slice(0, 2);

  const breadcrumb = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Vehicles", href: "/vendor/vehicles" },
    { label: vehicle?.title ?? "Vehicle details" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumb} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading vehicle details…</div>
      ) : isError || !vehicle ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Car className="h-9 w-9 text-muted-foreground/50" />
          <h1 className="text-lg font-semibold">Vehicle not found</h1>
          <p className="text-sm text-muted-foreground">It may have been removed or belong to another shop.</p>
          <Button asChild variant="outline"><Link href="/vendor/vehicles"><ArrowLeft className="mr-2 h-4 w-4" /> Back to vehicles</Link></Button>
        </div>
      ) : (
        <>
          <header className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Car className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{vehicle.title}</h1>
                  <StatusBadge status={vehicle.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{[vehicle.make, vehicle.model, vehicle.variant, vehicle.year].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline"><Link href="/vendor/vehicles"><ArrowLeft className="mr-2 h-4 w-4" /> Vehicles</Link></Button>
              {can("vendor-vehicles-list-edit") && <Button asChild><Link href={`/vendor/vehicles/${vehicle.id}/edit`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link></Button>}
            </div>
          </header>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
            <section className="space-y-5">
              {primaryImage ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="group relative min-h-64 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={primaryImage.url} alt={primaryImage.alt_text || vehicle.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-14 text-white">
                      <span className="rounded-full border border-white/30 bg-black/20 px-2.5 py-1 text-xs font-medium backdrop-blur">{vehicle.images.length} photo{vehicle.images.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  {galleryImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                      {galleryImages.map((image) => <div key={image.id} className="relative min-h-28 overflow-hidden rounded-xl bg-muted sm:min-h-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={image.alt_text || vehicle.title} className="absolute inset-0 h-full w-full object-cover" /></div>)}
                    </div>
                  ) : <div className="hidden items-center justify-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground sm:flex"><ImageOff className="h-6 w-6" /></div>}
                </div>
              ) : (
                <div className="flex aspect-[16/7] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/30 text-muted-foreground"><ImageOff className="h-8 w-8" /><p className="text-sm">No vehicle photos yet</p></div>
              )}

              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Vehicle profile</p><h2 className="mt-1 text-lg font-semibold">Specifications & details</h2></div><span className="rounded-full bg-muted px-3 py-1 text-xs capitalize text-muted-foreground">{vehicle.category?.name ?? "Vehicle"}</span></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Category" value={vehicle.category?.name} />
                  <Detail label="Registration number" value={vehicle.registration_number} />
                  <Detail label="Year" value={vehicle.year} />
                  <Detail label="Transmission" value={vehicle.transmission?.replaceAll("_", " ")} />
                  <Detail label="Fuel type" value={vehicle.fuel_type} />
                  <Detail label="Engine" value={vehicle.engine_capacity_cc ? `${vehicle.engine_capacity_cc} cc` : null} />
                  <Detail label="Seats" value={vehicle.seating_capacity} />
                  <Detail label="Luggage" value={vehicle.luggage_capacity} />
                  <Detail label="Doors" value={vehicle.doors} />
                  <Detail label="Air conditioning" value={vehicle.air_conditioned ? "Yes" : "No"} />
                </div>
                {vehicle.description && <div className="mt-5"><h3 className="text-sm font-semibold">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{vehicle.description}</p></div>}
                {vehicle.condition_notes && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-semibold">Condition notes</p><p className="mt-1 whitespace-pre-wrap">{vehicle.condition_notes}</p></div>}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 shadow-sm sm:p-6">
                <div className="mb-3 flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Wallet className="h-4 w-4" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Rental rates</p><h2 className="font-semibold">Pricing</h2></div></div>
                {vehicle.pricing ? (
                  <>
                    <div className="mb-3 rounded-xl border bg-background/80 p-4"><p className="text-xs text-muted-foreground">Daily rate</p><p className="mt-1 text-2xl font-bold tracking-tight">{format(vehicle.pricing.daily_rate)}<span className="ml-1 text-sm font-medium text-muted-foreground">/ day</span></p></div>
                    <Money label="Weekly rate" value={vehicle.pricing.weekly_rate} format={format} />
                    <Money label="Monthly rate" value={vehicle.pricing.monthly_rate} format={format} />
                    <Money label="Security deposit" value={vehicle.pricing.security_deposit} format={format} />
                    <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Deposit method</span><span className="capitalize">{vehicle.pricing.deposit_method?.replaceAll("_", " ") || "—"}</span></div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No pricing configured.</p>}
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marketplace</p><h2 className="mt-1 font-semibold">Listing status</h2></div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Listing</span><StatusBadge status={vehicle.status} /></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Moderation</span><StatusBadge status={vehicle.moderation_status} /></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Bookings</span><span className="font-semibold">{vehicle.booking_count ?? 0}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Views</span><span className="font-semibold">{vehicle.view_count ?? 0}</span></div>
                  {vehicle.moderation_note && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{vehicle.moderation_note}</p>}
                </div>
              </div>

              {vehicle.pickup_locations?.length > 0 && <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="h-4 w-4" /></span><h2 className="font-semibold">Pickup locations</h2></div><ul className="space-y-2">{vehicle.pickup_locations.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span>{item.location?.name ?? item.location?.address ?? "Pickup location"}</span>{item.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Default</span>}</li>)}</ul></div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Rating</p><p className="mt-1 flex items-center gap-1 text-lg font-bold">{Number(vehicle.rating_avg ?? 0).toFixed(1)} <span className="text-sm text-amber-500">★</span></p><p className="text-xs text-muted-foreground">{vehicle.rating_count ?? 0} reviews</p></div>
                <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Specifications</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{vehicle.seating_capacity ?? "—"}</span><span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{vehicle.fuel_type ?? "—"}</span><span className="flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{vehicle.transmission ?? "—"}</span></div></div>
              </div>
            </aside>
          </div>
        </>
      )}
    </HomePageWrapper>
  );
}
