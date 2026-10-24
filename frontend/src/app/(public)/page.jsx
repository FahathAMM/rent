"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";
import {
  Search, Car, ShieldCheck, Clock, Wallet, ArrowRight, MapPin, Building2,
} from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Verified owners & shops" },
  { icon: Wallet, label: "No hidden fees" },
  { icon: Clock, label: "Instant booking requests" },
];

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data: featured } = useQuery({
    queryKey: ["public-vehicles", "featured"],
    queryFn: () => publicService.vehicles({ sort: "relevance", per_page: 8 }).then((r) => r.data.data),
  });

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: shops } = useQuery({
    queryKey: ["public-shops", "teaser"],
    queryFn: () => publicService.shops({ per_page: 6 }).then((r) => r.data.data),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
          <div className="aurora-grain" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <div className="border-border/60 bg-background/80 text-foreground/70 mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium backdrop-blur-sm">
            <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
            Cars, vans and more from trusted local owners
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl lg:text-6xl">
            Rent any vehicle,{" "}
            <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
              anywhere in Sri Lanka
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
            Browse vehicles from independent owners and rental shops, book in minutes, and pick up wherever suits you.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-xl gap-2 rounded-2xl border bg-card p-1.5 shadow-sm">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by make, model or city..."
              className="h-11 border-0 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="lg" className="shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>

          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-primary" /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      {categories?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">Browse by category</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category_id=${c.id}`}
                className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl border bg-card px-6 py-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Car className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured vehicles ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Featured vehicles</h2>
          <Link href="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {featured?.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            No vehicles published yet — check back soon.
          </p>
        )}
      </section>

      {/* ── Browse by location ─────────────────────────────────────────── */}
      {cities?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Browse by location</h2>
            <Link href="/locations" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {cities.slice(0, 8).map((c) => (
              <Link
                key={c.city}
                href={`/search?city=${encodeURIComponent(c.city)}`}
                className="group flex shrink-0 items-center gap-2.5 rounded-2xl border bg-card px-5 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{c.city}</p>
                  <p className="text-xs text-muted-foreground">{c.vehicle_count} vehicles</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Rental companies ───────────────────────────────────────────── */}
      {shops?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Trusted rental companies</h2>
            <Link href="/shops" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/shops/${shop.slug}`}
                className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {shop.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.logo} alt={shop.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <p className="truncate text-xs font-medium">{shop.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 text-center text-xl font-semibold tracking-tight">How it works</h2>
          <HowItWorksSection />
        </div>
      </section>

      {/* ── Owner CTA ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center shadow-sm sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
            <div className="aurora-blob aurora-blob-4" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight">Have a vehicle sitting idle?</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              List it here and start earning from renters near you — verification is quick and payouts are handled for you.
            </p>
            <Button asChild size="lg" className="mt-6 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              <Link href="/account/become-owner">Become an owner <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
