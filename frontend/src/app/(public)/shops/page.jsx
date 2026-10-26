"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { publicService } from "@/services/publicService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search as SearchIcon, ShieldCheck, Star, Loader2, Building2, MapPin, Sparkles, CarFront,
  Truck, Phone, MessageCircle, LayoutGrid, List, X, ChevronLeft, ChevronRight, Clock,
  CalendarCheck, Zap, ArrowRight, SlidersHorizontal,
} from "lucide-react";

const PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: "rating", label: "Top rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "bookings", label: "Most trips" },
  { value: "fleet", label: "Largest fleet" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A–Z" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4.0+" },
  { value: "4.5", label: "4.5+" },
];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Open/closed right now from RentalShop.operating_hours ({ mon: { open, close, closed } ... }), or null when unknown. */
function openStatus(hours) {
  if (!hours) return null;
  const now = new Date();
  const today = hours[DAY_KEYS[now.getDay()]];
  if (!today) return null;
  if (today.closed || !today.open || !today.close) return { open: false, label: "Closed today" };
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm < today.open) return { open: false, label: `Opens ${today.open}` };
  if (hhmm >= today.close) return { open: false, label: "Closed now" };
  return { open: true, label: `Open until ${today.close}` };
}

function whatsappHref(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`;
}

export default function ShopsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ShopsPageContent />
    </Suspense>
  );
}

function Pill({ active, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm"
          : "border-input bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function ShopLogo({ shop, size = "md" }) {
  const box = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  return shop.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={shop.logo} alt={shop.name} className={cn(box, "rounded-2xl border-4 border-card bg-card object-cover shadow-md")} />
  ) : (
    <div className={cn(box, "flex items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xl font-bold text-white shadow-md")}>
      {shop.name?.charAt(0)?.toUpperCase() ?? <Building2 className="h-6 w-6" />}
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-2 py-2 text-center">
      <p className="flex items-center justify-center gap-1 text-sm font-semibold"><Icon className="h-3.5 w-3.5 text-primary" />{value}</p>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function ContactActions({ shop, compact }) {
  const wa = whatsappHref(shop.whatsapp);
  return (
    <div className="flex items-center gap-2">
      {shop.phone && (
        <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0" title={`Call ${shop.phone}`}>
          <a href={`tel:${shop.phone}`} aria-label={`Call ${shop.name}`}><Phone className="h-4 w-4" /></a>
        </Button>
      )}
      {wa && (
        <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0 text-emerald-600 hover:text-emerald-700" title="Chat on WhatsApp">
          <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${shop.name}`}><MessageCircle className="h-4 w-4" /></a>
        </Button>
      )}
      <Button asChild size="sm" className={cn("h-9 gap-1 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90", compact ? "" : "flex-1")}>
        <Link href={`/shops/${shop.slug}`}>View fleet <ArrowRight className="h-3.5 w-3.5" /></Link>
      </Button>
    </div>
  );
}

function CategoryChips({ categories, max = 3 }) {
  if (!categories?.length) return null;
  const extra = categories.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.slice(0, max).map((c) => (
        <span key={c} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{c}</span>
      ))}
      {extra > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">+{extra} more</span>}
    </div>
  );
}

function Cover({ shop, className }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {shop.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.cover_image} alt="" aria-hidden="true" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-orange-500/25 via-pink-500/20 to-violet-500/25" aria-hidden="true">
          <CarFront className="absolute -bottom-4 -right-3 h-24 w-24 rotate-[-8deg] text-white/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" aria-hidden="true" />
    </div>
  );
}

function StatusBadges({ shop }) {
  const status = openStatus(shop.operating_hours);
  return (
    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
      {shop.is_verified && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <ShieldCheck className="h-3 w-3" /> Verified
        </span>
      )}
      {status && (
        <span className={cn(
          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm",
          status.open ? "bg-white/90 text-emerald-700" : "bg-black/50 text-white"
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.open ? "bg-emerald-500" : "bg-white/70")} />
          {status.label}
        </span>
      )}
    </div>
  );
}

function RatingLine({ shop }) {
  const rating = Number(shop.rating_avg);
  if (!(rating > 0)) return <span className="text-xs text-muted-foreground">New on the marketplace</span>;
  return (
    <span className="flex items-center gap-1 text-xs">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">({shop.rating_count ?? 0} reviews)</span>
    </span>
  );
}

function FromPrice({ shop }) {
  const { format } = useCurrencyFormat();
  if (shop.starting_daily_rate == null) return null;
  return (
    <p className="text-right leading-tight">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">From</span>
      <span className="text-sm font-bold">{format ? format(shop.starting_daily_rate) : `LKR ${shop.starting_daily_rate}`}</span>
      <span className="text-[10px] text-muted-foreground">/day</span>
    </p>
  );
}

