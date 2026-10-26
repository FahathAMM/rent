"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { TrustMarquee } from "@/components/public/TrustMarquee";
import { ShopLogoMarquee } from "@/components/public/ShopLogoMarquee";
import { HeroSlideshow } from "@/components/public/HeroSlideshow";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { getIcon } from "@/lib/iconMap";
import { TILE_COLORS } from "@/lib/tileColors";
import { cn } from "@/lib/utils";
import {
  Search, ShieldCheck, Clock, Wallet, ArrowRight, MapPin, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Verified rental shops" },
  { icon: Wallet, label: "No hidden fees" },
  { icon: Clock, label: "Instant booking requests" },
];

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const newestRailRef = useRef(null);

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  // Only brands someone is actually renting out.
  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
    select: (all) => all.filter((b) => b.vehicles_count > 0),
  });

  const { data: featured } = useQuery({
    queryKey: ["public-vehicles", "featured"],
    queryFn: () => publicService.vehicles({ sort: "relevance", per_page: 8 }).then((r) => r.data),
  });

  // Same catalogue, sorted by published_at instead of relevance — a
  // genuinely different, truthful "New Arrivals" rail rather than a
  // fabricated discount/offer section (the backend has no coupon or
  // discount model at all — see PublicVehicleQuery::search()).
  const { data: newest } = useQuery({
    queryKey: ["public-vehicles", "newest"],
    queryFn: () => publicService.vehicles({ sort: "newest", per_page: 8 }).then((r) => r.data.data),
  });

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: shops } = useQuery({
    queryKey: ["public-shops", "teaser"],
    queryFn: () => publicService.shops({ per_page: 24 }).then((r) => r.data.data),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
  };

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <HeroSlideshow vehicles={featured?.data} />

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 text-center text-white sm:pb-32 sm:pt-28">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-300 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-orange-300" />
            </span>
            Cars, vans and more from verified rental shops
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance drop-shadow-sm sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            Rent any vehicle,{" "}
            <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-violet-300 bg-clip-text text-transparent">
              anywhere in Sri Lanka
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80 text-pretty">
            Browse vehicles from registered rental shops, book in minutes, and pick up wherever suits you.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-xl gap-2 rounded-2xl border bg-card p-1.5 text-foreground shadow-lg">
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

          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-orange-300" /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>


      {/* ── Trust ticker ──────────────────────────────────────────────── */}
      <TrustMarquee />

      {/* ── Categories — icon-forward tiles (no category has a photo today) ── */}
      {categories?.length > 0 && (
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="mb-5 text-xl font-semibold tracking-tight">Browse by category</h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {categories.map((c, i) => {
                const Icon = getIcon(c.icon);
                return (
                  <Link
                    key={c.id}
                    href={`/browse?category_id=${c.id}`}
                    className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                  >
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.name} className="size-16 rounded-2xl object-cover shadow-sm transition-transform group-hover:scale-105" />
                    ) : (
                      <div className={cn("flex size-16 items-center justify-center rounded-2xl text-white shadow-sm transition-transform group-hover:scale-105", TILE_COLORS[i % TILE_COLORS.length])}>
                        <Icon className="h-7 w-7" />
                      </div>
                    )}
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Browse by brand ─────────────────────────────────────────────── */}
      {brands?.length > 0 && (
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 pb-12">
            <h2 className="mb-5 text-xl font-semibold tracking-tight">Browse by brand</h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={`/browse?brand_id=${b.id}`}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                >
                  <BrandMark brand={b} className="size-14 transition-transform group-hover:scale-105" />
                  <span className="w-full truncate text-sm font-semibold">{b.name}</span>
                  <span className="-mt-1.5 text-xs text-muted-foreground">
                    {b.vehicles_count} {b.vehicles_count === 1 ? "vehicle" : "vehicles"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── New arrivals — same catalogue, sorted by newest ──────────────── */}
      {newest?.length > 0 && (
        <ScrollReveal>
          <section className="border-y">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold tracking-tight">New arrivals</h2>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => newestRailRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                    className="flex size-8 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => newestRailRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                    className="flex size-8 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div ref={newestRailRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto no-scrollbar py-2">
                {newest.map((v) => (
                  <div key={v.id} className="relative w-64 shrink-0 snap-start">
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                      New
                    </span>
                    <VehicleCard vehicle={v} className="border-emerald-500/40 hover:border-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Featured vehicles ──────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Featured vehicles</h2>
            <Link href="/browse" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {featured?.data?.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              No vehicles published yet — check back soon.
            </p>
          )}
        </section>
      </ScrollReveal>

      {/* ── Browse by location ─────────────────────────────────────────── */}
      {cities?.length > 0 && (
        <ScrollReveal>
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
                  href={`/browse?city=${encodeURIComponent(c.city)}`}
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
        </ScrollReveal>
      )}

      {/* ── Rental companies — auto-scrolling logo marquee ───────────────── */}
      {shops?.length > 0 && (
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Trusted rental companies</h2>
              <Link href="/shops" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ShopLogoMarquee shops={shops} />
          </section>
        </ScrollReveal>
      )}

      {/* ── How it works ───────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="mb-8 text-center text-xl font-semibold tracking-tight">How it works</h2>
            <HowItWorksSection />
          </div>
        </section>
      </ScrollReveal>

      {/* ── Owner CTA ───────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center shadow-sm sm:px-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
              <div className="aurora-blob aurora-blob-4" />
            </div>
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight">Run a rental business?</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Register your shop and start earning from renters near you — verification is quick and payouts are handled for you.
              </p>
              <Button asChild size="lg" className="mt-6 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                <Link href="/vendor/register">Register your shop <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
