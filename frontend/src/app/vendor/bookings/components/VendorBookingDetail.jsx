"use client";

import { useState } from "react";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CalendarDays, ArrowRight, Clock, MapPin, User, Phone, Mail, CarFront, ImageOff, Wallet, Receipt, ShieldCheck, ClipboardCheck, History, AlertTriangle, Truck, UserRound, Gauge, Fuel, CheckCircle2, Circle, XCircle, Banknote, Landmark,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { isMoneyLine } from "@/lib/statement";
import { ShopPaymentsCard } from "./ShopPaymentsCard";

const TRIGGER = "gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none";
const label = (v) => (v ? String(v).replace(/_/g, " ") : null);
const imageUrl = (img) => (img?.attachment ? `/storage/${img.attachment.file_path}` : null);

// The happy path a booking walks; cancelled/rejected/expired branch off it.
const LIFECYCLE = [
  { key: "pending", label: "Requested", at: "created_at" },
  { key: "confirmed", label: "Confirmed", at: "confirmed_at" },
  { key: "active", label: "Handed over", at: "actual_pickup_at" },
  { key: "completed", label: "Returned", at: "actual_return_at" },
];
const ENDED = ["rejected", "expired", "cancelled_by_customer", "cancelled_by_owner", "cancelled_by_admin", "no_show"];

/**
 * The shop's view of one booking — vendor only (the platform has its own
 * BookingDetail in app/platform/bookings/components). Payments live in ShopPaymentsCard:
 * price breakdown and earnings in its Summary column, the deposit under History.
 */
