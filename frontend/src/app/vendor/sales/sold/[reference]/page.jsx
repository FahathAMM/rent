"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { FileText, Home, Loader2 } from "lucide-react";
import { formatDateTime, openBlob } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_LABELS = { cash: "Cash", bank_transfer: "Bank transfer", lease: "Lease", other: "Other" };

function Field({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children || "—"}</dd>
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

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
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

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{sale.vehicle?.title ?? "Vehicle"}</h1>
          <p className="text-sm text-muted-foreground">{sale.reference}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={openAgreement}><FileText className="h-4 w-4" />Sale agreement</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 font-semibold">The deal</h2>
          <dl className="divide-y">
            <Field label="Sale price">{format(sale.sale_price)}</Field>
            <Field label="Paid by">{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</Field>
            <Field label="Sold">{formatDateTime(sale.sold_at)}</Field>
            <Field label="Recorded by">{sale.recorded_by?.name}</Field>
          </dl>
        </section>
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 font-semibold">The buyer</h2>
          <dl className="divide-y">
            <Field label="Name">{sale.buyer_name}</Field>
            <Field label="Phone">{sale.buyer_phone}</Field>
            <Field label="NIC">{sale.buyer_nic}</Field>
            <Field label="Address">{sale.buyer_address}</Field>
          </dl>
        </section>
      </div>
    </HomePageWrapper>
  );
}
