"use client";

import { useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ShieldCheck, Star, MapPin, Phone, Globe, Loader2, ArrowLeft, Building2, CarFront, CalendarCheck,
  Zap, MessageCircle, Share2, Navigation, Clock, ScrollText, Quote,
  BadgeCheck, ChevronDown, CalendarDays, Tag,
} from "lucide-react";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];
const JS_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const TABS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "about", label: "About" },
  { id: "reviews", label: "Reviews" },
  { id: "policies", label: "Policies" },
];

function todayKey() {
  return JS_DAY_KEYS[new Date().getDay()];
}

/** Open/closed right now from operating_hours ({ mon: { open, close, closed } ... }), or null when unknown. */
function openStatus(hours) {
  const today = hours?.[todayKey()];
  if (!today) return null;
  if (today.closed || !today.open || !today.close) return { open: false, label: "Closed today" };
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm < today.open) return { open: false, label: `Opens at ${today.open}` };
  if (hhmm >= today.close) return { open: false, label: "Closed now" };
  return { open: true, label: `Open until ${today.close}` };
}

function whatsappHref(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`;
}

function mapsHref(shop) {
  if (shop.latitude && shop.longitude) return `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
  const place = [shop.city, shop.district, "Sri Lanka"].filter(Boolean).join(", ");
  return shop.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name}, ${place}`)}` : null;
}

