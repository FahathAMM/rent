"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Star, MapPin, Phone, Globe, Loader2, ArrowLeft, Building2, CheckCircle2,
} from "lucide-react";

export default function ShopProfilePage() {
  const { slug } = useParams();

  const { data: shop, isLoading } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: () => publicService.shop(slug).then((r) => r.data.data),
  });

  const { data: vehicles } = useQuery({
    queryKey: ["public-shop-vehicles", slug],
    queryFn: () => publicService.shopVehicles(slug).then((r) => r.data.data),
    enabled: !!shop,
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!shop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Rental company not found</p>
        <Button asChild variant="outline"><Link href="/shops">Back to companies</Link></Button>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <Link href="/shops" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to companies
          </Link>
        </div>
      </div>

      <section className="relative isolate overflow-hidden border-b">
        {shop.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-background/70" aria-hidden="true" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-12 text-center">
          {shop.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo} alt={shop.name} className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-md" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-card shadow-md">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{shop.name}</h1>
            {shop.is_verified && <ShieldCheck className="h-5 w-5 text-emerald-600" />}
          </div>
          {shop.tagline && <p className="max-w-lg text-muted-foreground">{shop.tagline}</p>}

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {shop.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{shop.city}</span>}
            {Number(shop.rating_avg) > 0 && (
              <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{Number(shop.rating_avg).toFixed(1)} ({shop.rating_count})</span>
            )}
            {shop.completed_bookings_count > 0 && (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{shop.completed_bookings_count} completed rentals</span>
            )}
          </div>

          {(shop.phone || shop.website) && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {shop.phone && <a href={`tel:${shop.phone}`} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 hover:bg-muted"><Phone className="h-3.5 w-3.5" />{shop.phone}</a>}
              {shop.website && <a href={shop.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 hover:bg-muted"><Globe className="h-3.5 w-3.5" />Website</a>}
            </div>
          )}
        </div>
      </section>

      {shop.description && (
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{shop.description}</p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-5 text-xl font-semibold tracking-tight">Vehicles from {shop.name}</h2>
        {vehicles?.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No vehicles published by this company yet.
          </p>
        )}
      </div>
    </div>
  );
}
