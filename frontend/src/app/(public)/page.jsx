"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { platformDetailService } from "@/services/platformDetailService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { ShopCard } from "@/components/marketplace/ShopCard";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";
import { ScrollReveal } from "@/components/public/ScrollReveal";
import { TrustMarquee } from "@/components/public/TrustMarquee";
import { ShopLogoMarquee } from "@/components/public/ShopLogoMarquee";
import { HeroSlideshow } from "@/components/public/HeroSlideshow";
import { LocationsSection } from "@/components/public/LocationsSection";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { getIcon } from "@/lib/iconMap";
import { TILE_COLORS } from "@/lib/tileColors";
import { cn } from "@/lib/utils";
import {
  Search, ShieldCheck, Clock, Wallet, ArrowRight, MapPin, Sparkles, ChevronLeft, ChevronRight,
  CarFront, Building2, Star, BadgeCheck, MessageCircle, CalendarCheck, Layers, TrendingUp, Banknote,
  Users,
} from "lucide-react";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Verified rental shops" },
  { icon: Wallet, label: "No hidden fees" },
  { icon: Clock, label: "Instant booking requests" },
];

// Only claims the product actually backs: shops are verified by the
// platform, listings are moderated, reviews come from completed bookings,
// and every shop's own policies are shown before booking.
const WHY_POINTS = [
  { icon: BadgeCheck, title: "Verified rental shops", body: "Every company is a registered business, checked by our team before it can list a single vehicle." },
  { icon: ShieldCheck, title: "Moderated listings", body: "Each vehicle is reviewed before it goes live, so what you see is what you'll drive." },
  { icon: Star, title: "Real reviews only", body: "Reviews can only be written after a completed rental — no fake ratings." },
  { icon: Layers, title: "Clear policies upfront", body: "Pickup, return and cancellation terms from each shop, visible before you request a booking." },
  { icon: MessageCircle, title: "Talk to the shop directly", body: "Call or WhatsApp the rental company straight from their page — no middlemen." },
  { icon: CalendarCheck, title: "Book in minutes", body: "Send a request with your dates; the shop confirms and you're ready to go." },
];

const BRAND_GRADIENTS = [
  "from-orange-500 to-pink-500",
  "from-violet-500 to-indigo-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-red-600",
  "from-amber-500 to-orange-600",
];

const BRANDS_PREVIEW = 6;

/**
 * Brands with vehicles first (most first). The preview always fills
 * BRANDS_PREVIEW tiles: if fewer brands have vehicles, it's topped up with
 * active brands that don't yet (logo'd ones first), shown as "Coming soon"
 * and not clickable. "Show all" only ever expands the brands with vehicles.
 */