function Stars({ value, className = "h-4 w-4" }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(className, i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25")} />
      ))}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatBox({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function ShopProfilePage() {
  const { slug } = useParams();
  const { format } = useCurrencyFormat();

  const { data: shop, isLoading } = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: () => publicService.shop(slug).then((r) => r.data.data),
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!shop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted"><Building2 className="h-7 w-7 text-muted-foreground" /></div>
        <p className="text-lg font-semibold">Rental company not found</p>
        <Button asChild variant="outline"><Link href="/shops">Back to companies</Link></Button>
      </div>
    );
  }

  const rating = Number(shop.rating_avg);
  const status = openStatus(shop.operating_hours);
  const wa = whatsappHref(shop.whatsapp);
  const maps = mapsHref(shop);
  const price = (v) => (format ? format(v) : `LKR ${v}`);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: shop.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  };

  return (
    <div className="pb-16">
      {/* ── Cover ──────────────────────────────────────────────────────── */}
      <section className="relative h-56 overflow-hidden sm:h-72 lg:h-80">
        {shop.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.cover_image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        ) : (
          <div className="relative h-full w-full bg-gradient-to-br from-orange-500/30 via-pink-500/25 to-violet-500/30" aria-hidden="true">
            <div className="aurora-blob aurora-blob-1" />
            <div className="aurora-blob aurora-blob-3" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <Link href="/shops" className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-black/55">
              <ArrowLeft className="h-4 w-4" /> All companies
            </Link>
          </div>
        </div>
      </section>

      {/* ── Identity card ─────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4">
        <div className="rounded-3xl border bg-card p-5 shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {shop.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo} alt={shop.name} className="-mt-16 h-28 w-28 shrink-0 rounded-3xl border-4 border-card bg-card object-cover shadow-lg sm:-mt-20" />
              ) : (
                <div className="-mt-16 flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl border-4 border-card bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-4xl font-bold text-white shadow-lg sm:-mt-20">
                  {shop.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{shop.name}</h1>
                  {shop.is_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>
                {shop.tagline && <p className="text-muted-foreground">{shop.tagline}</p>}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  {rating > 0 ? (
                    <a href="#reviews" className="flex items-center gap-1.5 hover:text-foreground">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">{rating.toFixed(1)}</span> ({shop.rating_count} reviews)
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5"><Star className="h-4 w-4" />New on the marketplace</span>
                  )}
                  {shop.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{shop.city}{shop.district && shop.district !== shop.city ? `, ${shop.district}` : ""}</span>}
                  {status && (
                    <span className={cn("flex items-center gap-1.5", status.open ? "text-emerald-600" : "")}>
                      <span className={cn("h-2 w-2 rounded-full", status.open ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                      {status.label}
                    </span>
                  )}
                  {shop.member_since && (
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Since {new Date(shop.member_since).getFullYear()}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              {shop.phone && (
                <Button asChild className="gap-1.5 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                  <a href={`tel:${shop.phone}`}><Phone className="h-4 w-4" />Call</a>
                </Button>
              )}
              {wa && (
                <Button asChild variant="outline" className="gap-1.5 text-emerald-600 hover:text-emerald-700">
                  <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                </Button>
              )}
              {shop.website && (
                <Button asChild variant="outline" size="icon" title="Website">
                  <a href={shop.website} target="_blank" rel="noopener noreferrer" aria-label="Website"><Globe className="h-4 w-4" /></a>
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={share} title="Share" aria-label="Share"><Share2 className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBox icon={CarFront} value={shop.vehicles_count ?? 0} label="Vehicles available" />
            <StatBox icon={CalendarCheck} value={shop.completed_bookings_count ?? 0} label="Completed rentals" />
            <StatBox icon={Zap} value={shop.response_rate != null ? `${Math.round(shop.response_rate)}%` : "—"} label="Response rate" />
            <StatBox icon={Tag} value={shop.starting_daily_rate != null ? price(shop.starting_daily_rate) : "—"} label="Starting price / day" />
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-14 z-20 mt-6 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto mt-8 grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-14">
          <VehiclesSection slug={slug} shop={shop} />
          <AboutSection shop={shop} />
          <ReviewsSection slug={slug} shop={shop} />
          <PoliciesSection shop={shop} />
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-primary" />Opening hours</p>
            {shop.operating_hours ? (
              <ul className="space-y-1.5 text-sm">
                {DAYS.map(({ key, label }) => {
                  const d = shop.operating_hours[key];
                  const isToday = key === todayKey();
                  return (
                    <li key={key} className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5", isToday && "bg-primary/10 font-medium text-primary")}>
                      <span>{label}{isToday && <span className="ml-1.5 text-[10px] uppercase tracking-wide">Today</span>}</span>
                      <span className={cn(!isToday && "text-muted-foreground")}>{!d || d.closed ? "Closed" : `${d.open} – ${d.close}`}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Contact the shop for opening hours.</p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-primary" />Location & contact</p>
            <div className="space-y-3 text-sm">
              {shop.city && (
                <p className="text-muted-foreground">{[shop.city, shop.district].filter((v, i, a) => v && a.indexOf(v) === i).join(", ")}, Sri Lanka</p>
              )}
              {shop.phone && <a href={`tel:${shop.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" />{shop.phone}</a>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle className="h-4 w-4 text-muted-foreground" />{shop.whatsapp}</a>}
              {shop.website && <a href={shop.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:text-primary"><Globe className="h-4 w-4 shrink-0 text-muted-foreground" />{shop.website.replace(/^https?:\/\//, "")}</a>}
              {maps && (
                <Button asChild variant="outline" className="mt-1 w-full gap-1.5">
                  <a href={maps} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4" />Get directions</a>
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 p-5 text-white shadow-lg">
            <BadgeCheck className="mb-2 h-6 w-6" />
            <p className="font-semibold">Book with confidence</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/90">
              <li>• Every listing is reviewed before it goes live</li>
              <li>• Reviews come only from completed rentals</li>
              <li>• Clear pickup, return and cancellation terms</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function VehiclesSection({ slug, shop }) {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });
  // Only offer the vehicle types this shop actually rents out.
  const shopCategories = (categories ?? []).filter((c) => shop.categories?.includes(c.name));

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["public-shop-vehicles", slug, category, sort],
    queryFn: ({ pageParam }) => publicService.shopVehicles(slug, { page: pageParam, per_page: 9, category_id: category || undefined, sort }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });

  const vehicles = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.meta?.total;

  return (
    <section id="vehicles" className="scroll-mt-36">
      <SectionTitle icon={CarFront} title={`Vehicles${total != null ? ` (${total})` : ""}`}>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Most relevant</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </SectionTitle>

      {shopCategories.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {[{ id: "", name: "All" }, ...shopCategories].map((c) => {
            const active = String(c.id) === category;
            return (
              <button
                key={c.id || "all"}
                type="button"
                onClick={() => setCategory(String(c.id))}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active ? "border-transparent bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm" : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border bg-card">
              <div className="aspect-[4/3] bg-muted" />
              <div className="space-y-2 p-3"><div className="h-4 w-3/4 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div>
            </div>
          ))}
        </div>
      ) : vehicles.length ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-1.5">
                {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                Show more vehicles
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-center">
          <CarFront className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No vehicles published by this company yet.</p>
        </div>
      )}
    </section>
  );
}

function AboutSection({ shop }) {
  return (
    <section id="about" className="scroll-mt-36">
      <SectionTitle icon={Building2} title={`About ${shop.name}`} />
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {shop.description ? (
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{shop.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">This company hasn&apos;t added a description yet.</p>
        )}
        {shop.categories?.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle types</p>
            <div className="flex flex-wrap gap-2">
              {shop.categories.map((c) => <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{c}</span>)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewsSection({ slug, shop }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["public-shop-reviews", slug],
    queryFn: ({ pageParam }) => publicService.shopReviews(slug, { page: pageParam }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  });

  const reviews = data?.pages.flatMap((p) => p.data) ?? [];
  const meta = data?.pages[0]?.meta;
  const total = meta?.total ?? 0;
  const rating = Number(shop.rating_avg);

  return (
    <section id="reviews" className="scroll-mt-36">
      <SectionTitle icon={Star} title="Customer reviews" />

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-14 text-center">
          <Quote className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No reviews yet</p>
          <p className="text-sm text-muted-foreground">Reviews appear here after customers complete a rental.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-6 rounded-2xl border bg-card p-6 shadow-sm sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="text-center sm:border-r sm:pr-6">
              <p className="text-5xl font-bold tracking-tight">{rating > 0 ? rating.toFixed(1) : "—"}</p>
              <div className="mt-2 flex justify-center"><Stars value={rating} /></div>
              <p className="mt-1.5 text-xs text-muted-foreground">{total} review{total !== 1 ? "s" : ""}</p>
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((r) => {
                const count = meta.distribution?.[r] ?? 0;
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={r} className="flex items-center gap-3 text-xs">
                    <span className="flex w-8 items-center gap-0.5 text-muted-foreground">{r}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <article key={r.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-sm font-semibold text-white">
                      {r.reviewer_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.reviewer_name ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                  <Stars value={r.rating} className="h-3.5 w-3.5" />
                </div>
                {r.title && <p className="text-sm font-medium">{r.title}</p>}
                {r.comment && <p className="text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                  {r.is_verified_booking && (
                    <span className="flex items-center gap-1 text-emerald-600"><BadgeCheck className="h-3.5 w-3.5" />Verified rental</span>
                  )}
                  {r.vehicle && (
                    <Link href={`/vehicles/${r.vehicle.slug}`} className="truncate text-muted-foreground hover:text-primary">· {r.vehicle.title}</Link>
                  )}
                </div>
                {r.owner_reply && (
                  <div className="rounded-xl bg-muted/60 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold">Reply from {shop.name}</p>
                    <p className="text-muted-foreground">{r.owner_reply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-1.5">
                {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                Show more reviews
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PoliciesSection({ shop }) {
  const items = (shop.policies ?? []).filter((p) => p.title && p.body);

  return (
    <section id="policies" className="scroll-mt-36">
      <SectionTitle icon={ScrollText} title="Rental policies" />
      {items.length ? (
        <div className="space-y-3">
          {items.map(({ title, body }, idx) => (
            <details key={`${idx}-${title}`} open={idx === 0} className="group rounded-2xl border bg-card shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                <ScrollText className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">{title}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="whitespace-pre-wrap border-t px-5 py-4 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          This company hasn&apos;t added any policies yet — contact them for details.
        </p>
      )}
    </section>
  );
}