function ShopCard({ shop }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl">
      <Link href={`/shops/${shop.slug}`} className="relative block" aria-label={shop.name}>
        <Cover shop={shop} className="h-32" />
        <StatusBadges shop={shop} />
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="relative z-10 -mt-8 flex items-end justify-between gap-3">
          <ShopLogo shop={shop} />
          <FromPrice shop={shop} />
        </div>

        <div className="space-y-1">
          <Link href={`/shops/${shop.slug}`} className="block truncate font-semibold hover:text-primary">{shop.name}</Link>
          {shop.tagline && <p className="line-clamp-1 text-xs text-muted-foreground">{shop.tagline}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
            <RatingLine shop={shop} />
            {shop.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />{shop.city}{shop.district && shop.district !== shop.city ? `, ${shop.district}` : ""}
              </span>
            )}
          </div>
        </div>

        <CategoryChips categories={shop.categories} />

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={CarFront} value={shop.vehicles_count ?? 0} label="Vehicles" />
          <Stat icon={CalendarCheck} value={shop.completed_bookings_count ?? 0} label="Trips" />
          <Stat icon={Zap} value={shop.response_rate != null ? `${Math.round(shop.response_rate)}%` : "—"} label="Response" />
        </div>

        <div className="mt-auto pt-1">
          <ContactActions shop={shop} />
        </div>
      </div>
    </div>
  );
}

