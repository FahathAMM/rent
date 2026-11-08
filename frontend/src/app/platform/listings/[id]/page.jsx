"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Home, Loader2, ImageOff, Star, StarOff, CheckCircle2, XCircle, Flag, EyeOff, ShieldAlert, ExternalLink,
  CarFront, Fuel, Cog, Users, DoorOpen, Briefcase, Snowflake, Gauge, Palette, Calendar, Hash, Tag,
  Wallet, MapPin, Store, Clock, History, Images, Sparkles, CalendarCheck, MessageSquare, Truck, ShieldCheck, RotateCcw,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { WhatsAppShareButton } from "@/components/shared/WhatsAppShareButton";

const imageUrl = (img) => (img?.attachment ? `/storage/${img.attachment.file_path}` : null);
const label = (v) => (v ? String(v).replace(/[-_]/g, " ") : null);

const TRIGGER = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";

const HISTORY_TONE = {
  approve: "bg-emerald-500", approved: "bg-emerald-500", republished: "bg-emerald-500", feature: "bg-amber-500",
  reject: "bg-destructive", rejected: "bg-destructive", unpublish: "bg-destructive", unpublished: "bg-destructive",
  flag: "bg-orange-500", flagged: "bg-orange-500",
};

export default function PlatformListingDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [activeImage, setActiveImage] = useState(0);
  const [reasonAction, setReasonAction] = useState(null); // 'reject' | 'flag' | 'unpublish'

  const { data: v, isLoading } = useQuery({
    queryKey: ["platform-listing", id],
    queryFn: () => platformService.listings.getOne(id).then((r) => r.data.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform-listing", id] });
    qc.invalidateQueries({ queryKey: ["platform-listings"] });
  };
  const action = (fn, success, fallback, closeReason = false) => ({
    mutationFn: fn,
    onSuccess: () => { refresh(); if (closeReason) setReasonAction(null); toast.success(success); },
    onError: (err) => toast.error(err.response?.data?.message ?? fallback),
  });

  const approve = useMutation(action(() => platformService.listings.approve(id), "Listing approved", "Failed to approve"));
  const reject = useMutation(action((reason) => platformService.listings.reject(id, reason), "Listing rejected", "Failed to reject", true));
  const flag = useMutation(action((reason) => platformService.listings.flag(id, reason), "Listing flagged", "Failed to flag", true));
  const unpublish = useMutation(action((reason) => platformService.listings.unpublish(id, reason), "Listing unpublished", "Failed to unpublish", true));
  const republish = useMutation({
    ...action(() => platformService.listings.republish(id), "Listing is live again", "Failed to republish"),
    onError: (err) => toast.error(err.response?.data?.errors?.status?.[0] ?? err.response?.data?.message ?? "Failed to republish"),
  });
  const feature = useMutation(action(() => platformService.listings.feature(id), "Listing featured", "Failed"));
  const unfeature = useMutation(action(() => platformService.listings.unfeature(id), "Listing unfeatured", "Failed"));

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Listing Moderation", href: "/platform/listings" },
    { label: v?.title ?? "Listing" },
  ];

  if (isLoading || !v) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageWrapper>
    );
  }

  const images = v.images ?? [];
  const current = images[Math.min(activeImage, images.length - 1)];
  const pricing = v.pricing ?? {};
  const history = v.moderation_history ?? [];
  const features = v.features ?? [];

  // A platform-unpublished listing is unpublished + flagged; Republish handles it in one step instead of Approve.
  const canRepublish = v.status === "unpublished";
  const canModerate = ["pending", "flagged"].includes(v.moderation_status) && !canRepublish;
  const canUnpublish = v.status === "published";
  const canFeature = v.status === "published" && !v.is_featured;

  const specs = [
    { icon: Calendar, label: "Year", value: v.year },
    { icon: Cog, label: "Transmission", value: label(v.transmission) },
    { icon: Fuel, label: "Fuel", value: label(v.fuel_type) },
    { icon: Users, label: "Seats", value: v.seating_capacity },
    { icon: DoorOpen, label: "Doors", value: v.doors },
    { icon: Briefcase, label: "Luggage", value: v.luggage_capacity },
    { icon: Gauge, label: "Engine", value: v.engine_capacity_cc ? `${v.engine_capacity_cc} cc` : null },
    { icon: Snowflake, label: "Air conditioning", value: v.air_conditioned ? "Yes" : "No" },
    { icon: Palette, label: "Colour", value: v.vehicle_colour?.name ?? v.colour, swatch: v.vehicle_colour?.hex },
    { icon: Hash, label: "Registration", value: v.registration_number, mono: true },
    { icon: Tag, label: "Category", value: v.category?.name },
    { icon: CarFront, label: "Variant", value: v.vehicle_variant?.name ?? v.variant },
  ];

  const rates = [
    { label: "Daily", value: pricing.daily_rate },
    { label: "Weekly", value: pricing.weekly_rate },
    { label: "Monthly", value: pricing.monthly_rate },
  ];

  const fees = [
    { label: "Security deposit", value: pricing.security_deposit != null ? format(pricing.security_deposit) : null, sub: label(pricing.deposit_method) },
    { label: "Driver per day", value: pricing.driver_rate_per_day != null ? format(pricing.driver_rate_per_day) : "Self-drive only" },
    { label: "Mileage allowance", value: pricing.mileage_allowance_per_day_km ? `${pricing.mileage_allowance_per_day_km} km/day` : "Unlimited" },
    { label: "Excess mileage", value: pricing.excess_mileage_rate_per_km != null ? `${format(pricing.excess_mileage_rate_per_km)}/km` : null },
    { label: "Cleaning fee", value: pricing.cleaning_fee != null ? format(pricing.cleaning_fee) : null },
    { label: "Late return", value: pricing.late_return_fee_per_hour != null ? `${format(pricing.late_return_fee_per_hour)}/hr` : null },
    { label: "Weekend surcharge", value: pricing.weekend_surcharge_pct ? `${pricing.weekend_surcharge_pct}%` : null },
    { label: "Fuel policy", value: label(pricing.fuel_policy) },
    { label: "Rental length", value: `${pricing.min_rental_days ?? 1}${pricing.max_rental_days ? `–${pricing.max_rental_days}` : "+"} days` },
    { label: "Advance notice", value: pricing.advance_notice_hours != null ? `${pricing.advance_notice_hours} hours` : null },
    { label: "Tax rate", value: pricing.tax_rate ? `${pricing.tax_rate}%` : null },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        {/* ── Hero: gallery + summary ──────────────────────────────────── */}
        <Card className="overflow-hidden rounded-3xl shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="space-y-2 bg-muted/40 p-3">
              <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-muted">
                {current ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(current)} alt={v.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><ImageOff className="h-8 w-8" /> No photos uploaded</div>
                )}
                {v.is_featured && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950 shadow">
                    <Star className="h-3 w-3 fill-current" /> Featured
                  </span>
                )}
                {images.length > 0 && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                    {Math.min(activeImage, images.length - 1) + 1} / {images.length}
                  </span>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      className={cn("h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition", i === activeImage ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(img)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <StatusBadge status={v.status} />
                  <StatusBadge status={v.moderation_status} />
                </div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{v.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {[v.brand?.name ?? v.make, v.vehicle_model?.name ?? v.model, v.year].filter(Boolean).join(" · ")}
                </p>
              </div>

              {v.listing_type === "sale" ? (
                <div className="space-y-1">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold tracking-tight">{v.sale_detail ? format(v.sale_detail.price) : "—"}</span>
                    <span className="pb-1 text-sm text-muted-foreground">for sale</span>
                  </div>
                  {v.sale_detail && (
                    <p className="text-sm capitalize text-muted-foreground">
                      {[v.sale_detail.condition?.replace("_", " "), `${Number(v.sale_detail.mileage_km).toLocaleString()} km`, v.sale_detail.sale_status].join(" · ")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold tracking-tight">{pricing.daily_rate != null ? format(pricing.daily_rate) : "—"}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/ day</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat icon={CalendarCheck} value={v.bookings_count ?? 0} label="Bookings" />
                <MiniStat icon={MessageSquare} value={v.reviews_count ?? 0} label="Reviews" />
                <MiniStat icon={Star} value={Number(v.rating_avg ?? 0).toFixed(1)} label="Rating" />
              </div>

              <Link href={`/platform/shops/${v.shop?.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 font-semibold text-white">
                  {v.shop?.name?.charAt(0)?.toUpperCase() ?? <Store className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.shop?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[v.shop?.city, v.shop?.district].filter(Boolean).join(", ") || v.shop?.owner?.email}</p>
                </div>
                {v.shop?.verification_status === "verified" && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
              </Link>

              {v.moderation_note && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-muted-foreground">{v.moderation_note}</span>
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                {canRepublish && (
                  <Button size="sm" className="gap-1.5" onClick={() => republish.mutate()} disabled={republish.isPending}>
                    {republish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Republish
                  </Button>
                )}
                {canModerate && (
                  <>
                    <Button size="sm" className="gap-1.5" onClick={() => approve.mutate()} disabled={approve.isPending}>
                      {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReasonAction("reject")}>
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                )}
                {canUnpublish && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReasonAction("flag")}><Flag className="h-3.5 w-3.5" /> Flag</Button>
                    <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReasonAction("unpublish")}>
                      <EyeOff className="h-3.5 w-3.5" /> Unpublish
                    </Button>
                  </>
                )}
                {canFeature && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => feature.mutate()} disabled={feature.isPending}><Star className="h-3.5 w-3.5" /> Feature</Button>
                )}
                {v.is_featured && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => unfeature.mutate()} disabled={unfeature.isPending}><StarOff className="h-3.5 w-3.5" /> Unfeature</Button>
                )}
                {v.status === "published" && v.slug && (
                  <Button asChild variant="ghost" size="sm" className="gap-1.5">
                    <Link href={v.listing_type === "sale" ? `/buy/${v.slug}` : `/vehicles/${v.slug}`} target="_blank"><ExternalLink className="h-3.5 w-3.5" /> Public page</Link>
                  </Button>
                )}
                <WhatsAppShareButton vehicle={v} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-card p-1 sm:w-auto">
            <TabsTrigger value="overview" className={TRIGGER}><CarFront className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="photos" className={TRIGGER}><Images className="h-4 w-4" /> Photos <TabCount n={images.length} /></TabsTrigger>
            <TabsTrigger value="pricing" className={TRIGGER}><Wallet className="h-4 w-4" /> Pricing & rules</TabsTrigger>
            <TabsTrigger value="shop" className={TRIGGER}><Store className="h-4 w-4" /> Shop & pickup</TabsTrigger>
            <TabsTrigger value="history" className={TRIGGER}><History className="h-4 w-4" /> History <TabCount n={history.length} /></TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-5">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Specifications</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {specs.map(({ icon: Icon, label: l, value, swatch, mono }) => (
                  <div key={l} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
                      <p className={cn("flex items-center gap-1.5 truncate text-sm font-medium capitalize", mono && "font-mono normal-case", value == null && "font-normal italic text-muted-foreground/60")}>
                        {swatch && <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: swatch }} />}
                        {value ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Description</CardTitle></CardHeader>
                <CardContent>
                  {v.description
                    ? <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">{v.description}</p>
                    : <p className="text-sm italic text-muted-foreground">No description.</p>}
                  {v.condition_notes && (
                    <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Condition notes</p>
                      <p className="whitespace-pre-line text-foreground/90">{v.condition_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Features</CardTitle></CardHeader>
                <CardContent>
                  {features.length ? (
                    <div className="flex flex-wrap gap-2">
                      {features.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />{f}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-sm italic text-muted-foreground">No features listed.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="photos" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Photos</CardTitle>
                <CardDescription>Check each photo shows this vehicle and nothing inappropriate.</CardDescription>
              </CardHeader>
              <CardContent>
                {images.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((img) => (
                      <a key={img.id} href={imageUrl(img)} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(img)} alt="" className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" loading="lazy" />
                        {img.is_primary && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Cover</span>}
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={ImageOff} text="No photos uploaded." />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing" className="mt-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {rates.map(({ label: l, value }) => (
                <Card key={l} className="rounded-2xl shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{l} rate</p>
                    <p className={cn("mt-1 text-2xl font-semibold", value == null && "text-muted-foreground/60")}>{value != null ? format(value) : "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Fees & rental rules</CardTitle></CardHeader>
              <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {fees.map(({ label: l, value, sub }) => (
                  <div key={l} className="min-w-0 border-b pb-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
                    <p className={cn("truncate text-sm font-medium capitalize", !value && "font-normal italic text-muted-foreground/60")}>{value || "Not set"}</p>
                    {sub && <p className="text-xs capitalize text-muted-foreground">{sub}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></div>
                <div className="text-sm">
                  {pricing.delivery_available ? (
                    <>
                      <p className="font-medium">Delivery available</p>
                      <p className="text-muted-foreground">
                        Free within {pricing.delivery_free_radius_km ?? 0} km
                        {pricing.delivery_fee_per_km != null && `, then ${format(pricing.delivery_fee_per_km)}/km`}
                        {pricing.delivery_flat_fee != null && ` · flat ${format(pricing.delivery_flat_fee)}`}
                      </p>
                    </>
                  ) : <p className="text-muted-foreground">No delivery — pickup only.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shop" className="mt-0">
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Shop</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{v.shop?.name}</p>
                    <StatusBadge status={v.shop?.status} />
                    <StatusBadge status={v.shop?.verification_status} />
                  </div>
                  <InfoRow icon={MapPin} value={[v.shop?.city, v.shop?.district].filter(Boolean).join(", ")} />
                  <InfoRow icon={Users} value={v.shop?.owner?.name} sub={v.shop?.owner?.email} />
                  {v.shop?.owner?.phone && <InfoRow icon={Clock} value={v.shop.owner.phone} />}
                  <Button asChild variant="outline" size="sm" className="mt-1">
                    <Link href={`/platform/shops/${v.shop?.id}`}>View shop</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Pickup locations</CardTitle></CardHeader>
                <CardContent className="space-y-2.5">
                  {(v.pickup_locations ?? []).map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.location?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{[p.location?.address, p.location?.city, p.location?.district].filter(Boolean).join(", ") || "—"}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {p.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Default</span>}
                        {p.delivery_allowed && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Delivery</span>}
                      </div>
                    </div>
                  ))}
                  {!v.pickup_locations?.length && <EmptyState icon={MapPin} text="No pickup locations." />}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Moderation history</CardTitle>
                <CardDescription>Submitted {formatDateTime(v.created_at)}{v.published_at && ` · published ${formatDateTime(v.published_at)}`}</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length ? (
                  <ol className="relative space-y-5 border-l pl-6">
                    {history.map((h) => (
                      <li key={h.id} className="relative">
                        <span className={cn("absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-card", HISTORY_TONE[h.action] ?? "bg-muted-foreground")} />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium capitalize">{label(h.action)}</p>
                          <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          by {h.actor_name}
                          {h.from_status && h.to_status && <> · <span className="capitalize">{label(h.from_status)}</span> → <span className="capitalize">{label(h.to_status)}</span></>}
                        </p>
                        {h.reason && <p className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm">{h.reason}</p>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState icon={History} text="No moderation actions yet." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ReasonDialog
        open={reasonAction === "reject"}
        onOpenChange={(open) => !open && setReasonAction(null)}
        title="Reject Listing"
        description="Shown to the owner so they know what to fix."
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "flag"}
        onOpenChange={(open) => !open && setReasonAction(null)}
        title="Flag Listing"
        description="Marks this listing for re-review without taking it offline."
        confirmText="Flag"
        loading={flag.isPending}
        onConfirm={(reason) => flag.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "unpublish"}
        onOpenChange={(open) => !open && setReasonAction(null)}
        title="Unpublish Listing"
        description="Takes this listing offline immediately. The shop can't publish it again until you republish it."
        confirmText="Unpublish"
        loading={unpublish.isPending}
        onConfirm={(reason) => unpublish.mutate(reason)}
      />
    </PageWrapper>
  );
}

function TabCount({ n }) {
  return <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

function MiniStat({ icon: Icon, value, label: l }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2 py-2.5">
      <p className="flex items-center justify-center gap-1 text-sm font-semibold"><Icon className="h-3.5 w-3.5 text-primary" />{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, value, sub }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className={cn("truncate", !value && "italic text-muted-foreground/60")}>{value || "Not provided"}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6" /> {text}
    </div>
  );
}