export function VendorBookingDetail({ booking: b, actions, canEdit, onChanged }) {
  const [tab, setTab] = useState("overview");
  // Customer receipts the shop still has to check — surfaced above the tabs so they aren't missed.
  const pendingReceipts = (b.payments ?? []).filter((p) => p.method === "bank" && p.status === "pending").length;
  const { format } = useCurrencyFormat();
  const money = (v) => (v == null ? "—" : format(v));

  const pricing = b.pricing ?? {};
  const image = imageUrl(b.vehicle?.images?.[0]);
  const history = b.status_histories ?? [];
  const inspections = b.inspections ?? [];
  const damages = b.damages ?? [];
  const ended = ENDED.includes(b.status);
  const stage = LIFECYCLE.findIndex((s) => s.key === b.status);
  // Paid to the shop directly (cash / bank transfer), confirmed before money changes hands.
  const isBank = b.payment_method === "bank_transfer";
  // The vendor payload carries amount_paid / balance_due; summing the money lines is only a fallback.
  const amountPaid = b.amount_paid != null
    ? Number(b.amount_paid)
    : (b.payments ?? []).filter((p) => p.status === "succeeded" && isMoneyLine(p)).reduce((sum, p) => sum + Number(p.credit ?? 0) - Number(p.debit ?? 0), 0);
  const balanceDue = b.balance_due != null ? Number(b.balance_due) : Math.max(0, Number(pricing.total_payable ?? 0) - amountPaid);
  const lifecycle = LIFECYCLE;

  const stats = [
    { icon: Receipt, label: "Total payable", value: money(pricing.total_payable) },
    { icon: Banknote, label: "Paid to shop", value: money(amountPaid), sub: balanceDue <= 0 ? "fully paid" : `${money(balanceDue)} due` },
    { icon: Wallet, label: "You earn", value: money(pricing.subtotal), sub: null },
    { icon: ShieldCheck, label: "Security deposit", value: money(pricing.security_deposit), sub: label(b.security_deposit?.status) },
  ];

  const breakdown = [
    ["Rental", pricing.base_amount, pricing.rate_plan && `${label(pricing.rate_plan)} rate`],
    ["Driver", pricing.driver_amount],
    ["Delivery", pricing.delivery_amount],
    ["Extras", pricing.extras_amount],
    ["Weekend surcharge", pricing.weekend_surcharge_amount],
    ["Discount", pricing.discount_amount != null && Number(pricing.discount_amount) > 0 ? -pricing.discount_amount : null],
    ["Tax", pricing.tax_amount],
    ["Service fee", pricing.service_fee],
  ].filter(([, v]) => v != null && Number(v) !== 0);

  // Price breakdown and earnings — the Payments card's (narrow) Summary column.
  const paymentDetails = (
    <>
    <div className="grid gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Price breakdown</CardTitle><CardDescription>Locked when the booking was requested.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {breakdown.map(([l, v, sub]) => (
            <div key={l} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{l}{sub && <span className="ml-1 text-xs capitalize">({sub})</span>}</span>
              <span>{money(v)}</span>
            </div>
          ))}
          {pricing.security_deposit != null && Number(pricing.security_deposit) > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Security deposit</span><span>{money(pricing.security_deposit)}</span></div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total payable</span><span>{money(pricing.total_payable)}</span></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your earnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p>
              Paid <span className="font-medium">directly to the shop</span>{isBank ? " by bank transfer, with any balance in cash at pickup" : " in cash at pickup"} — {balanceDue <= 0 ? "fully received" : `${money(balanceDue)} still due`}.
            </p>
          </div>
          <Line l="Rental" v={money(pricing.subtotal)} />
          {Number(pricing.security_deposit) > 0 && <Line l="Refundable deposit" v={money(pricing.security_deposit)} />}
          {amountPaid > 0 && <Line l="Received so far" v={money(amountPaid)} />}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>{balanceDue <= 0 ? "Total received" : "Still due"}</span><span>{money(balanceDue <= 0 ? pricing.total_payable : balanceDue)}</span></div>
        </CardContent>
      </Card>
    </div>

    </>
  );


  // The security deposit card — in the vendor's Payments card it sits in the right column, under History.
  const depositDetails = b.security_deposit ? (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-base">Security deposit</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
        <Mini l="Required" v={money(b.security_deposit.amount_required)} />
        <Mini l="Collected" v={money(b.security_deposit.amount_collected)} />
        <Mini l="Deductions" v={money(b.security_deposit.deductions_amount)} />
        <Mini l="Status" v={label(b.security_deposit.status)} sub={label(b.security_deposit.hold_method)} />
        {b.security_deposit.collected_at && (
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Collected {formatDateTime(b.security_deposit.collected_at)}
            {b.security_deposit.released_at && <> · returned {money(Number(b.security_deposit.amount_collected) - Number(b.security_deposit.deductions_amount))} on {formatDateTime(b.security_deposit.released_at)}</>}
            {b.security_deposit.deduction_reason && <> · kept for: {b.security_deposit.deduction_reason}</>}
          </p>
        )}
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-3xl shadow-sm">
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex h-44 items-center justify-center bg-muted md:h-full">
            {image
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={image} alt={b.vehicle?.title} className="h-full w-full object-cover" />
              : <ImageOff className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{b.booking_reference}</span>
                  <StatusBadge status={b.status} />
                  {b.payment_status && <StatusBadge status={b.payment_status} />}
                  {b.has_open_dispute && <StatusBadge status="flagged" />}
                </div>
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{b.vehicle?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {[b.vehicle?.registration_number, label(b.vehicle?.transmission), label(b.vehicle?.fuel_type), b.vehicle?.seating_capacity && `${b.vehicle.seating_capacity} seats`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>

            {/* Trip strip */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border bg-muted/30 p-3 sm:p-4">
              <TripPoint label="Pickup" at={b.pickup_at} actual={b.actual_pickup_at} place={b.pickup_location?.name} />
              <div className="flex flex-col items-center text-center">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{b.rental_days} day{b.rental_days === 1 ? "" : "s"}</span>
                <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
              </div>
              <TripPoint label="Return" at={b.return_at} actual={b.actual_return_at} place={b.return_location?.name ?? b.pickup_location?.name} align="right" />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Chip icon={isBank ? Landmark : Banknote} tone={b.payment_status === "paid" ? undefined : "warn"}>
                {b.payment_status === "paid"
                  ? (isBank ? "Paid to shop" : "Paid in cash")
                  : isBank ? `Bank transfer · ${money(balanceDue)} due` : `Cash at pickup · ${money(balanceDue)}`}
              </Chip>
              {b.with_driver && <Chip icon={UserRound}>With driver</Chip>}
              {b.delivery_requested && <Chip icon={Truck}>Delivery requested</Chip>}
              <Chip icon={Clock}>Requested {formatDateTime(b.created_at)}</Chip>
              {b.status === "pending" && b.owner_response_deadline_at && <Chip icon={AlertTriangle} tone="warn">Respond by {formatDateTime(b.owner_response_deadline_at)}</Chip>}
            </div>
          </div>
        </div>
      </Card>

      {(b.rejection_reason || b.cancellation_reason) && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">{b.rejection_reason ? "Rejected" : "Cancelled"}</p>
            <p className="text-muted-foreground">{b.rejection_reason ?? b.cancellation_reason}</p>
          </div>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label: l, value, sub }) => (
          <Card key={l} className="rounded-2xl shadow-sm">
            <CardContent className="flex flex-col items-start gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-10"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="break-words text-base font-semibold leading-tight sm:text-lg">{value}</p>
                <p className="text-xs capitalize leading-snug text-muted-foreground">{l}{sub ? ` · ${sub}` : ""}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingReceipts > 0 && tab !== "payment" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {pendingReceipts === 1 ? "A bank transfer receipt is" : `${pendingReceipts} bank transfer receipts are`} waiting for you to verify.
          </p>
          <button type="button" onClick={() => setTab("payment")} className="font-medium text-amber-800 underline dark:text-amber-300">Review in Payment tab</button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-card p-1 sm:w-auto">
          <TabsTrigger value="overview" className={TRIGGER}><CalendarDays className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="payment" className={TRIGGER}><Wallet className="h-4 w-4" /> Payment {(b.payments?.length ?? 0) > 0 && <TabCount n={b.payments.length} />}</TabsTrigger>
          <TabsTrigger value="inspections" className={TRIGGER}><ClipboardCheck className="h-4 w-4" /> Inspections <TabCount n={inspections.length} /></TabsTrigger>
          <TabsTrigger value="history" className={TRIGGER}><History className="h-4 w-4" /> History <TabCount n={history.length} /></TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
                <CardContent>
                  {ended ? (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="capitalize">{label(b.status)}</span>
                      {b.cancelled_at && <span className="text-muted-foreground">· {formatDateTime(b.cancelled_at)}</span>}
                    </div>
                  ) : (
                    <ol className="grid gap-3 sm:grid-cols-5">
                      {lifecycle.map((s, i) => {
                        const done = i <= stage;
                        return (
                          <li key={s.key} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
                            {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />}
                            <div>
                              <p className={cn("text-xs font-medium", !done && "text-muted-foreground")}>{s.label}</p>
                              {done && b[s.at] && <p className="text-[11px] text-muted-foreground">{formatDateTime(b[s.at])}</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Trip details</CardTitle></CardHeader>
                <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <Row icon={CalendarDays} label="Scheduled pickup" value={formatDateTime(b.pickup_at)} />
                  <Row icon={CalendarDays} label="Scheduled return" value={formatDateTime(b.return_at)} />
                  <Row icon={Clock} label="Actual pickup" value={b.actual_pickup_at && formatDateTime(b.actual_pickup_at)} />
                  <Row icon={Clock} label="Actual return" value={b.actual_return_at && formatDateTime(b.actual_return_at)} />
                  <Row icon={MapPin} label="Pickup location" value={placeText(b.pickup_location) ?? b.pickup_address} />
                  <Row icon={MapPin} label="Return location" value={placeText(b.return_location) ?? placeText(b.pickup_location)} />
                  <Row icon={UserRound} label="Driver" value={b.with_driver ? "Included" : "Self-drive"} />
                  <Row icon={Truck} label="Delivery" value={b.delivery_requested ? "Requested" : "Pickup at branch"} />
                </CardContent>
              </Card>

              {(b.customer_note || b.owner_note) && (
                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {b.customer_note && <Note who="Customer" text={b.customer_note} />}
                    {b.owner_note && <Note who="Shop" text={b.owner_note} />}
                  </CardContent>
                </Card>
              )}
            </div>

            <aside className="space-y-5">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 font-semibold text-white">
                      {b.customer?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <p className="truncate font-medium">{b.customer?.name ?? "—"}</p>
                  </div>
                  {b.customer?.phone && <a href={`tel:${b.customer.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{b.customer.phone}</a>}
                  {b.customer?.email && <a href={`mailto:${b.customer.email}`} className="flex items-center gap-2 truncate text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{b.customer.email}</a>}
                </CardContent>
              </Card>


              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><CarFront className="h-4 w-4" /> Vehicle</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p className="font-medium">{b.vehicle?.title}</p>
                  <p className="text-xs text-muted-foreground">{[b.vehicle?.make, b.vehicle?.model, b.vehicle?.year].filter(Boolean).join(" · ")}</p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="mt-0 space-y-5">
          <ShopPaymentsCard booking={b} canEdit={canEdit} onChanged={onChanged} summaryExtra={paymentDetails} depositExtra={depositDetails} />
        </TabsContent>

        {/* Inspections */}
        <TabsContent value="inspections" className="mt-0 space-y-5">
          {inspections.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {inspections.map((ins) => (
                <Card key={ins.id} className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base capitalize">{label(ins.type)} inspection</CardTitle>
                    <CardDescription>{formatDateTime(ins.conducted_at ?? ins.created_at)}{ins.customer_present ? " · customer present" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <Mini icon={Gauge} l="Odometer" v={ins.odometer_reading != null ? `${Number(ins.odometer_reading).toLocaleString()} km` : null} />
                      <Mini icon={Fuel} l="Fuel level" v={label(ins.fuel_level)} />
                    </div>
                    {ins.notes && <Note who="Notes" text={ins.notes} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><Empty icon={ClipboardCheck} text="No handover or return recorded yet." /></CardContent></Card>
          )}

          {damages.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" /> Reported damage</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {damages.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{label(d.area)} <span className="text-xs font-normal text-muted-foreground">· {label(d.severity)}</span></p>
                      <p className="text-muted-foreground">{d.description}</p>
                    </div>
                    <div className="text-right text-xs">
                      {d.estimated_cost != null && <p>Est. {money(d.estimated_cost)}</p>}
                      {d.charged_amount != null && <p className="font-semibold">Charged {money(d.charged_amount)}</p>}
                      {d.status && <StatusBadge status={d.status} />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-0">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              {history.length ? (
                <ol className="relative space-y-5 border-l pl-6">
                  {history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[31px] top-1 size-3 rounded-full bg-primary ring-4 ring-card" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {h.field === "dates" ? (
                          // Values are whole "pickup → return" ranges, so show them as from/to lines rather than one arrow chain.
                          <div className="text-sm">
                            <p className="font-medium">Dates changed</p>
                            <p className="text-xs text-muted-foreground">From {h.from_value}</p>
                            <p className="text-xs">To {h.to_value}</p>
                          </div>
                        ) : (
                          <p className="text-sm font-medium capitalize">
                            {h.from_value ? <>{label(h.from_value)} <span className="text-muted-foreground">→</span> </> : null}{label(h.to_value)}
                            {h.field && h.field !== "status" && <span className="ml-1 text-xs font-normal text-muted-foreground">({label(h.field)})</span>}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                      </div>
                      <p className="text-xs capitalize text-muted-foreground">by {label(h.actor_type) ?? "system"}</p>
                      {h.reason && <p className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm">{h.reason}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty icon={History} text="No status changes yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes (platform) */}
      </Tabs>
    </div>
  );
}

function placeText(loc) {
  if (!loc) return null;
  return [loc.name, loc.city].filter(Boolean).join(" · ") || null;
}

function TripPoint({ label: l, at, actual, place, align }) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
      <p className="text-sm font-semibold leading-snug">{formatDateTime(at)}</p>
      {place && <p className="break-words text-xs text-muted-foreground">{place}</p>}
      {actual && <p className="text-[11px] leading-snug text-emerald-600">Actual {formatDateTime(actual)}</p>}
    </div>
  );
}

function Chip({ icon: Icon, tone, children }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
      tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "bg-background text-muted-foreground",
    )}>
      <Icon className="h-3 w-3" />{children}
    </span>
  );
}

function Row({ icon: Icon, label: l, value }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
        <p className={cn("truncate text-sm", !value && "italic text-muted-foreground/60")}>{value || "—"}</p>
      </div>
    </div>
  );
}

function Line({ l, v, strong }) {
  return <div className={cn("flex justify-between gap-3", strong && "font-medium")}><span className="text-muted-foreground">{l}</span><span>{v}</span></div>;
}

function Mini({ icon: Icon, l, v, sub }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">{Icon && <Icon className="h-3 w-3" />}{l}</p>
      <p className={cn("text-sm font-semibold capitalize", !v && "font-normal italic text-muted-foreground/60")}>{v || "—"}</p>
      {sub && <p className="text-xs capitalize text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Note({ who, text }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{who}</p>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  );
}

function TabCount({ n }) {
  return <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{n}</span>;
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6" /> {text}
    </div>
  );
}