function ShopRow({ shop }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:shadow-xl sm:flex-row">
      <Link href={`/shops/${shop.slug}`} className="relative block sm:w-64 sm:shrink-0" aria-label={shop.name}>
        <Cover shop={shop} className="h-36 sm:h-full" />
        <StatusBadges shop={shop} />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 gap-4">
          <ShopLogo shop={shop} />
          <div className="min-w-0 space-y-1.5">
            <Link href={`/shops/${shop.slug}`} className="block truncate text-lg font-semibold hover:text-primary">{shop.name}</Link>
            {shop.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{shop.tagline}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <RatingLine shop={shop} />
              {shop.city && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{shop.city}</span>}
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><CarFront className="h-3.5 w-3.5" />{shop.vehicles_count ?? 0} vehicles</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarCheck className="h-3.5 w-3.5" />{shop.completed_bookings_count ?? 0} trips</span>
            </div>
            <CategoryChips categories={shop.categories} max={5} />
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
          <FromPrice shop={shop} />
          <ContactActions shop={shop} compact />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid({ view }) {
  return (
    <div className={view === "list" ? "space-y-4" : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
          <div className="h-32 bg-muted" />
          <div className="space-y-3 p-4">
            <div className="-mt-10 h-16 w-16 rounded-2xl border-4 border-card bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 rounded-xl bg-muted" /><div className="h-10 rounded-xl bg-muted" /><div className="h-10 rounded-xl bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: page, last_page: last } = meta;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, last])).filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button
            variant={p === page ? "default" : "outline"}
            size="icon"
            className={cn("h-9 w-9", p === page && "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90")}
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        </span>
      ))}
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= last} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

function ShopsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [view, setView] = useState("grid");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => { setQ(params.get("q") ?? ""); }, [params]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("shops-view");
      if (saved === "list" || saved === "grid") setView(saved);
    } catch {}
  }, []);

  const changeView = (v) => {
    setView(v);
    try { localStorage.setItem("shops-view", v); } catch {}
  };

  const filters = {
    q: params.get("q") ?? undefined,
    city: params.get("city") ?? undefined,
    district: params.get("district") ?? undefined,
    category_id: params.get("category_id") ?? undefined,
    verified_only: params.get("verified_only") ?? undefined,
    delivery: params.get("delivery") ?? undefined,
    rating_min: params.get("rating_min") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    per_page: PER_PAGE,
  };

  const { data: cities } = useQuery({
    queryKey: ["public-locations"],
    queryFn: () => publicService.locations().then((r) => r.data.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["public-shops", filters],
    queryFn: () => publicService.shops(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const districts = Array.from(new Set((cities ?? []).map((c) => c.district).filter(Boolean))).sort();
  const selectedDistrict = params.get("district") ?? "";
  const visibleCities = (cities ?? []).filter((c) => !selectedDistrict || c.district === selectedDistrict);

  const pushParams = (next) => {
    next.delete("page");
    router.push(`/shops?${next.toString()}`, { scroll: false });
  };

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  };

  const toggleParam = (key) => setParam(key, params.get(key) ? "" : "1");

  const setDistrict = (value) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("district", value);
    else next.delete("district");
    next.delete("city");
    pushParams(next);
  };

  const setPage = (page) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    router.push(`/shops?${next.toString()}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setParam("q", q.trim());
  };

  const clearAll = () => {
    setQ("");
    router.push("/shops", { scroll: false });
  };

  const categoryName = categories?.find((c) => String(c.id) === params.get("category_id"))?.name;
  const activeChips = [
    params.get("q") && { key: "q", label: `"${params.get("q")}"` },
    params.get("district") && { key: "district", label: params.get("district") },
    params.get("city") && { key: "city", label: params.get("city") },
    categoryName && { key: "category_id", label: categoryName },
    params.get("verified_only") && { key: "verified_only", label: "Verified only" },
    params.get("delivery") && { key: "delivery", label: "Delivers to you" },
    params.get("rating_min") && { key: "rating_min", label: `${params.get("rating_min")}+ stars` },
  ].filter(Boolean);

  const shops = data?.data ?? [];
  const total = data?.meta?.total ?? shops.length;

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {data?.meta ? `${data.meta.total} rental companies` : "Trusted rental companies"} across Sri Lanka
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Find a{" "}
            <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">rental company</span>
            {" "}you can trust
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Compare registered rental shops by rating, fleet size and price. Every listing is reviewed before it goes live.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-7 flex max-w-2xl flex-col gap-2 rounded-2xl border bg-card/90 p-2 shadow-lg backdrop-blur-sm sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Company name, tagline or city..."
                className="h-11 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
              />
            </div>
            <Select value={params.get("district") || "all"} onValueChange={(v) => setDistrict(v === "all" ? "" : v)}>
              <SelectTrigger className="h-11 w-full bg-muted/40 sm:w-44">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" size="lg" className="h-11 shrink-0 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
              Search
            </Button>
          </form>

          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" />Verified businesses</span>
            <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />Real customer reviews</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" />{cities?.length ?? 0} cities covered</span>
          </div>
        </div>
      </section>

      {/* ── Category quick filters ────────────────────────────────────── */}
      {categories?.length > 0 && (
        <div className="border-b bg-muted/20">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            <Pill active={!params.get("category_id")} onClick={() => setParam("category_id", "")}>All vehicle types</Pill>
            {categories.map((c) => (
              <Pill key={c.id} active={params.get("category_id") === String(c.id)} onClick={() => setParam("category_id", String(c.id))}>
                {c.name}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Pill active={!!params.get("verified_only")} onClick={() => toggleParam("verified_only")}>
              <ShieldCheck className="h-3.5 w-3.5" /> Verified only
            </Pill>
            <Pill active={!!params.get("delivery")} onClick={() => toggleParam("delivery")}>
              <Truck className="h-3.5 w-3.5" /> Offers delivery
            </Pill>
            {RATING_OPTIONS.slice(1).map((r) => (
              <Pill key={r.value} active={params.get("rating_min") === r.value} onClick={() => setParam("rating_min", params.get("rating_min") === r.value ? "" : r.value)}>
                <Star className="h-3.5 w-3.5" /> {r.label}
              </Pill>
            ))}
            <Pill active={showMore || !!params.get("city")} onClick={() => setShowMore((s) => !s)}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> More
            </Pill>
          </div>

          <div className="flex items-center gap-2">
            <Select value={params.get("sort") ?? "rating"} onValueChange={(v) => setParam("sort", v === "rating" ? "" : v)}>
              <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border bg-card p-0.5">
              {[{ v: "grid", icon: LayoutGrid, label: "Grid view" }, { v: "list", icon: List, label: "List view" }].map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  aria-label={label}
                  aria-pressed={view === v}
                  className={cn("rounded-md p-1.5 transition-colors", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {(showMore || params.get("city")) && (
          <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />City{selectedDistrict && <span className="font-normal text-muted-foreground">in {selectedDistrict}</span>}</p>
            <div className="flex flex-wrap gap-2">
              <Pill active={!params.get("city")} onClick={() => setParam("city", "")}>All cities</Pill>
              {visibleCities.map((c) => (
                <Pill key={`${c.district}-${c.city}`} active={params.get("city") === c.city} onClick={() => setParam("city", c.city)}>
                  {c.city}
                  {c.vehicle_count != null && <span className="opacity-70">{c.vehicle_count}</span>}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* ── Result summary + active filters ─────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <p className="mr-1 flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading ? "Searching..." : `${total} ${total === 1 ? "company" : "companies"} found`}
            {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </p>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => (chip.key === "district" ? setDistrict("") : setParam(chip.key, ""))}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              {chip.label} <X className="h-3 w-3" />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button type="button" onClick={clearAll} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              Clear all
            </button>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <SkeletonGrid view={view} />
        ) : shops.length ? (
          <div className={cn("transition-opacity", isFetching && "opacity-60")}>
            {view === "list" ? (
              <div className="space-y-4">{shops.map((shop) => <ShopRow key={shop.id} shop={shop} />)}</div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}</div>
            )}
            <Pagination meta={data?.meta} onPage={setPage} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium">No rental companies match your search</p>
            <p className="text-sm text-muted-foreground">Try another district, vehicle type or clear a filter.</p>
            <Button variant="outline" onClick={clearAll}>Clear filters</Button>
          </div>
        )}

        {/* ── Vendor CTA ──────────────────────────────────────────────── */}
        <section className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 p-8 text-white shadow-xl sm:p-10">
          <Building2 className="absolute -right-6 -top-6 h-40 w-40 rotate-12 text-white/10" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <h2 className="text-2xl font-semibold tracking-tight">Run a rental business?</h2>
              <p className="mt-1.5 text-sm text-white/85">
                List your fleet, take bookings online and reach customers across Sri Lanka. Registration takes only a few minutes.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-white/80"><Clock className="h-3.5 w-3.5" />Listings are reviewed before they go live</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="shrink-0 gap-1.5 bg-white text-foreground hover:bg-white/90">
              <Link href="/vendor/register">List your shop <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
