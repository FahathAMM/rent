"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { favoriteService } from "@/services/favoriteService";
import { reportService } from "@/services/reportService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { BookingRequestWidget } from "@/components/marketplace/BookingRequestWidget";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { VEHICLE_PLACEHOLDER_IMAGE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Users, Fuel, Gauge, Briefcase, ShieldCheck, MapPin, Loader2, ArrowLeft, ArrowRight,
  Heart, MessageCircle, Flag, Star, Share2, ChevronLeft, ChevronRight, X, Expand, DoorOpen,
  Snowflake, Calendar, Palette, Cog, Tag, Truck, UserRound, Route, CalendarRange, Wallet,
  Sparkles, BadgeCheck, Building2, ImageIcon, ChevronRight as Crumb,
} from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = [
  { value: "misleading_price", label: "Misleading price" },
  { value: "fake_listing", label: "Fake listing" },
  { value: "unsafe_vehicle", label: "Unsafe vehicle" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

const DEPOSIT_LABEL = { cash_on_pickup: "collected at pickup", prepaid: "paid when booking", waived: "waived" };

const titleCase = (v) => String(v ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function ContactShopDialog({ open, onOpenChange, vehicle, user }) {
  const [form, setForm] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", message: "" });
  const [errors, setErrors] = useState({});

  const send = useMutation({
    mutationFn: () => publicService.sendInquiry({ vehicle_slug: vehicle.slug, ...form }),
    onSuccess: () => {
      toast.success("Your message has been sent to the rental shop");
      onOpenChange(false);
      setForm({ name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", message: "" });
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Contact {vehicle.shop?.name ?? "the shop"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <TextInput label="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
          <TextInput label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone?.[0]} />
          <TextInput label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email?.[0]} />
          <TextareaInput label="Message" required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message?.[0]} placeholder={`Hi, is the ${vehicle.title} available for my dates?`} />
        </div>
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportListingDialog({ open, onOpenChange, vehicle }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const report = useMutation({
    mutationFn: () => reportService.create({ reportable_type: "vehicle", reportable_id: vehicle.id, reason, description }),
    onSuccess: () => {
      toast.success("Report submitted — our team will review it");
      onOpenChange(false);
      setReason("");
      setDescription("");
    },
    onError: (err) => setError(err.response?.data?.message ?? "Failed to submit report"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report this listing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SelectInput label="Reason" required options={REPORT_REASONS} value={reason} onChange={setReason} />
          <TextareaInput label="Details (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => report.mutate()} disabled={!reason || report.isPending}>
            {report.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Gallery + fullscreen viewer ──────────────────────────────────────── */

function Lightbox({ images, index, setIndex, onClose, title }) {
  const count = images.length;
  const go = useCallback((dir) => setIndex((i) => (i + dir + count) % count), [count, setIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${title} photos`}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm text-white/80">{index + 1} / {count}</p>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index].url} alt={images[index].alt_text || title} className="max-h-[78vh] max-w-full rounded-lg object-contain" />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous photo"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next photo"><ChevronRight className="h-6 w-6" /></button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4 no-scrollbar">
          {images.map((img, i) => (
            <button key={img.url ?? i} type="button" onClick={() => setIndex(i)} className={cn("shrink-0 overflow-hidden rounded-lg border-2 transition-all", i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-90")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-14 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Gallery({ images, title, badge }) {
  const list = (images ?? []).filter((i) => i.url);
  const ordered = [...list.filter((i) => i.is_primary), ...list.filter((i) => !i.is_primary)];
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState(false);
  const count = ordered.length;
  const current = ordered[active]?.url ?? VEHICLE_PLACEHOLDER_IMAGE;
  const go = (dir) => setActive((i) => (i + dir + count) % count);

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[16/10] overflow-hidden rounded-3xl border bg-muted shadow-sm">
        <button type="button" onClick={() => count && setViewer(true)} className="block h-full w-full" aria-label="View photos full screen" disabled={!count}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        </button>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

        {badge}

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md opacity-0 transition-opacity hover:bg-white group-hover:opacity-100" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md opacity-0 transition-opacity hover:bg-white group-hover:opacity-100" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
        {count > 0 && (
          <button type="button" onClick={() => setViewer(true)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/75">
            <Expand className="h-3.5 w-3.5" /> {count > 1 ? `${active + 1} / ${count} photos` : "View photo"}
          </button>
        )}
        {count === 0 && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white"><ImageIcon className="h-3.5 w-3.5" /> No photos yet</span>
        )}
      </div>

      {count > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {ordered.slice(0, 6).map((img, i) => (
            <button
              key={img.url ?? i}
              type="button"
              onClick={() => (i === 5 && count > 6 ? setViewer(true) : setActive(i))}
              className={cn("relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all", i === active ? "border-primary shadow-md" : "border-transparent opacity-80 hover:opacity-100", i === 5 && "hidden sm:block")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {i === 5 && count > 6 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">+{count - 6}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {viewer && count > 0 && <Lightbox images={ordered} index={active} setIndex={setActive} onClose={() => setViewer(false)} title={title} />}
    </div>
  );
}

/* ── Small building blocks ────────────────────────────────────────────── */

function QuickSpec({ icon: Icon, label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-3 py-4 text-center shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary"><Icon className="h-5 w-5" /></span>
      <p className="text-sm font-semibold capitalize leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children, className }) {
  return (
    <section className={cn("rounded-3xl border bg-card p-5 shadow-sm sm:p-6", className)}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 text-primary"><Icon className="h-4 w-4" /></span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
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

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function VehicleDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { format } = useCurrencyFormat();
  // Favorites + the contact prefill belong to the customer account. Reports
  // still go through the vendor (users) API, so that button keeps useAuth.
  const { customer, isAuthenticated: customerSignedIn } = useCustomerAuth();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [contacting, setContacting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const requireLogin = () => {
    toast.error("Please log in first");
    router.push("/login");
  };

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["public-vehicle", slug],
    queryFn: () => publicService.vehicle(slug).then((r) => r.data.data),
  });

  console.log('vehicle',vehicle);
  

  // Server truth for the heart, so it survives a refresh.
  const { data: favoriteIds } = useQuery({
    queryKey: ["my-favorite-ids"],
    queryFn: () => favoriteService.ids().then((r) => r.data.data),
    enabled: customerSignedIn,
  });
  const saved = !!vehicle && (favoriteIds ?? []).includes(vehicle.id);

  const favorite = useMutation({
    mutationFn: () => (saved ? favoriteService.remove(vehicle.id) : favoriteService.add(vehicle.id)),
    onSuccess: () => {
      toast.success(saved ? "Removed from favorites" : "Saved to favorites");
      qc.invalidateQueries({ queryKey: ["my-favorite-ids"] });
      qc.invalidateQueries({ queryKey: ["my-favorites"] });
    },
    onError: () => toast.error("Could not update favorites"),
  });

  const { data: reviews } = useQuery({
    queryKey: ["public-vehicle-reviews", slug],
    queryFn: () => publicService.vehicleReviews(slug).then((r) => r.data.data),
    enabled: !!vehicle,
  });

  const categoryId = vehicle?.category?.id;
  const { data: similar } = useQuery({
    queryKey: ["public-vehicles", "similar", categoryId],
    queryFn: () => publicService.vehicles({ category_id: categoryId, per_page: 5 }).then((r) => r.data.data),
    enabled: !!categoryId,
    select: (list) => list.filter((v) => v.slug !== slug).slice(0, 4),
  });

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: vehicle.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  };

  const scrollToBooking = () => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold">Vehicle not found</p>
        <Button asChild variant="outline"><Link href="/browse">Back to browse</Link></Button>
      </div>
    );
  }

  const p = vehicle.pricing ?? {};
  const daily = Number(p.daily_rate) || 0;
  const savings = (rate, days) => (daily && rate ? Math.round((1 - Number(rate) / (daily * days)) * 100) : 0);
  const weeklySave = savings(p.weekly_rate, 7);
  const monthlySave = savings(p.monthly_rate, 30);
  const rating = Number(vehicle.rating_avg);
  const subtitle = [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ") + (vehicle.year ? ` · ${vehicle.year}` : "");

  return (
    <div className="pb-24 lg:pb-16">
      {/* ── Breadcrumb + actions ───────────────────────────────────────── */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <Link href="/browse" className="flex shrink-0 items-center gap-1.5 font-medium transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Browse
            </Link>
            {vehicle.category && (
              <>
                <Crumb className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <Link href={`/browse?category_id=${vehicle.category.id}`} className="shrink-0 hover:text-foreground">{vehicle.category.name}</Link>
              </>
            )}
            <Crumb className="hidden h-3.5 w-3.5 shrink-0 opacity-50 sm:block" />
            <span className="hidden truncate font-medium text-foreground sm:block">{vehicle.title}</span>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5 bg-card" onClick={() => (customerSignedIn ? favorite.mutate() : requireLogin())} disabled={favorite.isPending}>
              <Heart className={cn("h-4 w-4", saved && "fill-current text-destructive")} /> <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-card" onClick={share}>
              <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 bg-card text-muted-foreground" onClick={() => (isAuthenticated ? setReporting(true) : requireLogin())} aria-label="Report listing">
              <Flag className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Gallery
            images={vehicle.images}
            title={vehicle.title}
            badge={vehicle.is_featured && (
              <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                <Sparkles className="h-3.5 w-3.5" /> Featured
              </span>
            )}
          />

          {/* ── Title ─────────────────────────────────────────────────── */}
          <div className="flex items-start gap-4">
            {vehicle.brand && <BrandMark brand={vehicle.brand} className="size-14 rounded-2xl shadow-sm" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{vehicle.title}</h1>
                {vehicle.rating_count > 0 && (
                  <a href="#reviews" className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400">
                    <Star className="h-4 w-4 fill-current" /> {rating.toFixed(1)}
                    <span className="font-normal text-amber-700/70 dark:text-amber-400/70">({vehicle.rating_count})</span>
                  </a>
                )}
              </div>
              {subtitle.trim() && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {vehicle.category && <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary"><Tag className="h-3.5 w-3.5" />{vehicle.category.name}</span>}
                {vehicle.shop?.is_verified && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" />Verified shop</span>}
                {vehicle.shop?.city && <span className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><MapPin className="h-3.5 w-3.5" />{vehicle.shop.city}</span>}
                {p.delivery_available && <span className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><Truck className="h-3.5 w-3.5" />Delivery available</span>}
                {vehicle.booking_count > 0 && <span className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"><CalendarRange className="h-3.5 w-3.5" />{vehicle.booking_count} trips</span>}
              </div>
            </div>
          </div>

          {/* ── Quick specs ───────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            <QuickSpec icon={Users} label="Seats" value={vehicle.seating_capacity} />
            <QuickSpec icon={Gauge} label="Gearbox" value={vehicle.transmission && titleCase(vehicle.transmission)} />
            <QuickSpec icon={Fuel} label="Fuel" value={vehicle.fuel_type} />
            <QuickSpec icon={Briefcase} label="Bags" value={vehicle.luggage_capacity} />
            <QuickSpec icon={DoorOpen} label="Doors" value={vehicle.doors} />
            <QuickSpec icon={Snowflake} label="A/C" value={vehicle.air_conditioned ? "Yes" : vehicle.air_conditioned === false ? "No" : null} />
          </div>

          {vehicle.description && (
            <Section icon={Sparkles} title="About this vehicle">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{vehicle.description}</p>
              {vehicle.features?.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2 border-t pt-5">
                  {vehicle.features.map((feat) => (
                    <span key={feat} className="flex items-center gap-1.5 rounded-full border bg-gradient-to-br from-orange-500/5 via-pink-500/5 to-violet-500/5 px-3 py-1 text-xs font-medium">
                      <BadgeCheck className="h-3.5 w-3.5 text-primary" />{feat}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Section icon={Cog} title="Specifications">
              <div className="divide-y">
                {vehicle.make && <Row icon={Tag} label="Make">{vehicle.make}</Row>}
                {vehicle.model && <Row icon={Tag} label="Model">{[vehicle.model, vehicle.variant].filter(Boolean).join(" ")}</Row>}
                {vehicle.year && <Row icon={Calendar} label="Year">{vehicle.year}</Row>}
                {vehicle.colour && (
                  <Row icon={Palette} label="Colour">
                    <span className="inline-flex items-center gap-1.5"><ColourSwatch hex={vehicle.colour_hex} className="size-3.5" />{vehicle.colour}</span>
                  </Row>
                )}
                {vehicle.engine_capacity_cc && <Row icon={Gauge} label="Engine">{Number(vehicle.engine_capacity_cc).toLocaleString()} cc</Row>}
                {vehicle.transmission && <Row icon={Cog} label="Transmission">{titleCase(vehicle.transmission)}</Row>}
                {vehicle.fuel_type && <Row icon={Fuel} label="Fuel type">{titleCase(vehicle.fuel_type)}</Row>}
              </div>
            </Section>

            <Section icon={Route} title="Rental terms">
              <div className="divide-y">
                <Row icon={CalendarRange} label="Rental length">
                  {p.min_rental_days > 1 ? `${p.min_rental_days} days min` : "From 1 day"}{p.max_rental_days ? ` · ${p.max_rental_days} max` : ""}
                </Row>
                <Row icon={Route} label="Mileage">{p.mileage_allowance_per_day_km ? `${p.mileage_allowance_per_day_km} km / day` : "Unlimited"}</Row>
                <Row icon={Wallet} label="Deposit">
                  {Number(p.security_deposit) > 0 ? `${format(p.security_deposit)} · ${DEPOSIT_LABEL[p.deposit_method] ?? ""}` : "No deposit"}
                </Row>
                <Row icon={UserRound} label="With driver">{p.driver_rate_per_day ? `+${format(p.driver_rate_per_day)} / day` : "Self-drive only"}</Row>
                <Row icon={Truck} label="Delivery">{p.delivery_available ? "Available" : "Pickup only"}</Row>
              </div>
            </Section>
          </div>

          {/* ── Shop ───────────────────────────────────────────────────── */}
          {vehicle.shop && (
            <Section icon={Building2} title="Rented by">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {vehicle.shop.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vehicle.shop.logo} alt={vehicle.shop.name} className="size-16 rounded-2xl border object-cover shadow-sm" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-2xl font-bold text-white shadow-sm">
                      {vehicle.shop.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {vehicle.shop.name}
                      {vehicle.shop.is_verified && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {Number(vehicle.shop.rating_avg) > 0 && (
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(vehicle.shop.rating_avg).toFixed(1)} shop rating</span>
                      )}
                      {vehicle.shop.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vehicle.shop.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => setContacting(true)}><MessageCircle className="h-4 w-4" />Message</Button>
                  <Button asChild variant="outline" className="gap-1.5">
                    <Link href={`/shops/${vehicle.shop.slug}`}>View shop <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </Section>
          )}

          {/* ── Reviews ────────────────────────────────────────────────── */}
          <Section icon={Star} title={`Reviews${vehicle.rating_count > 0 ? ` (${vehicle.rating_count})` : ""}`} className="scroll-mt-24">
            <div id="reviews" />
            {reviews?.length ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-2xl bg-muted/40 p-4">
                  <p className="text-4xl font-bold tracking-tight">{rating > 0 ? rating.toFixed(1) : "—"}</p>
                  <div>
                    <Stars value={rating} />
                    <p className="mt-1 text-xs text-muted-foreground">Based on {vehicle.rating_count} review{vehicle.rating_count === 1 ? "" : "s"} from completed rentals</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {reviews.map((r) => (
                    <article key={r.id} className="flex flex-col gap-2 rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-sm font-semibold text-white">
                            {(r.reviewer_name ?? "V")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{r.reviewer_name ?? "Verified renter"}</p>
                            {r.created_at && <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>}
                          </div>
                        </div>
                        <Stars value={r.rating} className="h-3.5 w-3.5" />
                      </div>
                      {r.title && <p className="text-sm font-medium">{r.title}</p>}
                      {r.comment && <p className="text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
                      {r.is_verified_booking && <p className="mt-auto flex items-center gap-1 text-xs text-emerald-600"><BadgeCheck className="h-3.5 w-3.5" />Verified rental</p>}
                      {r.owner_reply && (
                        <div className="rounded-xl bg-muted/60 p-3 text-sm">
                          <p className="mb-1 text-xs font-semibold">Reply from {vehicle.shop?.name ?? "the shop"}</p>
                          <p className="text-muted-foreground">{r.owner_reply}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-10 text-center">
                <Star className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">No reviews yet</p>
                <p className="text-xs text-muted-foreground">Reviews appear here after customers complete a rental.</p>
              </div>
            )}
          </Section>
        </div>

        {/* ── Booking sidebar ─────────────────────────────────────────── */}
        <aside id="booking" className="scroll-mt-20">
          <div className="sticky top-20 space-y-4">
            <div className="overflow-hidden rounded-3xl border bg-card shadow-lg">
              <div className="h-1.5 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" />
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From</p>
                  <p className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 bg-clip-text text-3xl font-bold text-transparent">
                    {format(p.daily_rate)}<span className="text-sm font-normal text-muted-foreground">/day</span>
                  </p>
                </div>

                {(p.weekly_rate || p.monthly_rate) && (
                  <div className="grid grid-cols-2 gap-2">
                    {p.weekly_rate && (
                      <div className="rounded-xl border bg-muted/30 p-2.5">
                        <p className="text-[11px] text-muted-foreground">Weekly</p>
                        <p className="text-sm font-semibold">{format(p.weekly_rate)}</p>
                        {weeklySave > 0 && <p className="text-[11px] font-medium text-emerald-600">Save {weeklySave}%</p>}
                      </div>
                    )}
                    {p.monthly_rate && (
                      <div className="rounded-xl border bg-muted/30 p-2.5">
                        <p className="text-[11px] text-muted-foreground">Monthly</p>
                        <p className="text-sm font-semibold">{format(p.monthly_rate)}</p>
                        {monthlySave > 0 && <p className="text-[11px] font-medium text-emerald-600">Save {monthlySave}%</p>}
                      </div>
                    )}
                  </div>
                )}

                {Number(p.security_deposit) > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
                    <Wallet className="h-4 w-4 shrink-0" />
                    Security deposit {format(p.security_deposit)} — {DEPOSIT_LABEL[p.deposit_method] ?? ""}
                  </p>
                )}

                <BookingRequestWidget vehicle={vehicle} />

                <Button variant="outline" className="w-full gap-1.5" onClick={() => setContacting(true)}>
                  <MessageCircle className="h-4 w-4" /> Contact the shop
                </Button>
              </div>
            </div>

            <ul className="space-y-2 rounded-3xl border bg-card p-5 text-sm shadow-sm">
              {[
                { icon: ShieldCheck, text: vehicle.shop?.is_verified ? "Verified rental shop" : "Listing reviewed by our team" },
                { icon: BadgeCheck, text: "Reviews only from completed rentals" },
                { icon: MessageCircle, text: "Ask the shop anything before you book" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0 text-emerald-600" />{text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* ── Similar vehicles ─────────────────────────────────────────── */}
      {similar?.length > 0 && (
        <section className="border-t bg-muted/30 py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">You may also like</p>
                <h2 className="text-2xl font-semibold tracking-tight">More {vehicle.category?.name ?? "vehicles"}</h2>
              </div>
              <Link href={`/browse?category_id=${categoryId}`} className="group flex items-center gap-1 text-sm font-medium text-primary">
                View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Mobile booking bar ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold leading-tight">{format(p.daily_rate)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
            {rating > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{rating.toFixed(1)} · {vehicle.rating_count} reviews</p>}
          </div>
          <Button onClick={scrollToBooking} className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 px-6 hover:opacity-90">
            Book now
          </Button>
        </div>
      </div>

      <ContactShopDialog open={contacting} onOpenChange={setContacting} vehicle={vehicle} user={customerSignedIn ? customer : null} />
      <ReportListingDialog open={reporting} onOpenChange={setReporting} vehicle={vehicle} />
    </div>
  );
}
