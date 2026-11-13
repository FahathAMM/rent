"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, BadgeDollarSign, CalendarCheck, CarFront, CreditCard, Download, FileSignature, FileText,
  Gauge, Home, Loader2, MapPin, MessageSquare, Phone, ShieldCheck, Tag, User, UserCheck,
} from "lucide-react";
import { formatDateTime, openBlob } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_LABELS = { cash: "Cash", bank_transfer: "Bank transfer", lease: "Lease", other: "Other" };
const CONDITION_LABELS = { brand_new: "Brand new", reconditioned: "Reconditioned", used: "Used" };

function titleCase(value) {
  return value ? String(value).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "";
}

function Field({ icon: Icon, label, children, mono }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex items-start gap-3 py-2.5 text-sm">
      {Icon && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className={`break-words font-medium ${mono ? "font-mono text-xs" : ""} ${empty ? "text-muted-foreground" : ""}`}>
          {empty ? "—" : children}
        </dd>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      <dl className="divide-y px-4 sm:px-5">{children}</dl>
    </section>
  );
}

function SummaryTile({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold leading-tight tracking-tight">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export default function SaleDetailPage() {
  const { reference } = useParams();
  const { format } = useCurrencyFormat();

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ["vendor-sale", reference],
    queryFn: () => vendorService.sales.sold.getOne(reference).then((r) => r.data.data),
    retry: false,
  });

  const openAgreement = () => {
    const tab = window.open("", "_blank");
    vendorService.sales.sold.agreement(reference)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the sale agreement"); });
  };

  const downloadAgreement = () => {
    vendorService.sales.sold.agreement(reference)
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const a = Object.assign(document.createElement("a"), { href: url, download: `${reference}.pdf` });
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Could not download the sale agreement"));
  };

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Sold", href: "/vendor/sales/sold" },
    { label: reference },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError || !sale) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-semibold">Sale not found</p>
        <Button asChild variant="outline"><Link href="/vendor/sales/sold">Back to sold vehicles</Link></Button>
      </div>
    );
  }

  const vehicle = sale.vehicle ?? {};
  const detail = vehicle.sale_detail ?? null;
  const asking = detail?.price != null ? Number(detail.price) : null;
  const price = Number(sale.sale_price);
  const diff = asking != null ? price - asking : null;
  const diffPct = asking ? Math.round((Math.abs(diff) / asking) * 100) : null;
  const spec = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ");
  const signed = !!sale.terms_accepted_at;

  const priceHint = diff == null
    ? "No asking price on record"
    : diff === 0
      ? `Sold at asking price (${format(asking)})`
      : diff < 0
        ? `${format(Math.abs(diff))} below asking${diffPct ? ` (${diffPct}%)` : ""}`
        : `${format(diff)} above asking${diffPct ? ` (${diffPct}%)` : ""}`;

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="space-y-4 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <Link href="/vendor/sales/sold" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sold vehicles
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold">{vehicle.title ?? "Vehicle"}</h1>
            <StatusBadge status="sold" />
          </div>
          <p className="text-sm text-muted-foreground">
            {spec && <span>{spec} · </span>}
            <span className="font-mono text-xs">{sale.reference}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={downloadAgreement}><Download className="h-4 w-4" />Download</Button>
          <Button className="gap-2" onClick={openAgreement}><FileText className="h-4 w-4" />Open agreement</Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Sale price" value={format(price)} hint={priceHint} icon={BadgeDollarSign} tone="bg-emerald-100 text-emerald-700" />
        <SummaryTile label="Paid by" value={PAYMENT_LABELS[sale.payment_method] ?? titleCase(sale.payment_method)} hint="Payment method" icon={CreditCard} tone="bg-sky-100 text-sky-700" />
        <SummaryTile label="Sold on" value={formatDateTime(sale.sold_at)} hint={sale.recorded_by?.name ? `Recorded by ${sale.recorded_by.name}` : undefined} icon={CalendarCheck} tone="bg-amber-100 text-amber-700" />
        <SummaryTile
          label="Agreement"
          value={signed ? "Signed" : "Not signed"}
          hint={signed ? formatDateTime(sale.terms_accepted_at) : "No sale terms were in force"}
          icon={signed ? ShieldCheck : FileSignature}
          tone={signed ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}
        />
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Section icon={CarFront} title="Vehicle" subtitle="As listed at the time of sale">
          <Field icon={Tag} label="Listing">{vehicle.title}</Field>
          <Field icon={CarFront} label="Make, model & year">{spec}</Field>
          <Field icon={ShieldCheck} label="Registration" mono>{vehicle.registration_number}</Field>
          <Field icon={Gauge} label="Mileage">{detail?.mileage_km != null ? `${Number(detail.mileage_km).toLocaleString()} km` : ""}</Field>
          <Field icon={Tag} label="Condition">{CONDITION_LABELS[detail?.condition] ?? titleCase(detail?.condition)}</Field>
          <Field icon={BadgeDollarSign} label="Asking price">
            {asking != null && (
              <span className="inline-flex flex-wrap items-center gap-2">
                {format(asking)}
                {detail?.is_negotiable && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Negotiable</Badge>}
              </span>
            )}
          </Field>
          <Field icon={Gauge} label="Drivetrain">{[titleCase(vehicle.transmission), titleCase(vehicle.fuel_type)].filter(Boolean).join(" · ")}</Field>
        </Section>

        <Section
          icon={User}
          title="Buyer"
          subtitle={sale.customer ? "Has a LankaLane account" : "Walk-in buyer"}
          action={sale.customer && <Badge variant="outline" className="gap-1 text-[10px]"><UserCheck className="h-3 w-3" />Customer</Badge>}
        >
          <Field icon={User} label="Name">{sale.buyer_name}</Field>
          <Field icon={Phone} label="Phone">
            {sale.buyer_phone && <a href={`tel:${sale.buyer_phone}`} className="hover:underline">{sale.buyer_phone}</a>}
          </Field>
          <Field icon={ShieldCheck} label="NIC" mono>{sale.buyer_nic}</Field>
          <Field icon={MapPin} label="Address">{sale.buyer_address}</Field>
          {sale.customer && <Field icon={UserCheck} label="Account email">{sale.customer.email}</Field>}
          <Field icon={MessageSquare} label="Came through">
            {sale.enquiry ? (
              <Link href={`/vendor/sales/enquiries/${sale.enquiry.reference}`} className="text-primary hover:underline">
                Enquiry {sale.enquiry.reference}
              </Link>
            ) : (
              "Direct sale, no enquiry"
            )}
          </Field>
        </Section>

        <Section
          icon={FileSignature}
          title="Agreement"
          subtitle="The signed sale agreement PDF"
          action={<Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openAgreement}><FileText className="h-3.5 w-3.5" />Open</Button>}
        >
          <Field icon={FileText} label="Reference" mono>{sale.reference}</Field>
          <Field icon={CalendarCheck} label="Sold on">{formatDateTime(sale.sold_at)}</Field>
          <Field icon={UserCheck} label="Recorded by">{sale.recorded_by?.name}</Field>
          <Field icon={ShieldCheck} label="Terms accepted">
            {signed ? formatDateTime(sale.terms_accepted_at) : <span className="text-muted-foreground">No terms were set when this sale was recorded</span>}
          </Field>
          <Field icon={FileSignature} label="Buyer signature">{signed ? "Captured on the agreement" : "Not required"}</Field>
          <Field icon={CalendarCheck} label="Recorded at">{formatDateTime(sale.created_at)}</Field>
        </Section>
      </div>
    </HomePageWrapper>
  );
}
