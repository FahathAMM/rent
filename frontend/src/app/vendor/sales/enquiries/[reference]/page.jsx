"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BadgeDollarSign, Home, Loader2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { RecordSaleDialog } from "../../components/RecordSaleDialog";

export default function SaleEnquiryDetailPage() {
  const { reference } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const { format } = useCurrencyFormat();
  const [body, setBody] = useState("");
  const [selling, setSelling] = useState(false);

  const { data: enquiry, isLoading, isError } = useQuery({
    queryKey: ["vendor-sale-enquiry", reference],
    queryFn: () => vendorService.sales.enquiries.getOne(reference).then((r) => r.data.data),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["vendor-sale-enquiry", reference] });

  const reply = useMutation({
    mutationFn: () => vendorService.sales.enquiries.reply(reference, body.trim()),
    onSuccess: () => { setBody(""); refresh(); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not send your reply"),
  });

  const close = useMutation({
    mutationFn: () => vendorService.sales.enquiries.close(reference),
    onSuccess: () => { refresh(); toast.success("Enquiry closed"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not close the enquiry"),
  });

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Enquiries", href: "/vendor/sales/enquiries" },
    { label: reference },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError || !enquiry) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-semibold">Enquiry not found</p>
        <Button asChild variant="outline"><Link href="/vendor/sales/enquiries">Back to enquiries</Link></Button>
      </div>
    );
  }

  const open = ["new", "replied"].includes(enquiry.status);
  const canReply = can("vendor-sales-enquiries-edit");
  const vehicle = enquiry.vehicle;
  const sellable = vehicle && vehicle.sale_status !== "sold" && can("vendor-sales-sold-create");

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="space-y-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-bold">{vehicle?.title ?? "Vehicle"}</h1><StatusBadge status={enquiry.status} /></div>
          <p className="text-sm text-muted-foreground">{enquiry.reference}{vehicle?.price != null ? ` · Asking ${format(vehicle.price)}` : ""}</p>
          <p className="text-sm">
            {enquiry.customer?.name}
            <span className="text-muted-foreground">{[enquiry.customer?.phone, enquiry.customer?.email].filter(Boolean).map((v) => ` · ${v}`).join("")}</span>
          </p>
        </div>
        {sellable && <Button className="gap-2" onClick={() => setSelling(true)}><BadgeDollarSign className="h-4 w-4" />Record sale</Button>}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-semibold">Conversation</h2>
        <div className="space-y-3">
          {(enquiry.messages ?? []).map((m) => {
            const mine = m.sender_type === "shop";
            return (
              <article key={m.id} className={`max-w-3xl rounded-xl border p-3.5 ${mine ? "ml-auto border-primary/20 bg-primary/5" : "bg-muted/40"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">{mine ? "Your shop" : enquiry.customer?.name ?? "Buyer"}</span>
                  <time className="text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {!open ? (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">This enquiry is closed{enquiry.closed_reason ? `: ${enquiry.closed_reason}` : ""}.</p>
      ) : canReply && (
        <form className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" onSubmit={(e) => { e.preventDefault(); if (body.trim() && !reply.isPending) reply.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="enquiry-reply">Your reply</Label>
            <Textarea id="enquiry-reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={3} placeholder="Answer the buyer or suggest a time to see the car…" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => close.mutate()} disabled={close.isPending}>Close enquiry</Button>
            <Button type="submit" disabled={!body.trim() || reply.isPending}>
              {reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send reply
            </Button>
          </div>
        </form>
      )}

      {selling && (
        <RecordSaleDialog
          vehicle={vehicle}
          enquiry={enquiry}
          onClose={() => setSelling(false)}
          onRecorded={(sale) => router.push(`/vendor/sales/sold/${sale.reference}`)}
        />
      )}
    </HomePageWrapper>
  );
}