function BrandsSection({ brands }) {
  const [showAll, setShowAll] = useState(false);
  const byName = (a, b) => a.name.localeCompare(b.name);
  const withVehicles = brands.filter((b) => b.vehicles_count > 0).sort((a, b) => b.vehicles_count - a.vehicles_count || byName(a, b));
  const fillers = brands
    .filter((b) => !b.vehicles_count)
    .sort((a, b) => Number(!!b.logo_url) - Number(!!a.logo_url) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || byName(a, b));
  const max = withVehicles[0]?.vehicles_count || 1;
  const total = withVehicles.reduce((sum, b) => sum + b.vehicles_count, 0);
  const visible = showAll ? withVehicles : [...withVehicles, ...fillers].slice(0, BRANDS_PREVIEW);
  const sorted = withVehicles;

  return (
    <section className="relative isolate overflow-hidden py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-violet-500/[0.04] to-transparent" />
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeader
          eyebrow="Choose your make"
          title="Browse by brand"
          subtitle={`${total} vehicles from ${sorted.length} ${sorted.length === 1 ? "brand" : "brands"} — pick the make you love.`}
          href="/browse"
          linkLabel="Browse all vehicles"
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visible.map((b, i) => {
            const soon = !b.vehicles_count;
            const share = soon ? 0 : Math.max(8, Math.round((b.vehicles_count / max) * 100));
            const gradient = BRAND_GRADIENTS[b.id % BRAND_GRADIENTS.length];
            // "Coming soon" tiles aren't links — browsing them would show nothing.
            const Tile = soon ? "div" : Link;
            return (
              <Tile
                key={b.id}
                {...(soon ? {} : { href: `/browse?brand_id=${b.id}` })}
                className={cn(
                  "group relative flex flex-col items-center overflow-hidden rounded-2xl border bg-card p-5 pt-6 text-center shadow-sm ring-primary/30 transition-all duration-300",
                  soon ? "opacity-75" : "hover:-translate-y-1 hover:border-transparent hover:shadow-xl hover:ring-2"
                )}
              >
                {/* soft glow behind the mark */}
                <span aria-hidden="true" className={cn("absolute left-1/2 top-4 size-20 -translate-x-1/2 rounded-full bg-gradient-to-br opacity-15 blur-2xl transition-opacity group-hover:opacity-30", gradient)} />

                {i === 0 && !showAll && sorted.length > 1 && (
                  <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                    Most popular
                  </span>
                )}

                {b.logo_url ? (
                  <BrandMark brand={b} className="relative size-16 rounded-2xl shadow-md transition-transform duration-300 group-hover:scale-110" />
                ) : (
                  <span className={cn("relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", gradient)}>
                    {b.name?.[0]?.toUpperCase()}
                    <span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/10 to-white/20" />
                  </span>
                )}

                <span className="relative mt-3.5 w-full truncate font-semibold">{b.name}</span>
                {soon ? (
                  <span className="relative mt-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    Coming soon
                  </span>
                ) : (
                  <span className="relative mt-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    {b.vehicles_count} {b.vehicles_count === 1 ? "vehicle" : "vehicles"}
                  </span>
                )}

                {/* share of the catalogue, relative to the biggest brand */}
                <span className="relative mt-4 h-1 w-full overflow-hidden rounded-full bg-muted" title={soon ? undefined : `${Math.round((b.vehicles_count / (total || 1)) * 100)}% of listings`}>
                  <span className={cn("block h-full rounded-full bg-gradient-to-r transition-all duration-700", gradient)} style={{ width: `${share}%` }} />
                </span>

                <span className={cn("relative mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-all duration-300", !soon && "group-hover:opacity-100")}>
                  View vehicles <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Tile>
            );
          })}
        </div>

        {sorted.length > BRANDS_PREVIEW && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" onClick={() => setShowAll((s) => !s)} className="gap-1.5 rounded-full px-6">
              {showAll ? "Show fewer brands" : `Show all ${sorted.length} brands`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function HeroStat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left backdrop-blur-md">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon className="h-4 w-4 text-orange-200" /></div>
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-white/70">{label}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const newestRailRef = useRef(null);

  const { data: brand } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand?.name || "LankaLane";

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  // All active brands — BrandsSection lists the ones with vehicles and tops
  // the preview up with "Coming soon" brands.
  const { data: brands } = useQuery({
    queryKey: ["public-brands"],
    queryFn: () => publicService.brands().then((r) => r.data.data),
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

  const { data: allDistricts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
    staleTime: Infinity,
  });

  // Top rated first (the directory's default sort) — the first three become
  // the spotlight cards, the rest feed the logo marquee.
  const { data: shopsRes } = useQuery({
    queryKey: ["public-shops", "teaser"],
    queryFn: () => publicService.shops({ per_page: 24 }).then((r) => r.data),
  });
  const shops = shopsRes?.data ?? [];

  // Platform-managed hero slides (/platform/hero-slides); empty → the
  // slideshow falls back to vehicle/stock photos and the default headline.
  const { data: heroSlides } = useQuery({
    queryKey: ["public-hero-slides"],
    queryFn: () => publicService.heroSlides().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSlide = heroSlides?.length ? heroSlides[heroIndex % heroSlides.length] : null;

  const districts = Array.from(new Set((cities ?? []).map((c) => c.district).filter(Boolean))).sort();

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (district) params.set("district", district);
    if (category) params.set("category_id", category);
    const qs = params.toString();
    router.push(qs ? `/browse?${qs}` : "/browse");
  };

  const stats = [
    { icon: CarFront, value: featured?.meta?.total ?? "—", label: "Vehicles listed" },
    { icon: Building2, value: shopsRes?.meta?.total ?? "—", label: "Rental companies" },
    { icon: MapPin, value: cities?.length ?? "—", label: "Cities covered" },
  ];

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <HeroSlideshow vehicles={featured?.data} platformSlides={heroSlides} onActiveChange={setHeroIndex} />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 text-center text-white sm:pb-14 sm:pt-12">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-300 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-orange-300" />
            </span>
            Cars, vans and more from verified rental shops
          </div>

          {/* Fixed-height headline area: every slide (and the default headline) gets the same box,
              with long text clamped to two lines, so the hero never changes height as slides rotate. */}
          <div className="flex h-[196px] flex-col items-center justify-center sm:h-[220px] lg:h-[250px]">
          {heroSlide ? (
            // Platform-managed slide: its headline replaces the default one and changes with each slide.
            <div key={heroSlide.id} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <h1 className="mx-auto line-clamp-2 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance drop-shadow-sm sm:text-4xl lg:text-5xl">
                {heroSlide.title}
              </h1>
              {heroSlide.subtitle && (
                <p className="mx-auto mt-3 line-clamp-2 max-w-xl text-base text-white/80 text-pretty sm:text-lg">{heroSlide.subtitle}</p>
              )}
              {heroSlide.link_url && (
                <Button asChild size="lg" className="mt-4 rounded-full bg-white px-6 text-foreground shadow-lg hover:bg-white/90">
                  {heroSlide.link_url.startsWith("/") ? (
                    <Link href={heroSlide.link_url}>{heroSlide.link_label || "Learn more"} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  ) : (
                    <a href={heroSlide.link_url} target="_blank" rel="noopener noreferrer">{heroSlide.link_label || "Learn more"} <ArrowRight className="ml-2 h-4 w-4" /></a>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              <h1 className="line-clamp-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-balance drop-shadow-sm sm:text-4xl lg:text-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                Rent any vehicle,{" "}
                <span className="bg-gradient-to-r from-orange-300 via-pink-300 to-violet-300 bg-clip-text text-transparent">
                  anywhere in Sri Lanka
                </span>
              </h1>
              <p className="mx-auto mt-3 line-clamp-2 max-w-xl text-base text-white/80 text-pretty sm:text-lg">
                Compare vehicles from registered rental shops, book in minutes, and pick up wherever suits you.
              </p>
            </>
          )}
          </div>

          {/* Search card */}
          <form
            onSubmit={handleSearch}
            className="mx-auto mt-4 grid max-w-4xl gap-2 rounded-2xl border border-white/20 bg-card/95 p-2 text-left text-foreground shadow-2xl backdrop-blur-md sm:grid-cols-[1.4fr_1fr_1fr_auto]"
          >
            <label className="flex items-center gap-2.5 rounded-xl px-3 sm:border-r sm:border-border/60">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What</span>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Make, model or keyword"
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </label>
            <div className="rounded-xl px-1 sm:border-r sm:border-border/60">
              <span className="block px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Where</span>
              <Select value={district || "all"} onValueChange={(v) => setDistrict(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Any district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any district</SelectItem>
                  {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl px-1">
              <span className="block px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</span>
              <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 border-0 bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Any vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any vehicle</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="lg" className="h-full min-h-12 shrink-0 rounded-xl bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-7 hover:opacity-90">
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </form>

          {/* Popular category shortcuts */}
          {categories?.length > 0 && (
            <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-white/70">Popular:</span>
              {categories.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  href={`/browse?category_id=${c.id}`}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((s) => <HeroStat key={s.label} {...s} />)}
          </div>

          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
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

      {/* ── Categories ─────────────────────────────────────────────────── */}
      {categories?.length > 0 && (
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 py-16">
            <SectionHeader eyebrow="Find your ride" title="Browse by vehicle type" subtitle="From city cars to vans for the whole family." href="/browse" linkLabel="Browse all" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((c, i) => {
                const Icon = getIcon(c.icon);
                return (
                  <Link
                    key={c.id}
                    href={`/browse?category_id=${c.id}`}
                    className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.name} className="size-16 rounded-2xl object-cover shadow-sm transition-transform group-hover:scale-110" />
                    ) : (
                      <div className={cn("flex size-16 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-110", TILE_COLORS[i % TILE_COLORS.length])}>
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

      {/* ── Featured vehicles ──────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeader eyebrow="Top picks" title="Featured vehicles" subtitle="Highly rated, frequently booked vehicles from our rental partners." href="/browse" />
            {featured?.data?.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed bg-card py-16 text-center text-sm text-muted-foreground">
                No vehicles published yet — check back soon.
              </p>
            )}
          </div>
        </section>
      </ScrollReveal>

      {/* ── New arrivals ───────────────────────────────────────────────── */}
      {newest?.length > 0 && (
        <ScrollReveal>
          <section className="border-y bg-gradient-to-b from-emerald-500/5 to-transparent py-16">
            <div className="mx-auto max-w-6xl px-4">
              <SectionHeader eyebrow="Just listed" title="New arrivals" subtitle="The latest vehicles added by rental shops.">
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => newestRailRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                    className="flex size-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => newestRailRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                    className="flex size-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-muted"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </SectionHeader>
              <div ref={newestRailRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto no-scrollbar py-2">
                {newest.map((v) => (
                  <div key={v.id} className="relative w-64 shrink-0 snap-start">
                    <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                      <Sparkles className="h-3 w-3" /> New
                    </span>
                    <VehicleCard vehicle={v} className="border-emerald-500/40 hover:border-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ── Top rated rental companies ─────────────────────────────────── */}
      {shops.length > 0 && (
        <ScrollReveal>
          <section className="mx-auto max-w-6xl px-4 py-16">
            <SectionHeader eyebrow="Trusted partners" title="Top rated rental companies" subtitle="Verified shops with great reviews and responsive service." href="/shops" linkLabel="All companies" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shops.slice(0, 3).map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
            {shops.length > 3 && (
              <div className="mt-10">
                <ShopLogoMarquee shops={shops} />
              </div>
            )}
          </section>
        </ScrollReveal>
      )}

      {/* ── Browse by location ─────────────────────────────────────────── */}
      {(cities?.length > 0 || allDistricts?.length > 0) && (
        <ScrollReveal>
          <LocationsSection cities={cities} districts={allDistricts} />
        </ScrollReveal>
      )}

      {/* ── Browse by brand ─────────────────────────────────────────────── */}
      {brands?.some((b) => b.vehicles_count > 0) && (
        <ScrollReveal>
          <BrandsSection brands={brands} />
        </ScrollReveal>
      )}

      {/* ── Why us ─────────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeader center eyebrow={`Why ${brandName}`} title="Renting made simple — and safe" subtitle="Everything you need to book with confidence, in one place." />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary transition-colors group-hover:from-orange-500 group-hover:via-pink-500 group-hover:to-violet-500 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="relative isolate overflow-hidden border-y bg-muted/30">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
            <div className="aurora-blob aurora-blob-2" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-16">
            <SectionHeader center eyebrow="Easy as 1-2-3" title="How it works" subtitle="From search to keys in hand." />
            <HowItWorksSection />
          </div>
        </section>
      </ScrollReveal>

      {/* ── Owner CTA ───────────────────────────────────────────────────── */}
      <ScrollReveal>
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 px-6 py-12 text-white shadow-2xl sm:px-12">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-900/30 blur-3xl" aria-hidden="true" />
            <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" aria-hidden="true" />

            <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">For rental businesses</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Grow your rental business with {brandName}</h2>
                <p className="mt-3 max-w-lg text-white/85">
                  List your fleet, take booking requests online and reach customers across Sri Lanka. Verification is quick and payouts are handled for you.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="bg-white text-foreground shadow-lg hover:bg-white/90">
                    <Link href="/vendor/register">Register your shop <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                    <Link href="/how-it-works">How it works</Link>
                  </Button>
                </div>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { icon: TrendingUp, text: "Reach customers searching across the island" },
                  { icon: CalendarCheck, text: "Manage bookings, fleet and calendar in one place" },
                  { icon: Banknote, text: "Automatic earnings tracking and payouts" },
                  { icon: Users, text: "Add your staff with their own logins and permissions" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20"><Icon className="h-4 w-4" /></span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
