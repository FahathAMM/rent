"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { publicService } from "@/services/publicService";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { BookingRequestWidget } from "../components/BookingRequestWidget";
import { ContactShopDialog } from "../components/ContactShopDialog";
import { ReportListingDialog } from "../components/ReportListingDialog";
import { Gallery } from "../components/VehicleGallery";
import { QuickSpec, Section, Row, Stars } from "../components/DetailBlocks";
import { VehicleCard } from "@/app/(public)/browse/components/VehicleCard";
import { BrandMark } from "@/components/marketplace/BrandMark";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { Button } from "@/components/ui/button";
import { cn, APP_TIMEZONE } from "@/lib/utils";
import {
  Users, Fuel, Gauge, Briefcase, ShieldCheck, MapPin, Loader2, ArrowLeft, ArrowRight,
  Heart, MessageCircle, Flag, Star, Share2, DoorOpen,
  Snowflake, Calendar, Palette, Cog, Tag, Truck, UserRound, Route, CalendarRange, Wallet,
  Sparkles, BadgeCheck, Building2, ChevronRight as Crumb,
} from "lucide-react";
import { toast } from "sonner";


const DEPOSIT_LABEL = { cash_on_pickup: "collected at pickup", prepaid: "paid when booking", waived: "waived" };

// phone-width spec tiles are too narrow for "Automatic"
const SHORT_GEARBOX = { automatic: "Auto", semi_automatic: "Semi-auto", cvt: "CVT" };

const titleCase = (v) => String(v ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
    queryFn: () => customerService.favorites.ids().then((r) => r.data.data),
    enabled: customerSignedIn,
  });
  const saved = !!vehicle && (favoriteIds ?? []).includes(vehicle.id);

  const favorite = useMutation({
    mutationFn: () => (saved ? customerService.favorites.remove(vehicle.id) : customerService.favorites.add(vehicle.id)),
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
          <div className="relative overflow-hidden rounded-3xl border bg-card p-4 shadow-sm sm:px-5">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-violet-500/15 blur-3xl" />

            <div className="relative flex items-center gap-4">
              {vehicle.brand && <BrandMark brand={vehicle.brand} className="hidden size-14 shrink-0 rounded-2xl shadow-md ring-1 ring-border sm:flex" />}
              <div className="min-w-0 flex-1">
                {(vehicle.category || vehicle.shop?.is_verified) && (
                  <div className="mb-0.5 flex flex-wrap items-center gap-2">
                    {vehicle.category && (
                      <Link href={`/browse?category_id=${vehicle.category.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary hover:underline">
                        <Tag className="h-3 w-3" />{vehicle.category.name}
                      </Link>
                    )}
                    {vehicle.shop?.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <ShieldCheck className="h-3 w-3" />Verified shop
                      </span>
                    )}
                  </div>
                )}
                <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">{vehicle.title}</h1>
                {subtitle.trim() && <p className="text-sm text-muted-foreground">{subtitle}</p>}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  {vehicle.rating_count > 0 ? (
                    <a href="#reviews" className="flex items-center gap-1.5 hover:underline">
                      <Stars value={rating} className="h-3.5 w-3.5" />
                      <span className="font-semibold">{rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({vehicle.rating_count} review{vehicle.rating_count === 1 ? "" : "s"})</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />New listing</span>
                  )}
                  {vehicle.shop && (
                    <Link href={`/shops/${vehicle.shop.slug}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Building2 className="h-4 w-4" />{vehicle.shop.name}
                      {vehicle.shop.is_verified && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verified shop" />}
                    </Link>
                  )}
                  {p.delivery_available && <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-400"><Truck className="h-3.5 w-3.5" />Delivery</span>}
                  {p.driver_rate_per_day && <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-400"><UserRound className="h-3.5 w-3.5" />Driver</span>}
                </div>
              </div>
            </div>

            {/* one row of four on every width; phones drop the icons and centre a smaller label/value */}
            <dl className="relative mt-3 grid grid-cols-[1.35fr_1.15fr_0.75fr_0.75fr] gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4 sm:rounded-2xl">
              {[
                { icon: Wallet, label: "Per day", value: format(p.daily_rate) },
                { icon: MapPin, label: "Pickup", value: vehicle.shop?.city },
                { icon: Calendar, label: "Year", value: vehicle.year },
                { icon: CalendarRange, label: "Trips", value: vehicle.booking_count > 0 ? vehicle.booking_count : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex min-w-0 items-center justify-center gap-2.5 bg-card px-1.5 py-1.5 text-center sm:justify-start sm:px-3 sm:py-2 sm:text-left">
                  <Icon className="hidden h-4 w-4 shrink-0 text-primary sm:block" />
                  <div className="min-w-0">
                    <dt className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</dt>
                    <dd className="truncate text-xs font-semibold sm:text-sm">{value || "—"}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {/* ── Quick specs ───────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
            <QuickSpec icon={Users} label="Seats" value={vehicle.seating_capacity} />
            <QuickSpec icon={Gauge} label="Gearbox" value={vehicle.transmission && titleCase(vehicle.transmission)} shortValue={SHORT_GEARBOX[vehicle.transmission]} />
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
                            {r.created_at && <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: APP_TIMEZONE })}</p>}
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
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
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
