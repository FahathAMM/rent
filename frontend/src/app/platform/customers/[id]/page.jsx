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
  Home, Loader2, Phone, Mail, MessageCircle, MapPin, Building2, CalendarCheck, CalendarClock, CheckCircle2,
  XCircle, Star, Heart, Wallet, Store, Clock, ShieldAlert, ShieldCheck, Ban, RotateCcw, IdCard, Car,
  UserRound, BadgeCheck, LogIn, FileSignature, Scale, ArrowUpRight, Cake, Siren, AlertTriangle,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

function whatsappHref(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`;
}

/** Show only the last 4 characters of an ID number. */
function mask(value) {
  if (!value) return null;
  const s = String(value);
  return s.length <= 4 ? s : `${"•".repeat(Math.min(s.length - 4, 8))}${s.slice(-4)}`;
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlatformCustomerDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [reasonAction, setReasonAction] = useState(null); // 'suspend' | 'ban'

  const { data: customer, isLoading } = useQuery({
    queryKey: ["platform-customer", id],
    queryFn: () => platformService.customers.getOne(id).then((r) => r.data.data),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["platform-customer", id] });
  const onError = (fallback) => (err) => toast.error(err.response?.data?.message ?? fallback);

  const suspend = useMutation({
    mutationFn: (reason) => platformService.customers.suspend(id, reason),
    onSuccess: () => { refresh(); setReasonAction(null); toast.success("Account suspended"); },
    onError: onError("Failed to suspend"),
  });
  const ban = useMutation({
    mutationFn: (reason) => platformService.customers.ban(id, reason),
    onSuccess: () => { refresh(); setReasonAction(null); toast.success("Account banned"); },
    onError: onError("Failed to ban"),
  });
  const activate = useMutation({
    mutationFn: () => platformService.customers.activate(id),
    onSuccess: () => { refresh(); toast.success("Account activated"); },
    onError: onError("Failed to activate"),
  });

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Customers", href: "/platform/customers" },
    { label: customer?.name ?? "Customer" },
  ];

  if (isLoading || !customer) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageWrapper>
    );
  }

  const profile = customer.customer_profile ?? {};
  const stats = customer.stats ?? {};
  const bookings = customer.bookings ?? [];
  const reviews = customer.reviews ?? [];
  const disputes = customer.disputes ?? [];
  const total = customer.bookings_count ?? 0;
  const place = [profile.city, profile.district].filter(Boolean).join(", ");

  const tiles = [
    { icon: CalendarCheck, label: "Bookings", value: total, sub: `${stats.upcoming ?? 0} upcoming`, tone: "text-sky-600 bg-sky-500/10" },
    { icon: CheckCircle2, label: "Completed", value: stats.completed ?? 0, sub: `${stats.shops_used ?? 0} shops used`, tone: "text-emerald-600 bg-emerald-500/10" },
    { icon: Wallet, label: "Total spent", value: format(stats.total_spent ?? 0), sub: "completed trips", tone: "text-violet-600 bg-violet-500/10" },
    { icon: Star, label: "Reviews", value: customer.reviews_count ?? 0, sub: "written", tone: "text-amber-600 bg-amber-500/10" },
    { icon: Heart, label: "Favourites", value: customer.favorites_count ?? 0, sub: "saved vehicles", tone: "text-rose-600 bg-rose-500/10" },
  ];

  // Booking outcome split for the breakdown bar.
  const breakdown = [
    { label: "Completed", value: stats.completed ?? 0, color: "bg-emerald-500" },
    { label: "Upcoming / active", value: stats.upcoming ?? 0, color: "bg-sky-500" },
    { label: "Cancelled / rejected", value: stats.cancelled ?? 0, color: "bg-zinc-400" },
    { label: "No-show", value: stats.no_show ?? 0, color: "bg-rose-500" },
  ];

  const timeline = [
    { icon: UserRound, label: "Account created", at: customer.created_at, done: true },
    { icon: FileSignature, label: "Accepted terms", at: customer.terms_accepted_at, done: !!customer.terms_accepted_at },
    { icon: Phone, label: "Mobile verified", at: customer.phone_verified_at, done: !!customer.phone_verified_at },
    { icon: CalendarCheck, label: "Last booking", at: stats.last_booking_at, done: !!stats.last_booking_at },
    { icon: LogIn, label: "Last login", at: customer.last_login_at, done: !!customer.last_login_at },
  ];

  const tabClass = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-3xl shadow-sm">
          <div className="relative h-28 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 sm:h-32">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_45%)]" />
          </div>
          <div className="relative px-5 pb-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="-mt-10 shrink-0">
                  {customer.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customer.avatar_url} alt={customer.name} className="size-20 rounded-full border-4 border-card bg-card object-cover shadow-md" />
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-sky-500 to-violet-500 text-2xl font-bold text-white shadow-md">
                      {customer.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{customer.name}</h1>
                  <p className="truncate text-sm text-muted-foreground">{customer.email || customer.phone || "No contact details"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {customer.phone && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href={`tel:${customer.phone}`}><Phone className="h-3.5 w-3.5" /> Call</a>
                  </Button>
                )}
                {customer.phone && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href={whatsappHref(customer.phone)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                  </Button>
                )}
                {customer.email && (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href={`mailto:${customer.email}`}><Mail className="h-3.5 w-3.5" /> Email</a>
                  </Button>
                )}
                {customer.status !== "active" && (
                  <Button size="sm" className="gap-1.5" onClick={() => activate.mutate()} disabled={activate.isPending}>
                    {activate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Activate
                  </Button>
                )}
                {customer.status !== "suspended" && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReasonAction("suspend")}>
                    <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                {customer.status !== "banned" && (
                  <Button variant="outline" size="sm" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReasonAction("ban")}>
                    <Ban className="h-3.5 w-3.5" /> Ban
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={customer.status} />
              <Chip icon={customer.phone_verified_at ? BadgeCheck : Phone} tone={customer.phone_verified_at && "text-emerald-600"}>
                {customer.phone_verified_at ? "Mobile verified" : "Mobile not verified"}
              </Chip>
              {profile.verification_status && <Chip icon={IdCard}>ID {profile.verification_status}</Chip>}
              {place && <Chip icon={MapPin}>{place}</Chip>}
              <Chip icon={Clock}>Joined {formatDateTime(customer.created_at)}</Chip>
              {customer.registration_source && <Chip icon={LogIn}>via {customer.registration_source}</Chip>}
              <Chip icon={UserRound}>ID #{customer.id}</Chip>
            </div>
          </div>
        </Card>

        {customer.status !== "active" && customer.suspended_reason && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold capitalize text-destructive">
                {customer.status}{customer.suspended_at && <span className="font-normal text-muted-foreground"> · {formatDateTime(customer.suspended_at)}</span>}
              </p>
              <p className="text-sm text-muted-foreground">{customer.suspended_reason}</p>
            </div>
          </div>
        )}

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map(({ icon: Icon, label, value, sub, tone }) => (
            <Card key={label} className="rounded-2xl shadow-sm">
              <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10", tone)}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold leading-tight">{value}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{label} · {sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-card p-1 sm:w-auto">
            <TabsTrigger value="overview" className={tabClass}><UserRound className="h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="bookings" className={tabClass}><CalendarCheck className="h-4 w-4" /> Bookings <TabCount n={total} /></TabsTrigger>
            <TabsTrigger value="reviews" className={tabClass}><Star className="h-4 w-4" /> Reviews <TabCount n={customer.reviews_count ?? 0} /></TabsTrigger>
            <TabsTrigger value="disputes" className={tabClass}><Scale className="h-4 w-4" /> Disputes <TabCount n={disputes.length} /></TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <DetailGroup title="Contact" icon={Phone} items={[
                      { icon: Mail, label: "Email", value: customer.email, href: customer.email && `mailto:${customer.email}`, badge: customer.email && (customer.email_verified_at ? "verified" : null) },
                      { icon: Phone, label: "Mobile", value: customer.phone, href: customer.phone && `tel:${customer.phone}`, badge: customer.phone_verified_at ? "verified" : null },
                      { icon: Cake, label: "Date of birth", value: formatDate(customer.date_of_birth) },
                    ]} />
                    <DetailGroup title="Address" icon={MapPin} items={[
                      { icon: MapPin, label: "Address", value: [profile.address_line_1, profile.address_line_2].filter(Boolean).join(", ") || customer.address },
                      { icon: Building2, label: "City", value: profile.city },
                      { icon: MapPin, label: "District", value: profile.district },
                    ]} />
                    <DetailGroup title="Identity & licence" icon={IdCard} items={[
                      { icon: IdCard, label: "NIC number", value: mask(profile.nic_number), mono: true },
                      { icon: Car, label: "Driving licence", value: mask(profile.driving_licence_no), mono: true },
                      { icon: CalendarClock, label: "Licence expiry", value: formatDate(profile.licence_expiry), warn: profile.licence_expiry && new Date(profile.licence_expiry) < new Date() },
                    ]} />
                    <DetailGroup title="Emergency contact" icon={Siren} items={[
                      { icon: UserRound, label: "Name", value: profile.emergency_contact_name },
                      { icon: Phone, label: "Phone", value: profile.emergency_contact_phone, href: profile.emergency_contact_phone && `tel:${profile.emergency_contact_phone}` },
                    ]} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Booking breakdown</CardTitle>
                    <CardDescription>{total} booking{total === 1 ? "" : "s"} in total</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      {total > 0 && breakdown.map((b) => b.value > 0 && (
                        <div key={b.label} className={b.color} style={{ width: `${(b.value / total) * 100}%` }} title={`${b.label}: ${b.value}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {breakdown.map((b) => (
                        <div key={b.label} className="rounded-xl border p-3">
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-2 rounded-full", b.color)} />{b.label}</p>
                          <p className="mt-1 text-lg font-semibold">{b.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Account activity</CardTitle></CardHeader>
                  <CardContent>
                    <ol className="relative space-y-4 border-l pl-5">
                      {timeline.map(({ icon: Icon, label, at, done }) => (
                        <li key={label} className="relative">
                          <span className={cn(
                            "absolute -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                            done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                          )}>
                            {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                          </span>
                          <p className={cn("text-sm font-medium", !done && "text-muted-foreground")}>{label}</p>
                          <p className="text-xs text-muted-foreground">{at ? formatDateTime(at) : "Not yet"}</p>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Trust signals</CardTitle></CardHeader>
                  <CardContent className="space-y-2.5">
                    <Signal ok={!!customer.phone_verified_at} label="Mobile number verified by OTP" />
                    <Signal ok={profile.verification_status === "verified"} label="Identity documents verified" />
                    <Signal ok={(stats.completed ?? 0) > 0} label={`${stats.completed ?? 0} completed trip${stats.completed === 1 ? "" : "s"}`} />
                    <Signal ok={(stats.no_show ?? 0) === 0} label={stats.no_show ? `${stats.no_show} no-show${stats.no_show === 1 ? "" : "s"}` : "No no-shows"} />
                    <Signal ok={disputes.length === 0} label={disputes.length ? `${disputes.length} dispute${disputes.length === 1 ? "" : "s"} raised` : "No disputes"} />
                  </CardContent>
                </Card>
              </aside>
            </div>
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent bookings</CardTitle>
                <CardDescription>The latest {bookings.length} of {total}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {bookings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/platform/bookings/${b.booking_reference}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Car className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{b.vehicle?.title ?? "Vehicle"} <span className="font-mono text-xs text-muted-foreground">· {b.booking_reference}</span></p>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" />{b.shop?.name ?? "—"}</span>
                          <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(b.pickup_at)} → {formatDate(b.return_at)} · {b.rental_days}d</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.pricing?.total_payable != null && <span className="text-sm font-semibold tabular-nums">{format(b.pricing.total_payable)}</span>}
                      <StatusBadge status={b.status} />
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                  </Link>
                ))}
                {!bookings.length && <Empty icon={CalendarCheck}>No bookings yet.</Empty>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Reviews written</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {reviews.map((r) => (
                  <div key={r.id} className="space-y-2 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.vehicle?.title ?? "Vehicle"}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.shop?.name} · {formatDate(r.created_at)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <Stars rating={r.rating} />
                    {r.title && <p className="text-sm font-medium">{r.title}</p>}
                    {r.comment && <p className="line-clamp-3 text-sm text-muted-foreground">{r.comment}</p>}
                  </div>
                ))}
                {!reviews.length && <div className="md:col-span-2"><Empty icon={Star}>No reviews written.</Empty></div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disputes */}
          <TabsContent value="disputes" className="mt-0">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base">Disputes raised</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {disputes.map((d) => (
                  <Link
                    key={d.id}
                    href={`/platform/disputes/${d.dispute_reference}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><AlertTriangle className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.subject}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-mono">{d.dispute_reference}</span> · {formatDateTime(d.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.status} />
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                  </Link>
                ))}
                {!disputes.length && <Empty icon={ShieldCheck}>No disputes raised.</Empty>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ReasonDialog
        open={reasonAction === "suspend"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Suspend Account"
        description="The account's existing sessions are logged out immediately."
        confirmText="Suspend"
        loading={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
      <ReasonDialog
        open={reasonAction === "ban"}
        onOpenChange={(v) => !v && setReasonAction(null)}
        title="Ban Account"
        description="A ban is more severe than a suspension and should be reserved for confirmed abuse or fraud."
        confirmText="Ban"
        loading={ban.isPending}
        onConfirm={(reason) => ban.mutate(reason)}
      />
    </PageWrapper>
  );
}

function TabCount({ n }) {
  return <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

function Chip({ icon: Icon, tone, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 capitalize text-muted-foreground">
      <Icon className={cn("h-3 w-3 text-primary", tone)} />{children}
    </span>
  );
}

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-4 w-4", i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">{rating}/5</span>
    </div>
  );
}

function Signal({ ok, label }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
      <span className={cn(!ok && "text-muted-foreground")}>{label}</span>
    </p>
  );
}

function Empty({ icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6" /> {children}
    </div>
  );
}

function DetailGroup({ title, icon: GroupIcon, items }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><GroupIcon className="h-3.5 w-3.5" /></span>
        {title}
      </p>
      <dl className="grid gap-3">
        {items.map(({ icon: Icon, label, value, href, mono, badge, warn }) => (
          <div key={label} className="flex min-w-0 items-start gap-2.5">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className={cn("flex items-center gap-1.5 truncate text-sm", mono && "font-mono", !value && "italic text-muted-foreground/60", warn && "text-destructive")}>
                {value && href ? <a href={href} className="truncate text-primary hover:underline">{value}</a> : (value || "Not provided")}
                {badge && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 text-[10px] font-medium not-italic text-emerald-600"><BadgeCheck className="h-3 w-3" />{badge}</span>}
                {warn && <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-medium">expired</span>}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
