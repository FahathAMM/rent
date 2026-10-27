"use client";

import Link from "next/link";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Button } from "@/components/ui/button";
import { ShopCover } from "@/components/marketplace/ShopCover";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Star, MapPin, CarFront, Phone, MessageCircle, CalendarCheck, Zap, ArrowRight,Building2
} from "lucide-react";

/** Shop directory tiles (grid card + list row) — Http\Resources\Public\ShopResource's shape, incl. the listing's fleet stats. Used by /shops and the home page. */
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
      <ShopCover shop={shop} variant="card" className="transition-transform duration-500 group-hover:scale-105" />
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
    <p className="flex items-baseline gap-1 whitespace-nowrap leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">From</span>
      <span className="text-sm font-bold">{format ? format(shop.starting_daily_rate) : `LKR ${shop.starting_daily_rate}`}</span>
      <span className="text-[10px] text-muted-foreground">/day</span>
    </p>
  );
}

export function ShopCard({ shop }) {
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

export function ShopRow({ shop }) {
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
