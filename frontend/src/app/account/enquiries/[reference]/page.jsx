"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Loader2, MessageCircle, Send } from "lucide-react";
import { formatDateTime, openBlob } from "@/lib/utils";
import { toast } from "sonner";

export default function AccountEnquiryDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [body, setBody] = useState("");

  const { data: enquiry, isLoading, isError } = useQuery({
    queryKey: ["my-enquiry", reference],
    queryFn: () => customerService.enquiries.getOne(reference).then((r) => r.data.data),
    retry: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-enquiry", reference] });
    qc.invalidateQueries({ queryKey: ["my-enquiries"] });
  };

  const reply = useMutation({
    mutationFn: () => customerService.enquiries.reply(reference, body.trim()),
    onSuccess: () => { setBody(""); refresh(); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not send your message"),
  });

  const close = useMutation({
    mutationFn: () => customerService.enquiries.close(reference),
    onSuccess: () => { refresh(); toast.success("Enquiry closed"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not close the enquiry"),
  });

  const openAgreement = () => {
    const tab = window.open("", "_blank");
    customerService.enquiries.agreement(reference)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the sale agreement"); });
  };

  const back = <Link href="/account/enquiries" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to enquiries</Link>;

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError || !enquiry) {
    return <div className="space-y-4">{back}<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Enquiry not found, or it isn&apos;t available to your account.</div></div>;
  }

  const open = ["new", "replied"].includes(enquiry.status);
  const vehicle = enquiry.vehicle;

  return (
    <div className="space-y-4">
      {back}
      <AccountPageHeader icon={MessageCircle} title={vehicle?.title ?? "Enquiry"} description={`${enquiry.reference}${enquiry.shop?.name ? ` · ${enquiry.shop.name}` : ""}`} action={<StatusBadge status={enquiry.status} />} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="min-w-0">
          {vehicle?.price != null && <p className="font-semibold">{format(vehicle.price)}</p>}
          {vehicle?.sale_status === "available" ? (
            <Link href={`/buy/${vehicle.slug}`} className="text-sm text-primary hover:underline">View the listing</Link>
          ) : (
            <p className="text-sm text-muted-foreground">No longer on sale</p>
          )}
        </div>
        {enquiry.sale && (
          <Button variant="outline" onClick={openAgreement} className="gap-2"><FileText className="h-4 w-4" />Sale agreement</Button>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-semibold">Conversation</h2>
        <div className="space-y-3">
          {(enquiry.messages ?? []).map((m) => {
            const mine = m.sender_type === "customer";
            return (
              <article key={m.id} className={`max-w-3xl rounded-xl border p-3.5 ${mine ? "ml-auto border-primary/20 bg-primary/5" : "bg-muted/40"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">{mine ? "You" : enquiry.shop?.name ?? "Shop"}</span>
                  <time className="text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {open ? (
        <form className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" onSubmit={(e) => { e.preventDefault(); if (body.trim() && !reply.isPending) reply.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="enquiry-reply">Your message</Label>
            <Textarea id="enquiry-reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={3} placeholder="Ask a question or arrange a time to see the car…" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => close.mutate()} disabled={close.isPending}>Close enquiry</Button>
            <Button type="submit" disabled={!body.trim() || reply.isPending}>
              {reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">This enquiry is closed{enquiry.closed_reason ? `: ${enquiry.closed_reason}` : ""}.</p>
      )}
    </div>
  );
}
