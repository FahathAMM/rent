"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft, Loader2, Send, MessageSquareText } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_LABELS = {
  damage: "Damage", no_show: "No show", overcharge: "Overcharge", vehicle_condition: "Vehicle condition",
  refund: "Refund", late_return: "Late return", fraud: "Fraud", other: "Other",
};
const canReply = (status) => !["resolved", "closed"].includes(status);
const authorLabel = (type) => type === "customer" ? "You" : ["owner", "staff"].includes(type) ? "Shop" : type === "system_admin" ? "Platform team" : "Update";

export default function AccountDisputeDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const { data: dispute, isLoading, isError } = useQuery({
    queryKey: ["my-dispute", reference],
    queryFn: () => customerService.disputes.getOne(reference).then((r) => r.data.data),
  });

  const reply = useMutation({
    mutationFn: () => customerService.disputes.addMessage(reference, message.trim()),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-dispute", reference] });
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
      toast.success("Reply sent");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not send your reply"),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError || !dispute) {
    return <div className="space-y-4"><Link href="/account/disputes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to disputes</Link><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Dispute not found, or it isn&apos;t available to your account.</div></div>;
  }

  const booking = dispute.booking;

  return (
    <div className="space-y-4">
      <Link href="/account/disputes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to disputes</Link>
      <AccountPageHeader icon={AlertTriangle} title={dispute.subject} description={`${dispute.dispute_reference} · Booking ${booking?.booking_reference ?? "—"}`} action={<StatusBadge status={dispute.status} />} />

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{CATEGORY_LABELS[dispute.category] ?? dispute.category}</span>
          <span>Raised against {dispute.against_side === "owner" ? "the shop" : "the platform"}</span>
          {booking?.vehicle?.title && <span>{booking.vehicle.title}</span>}
          {booking?.shop?.name && <span>{booking.shop.name}</span>}
          <span>Opened {formatDateTime(dispute.created_at)}</span>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{dispute.description}</p>
        {Number(dispute.claimed_amount) > 0 && <p className="mt-3 text-sm font-medium">Claimed amount: {Number(dispute.claimed_amount).toLocaleString()}</p>}
        {dispute.resolution && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-sm font-semibold">Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{dispute.resolution}</p></div>}
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4 text-primary" />Conversation</h2>
        {(dispute.messages ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No replies yet. Add a message if you have more information.</p>
        ) : (
          <div className="space-y-3">
            {dispute.messages.map((m) => {
              const mine = m.author_type === "customer";
              return <article key={m.id} className={`max-w-3xl rounded-xl border p-3.5 ${mine ? "ml-auto border-primary/20 bg-primary/5" : "bg-muted/40"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-xs font-semibold">{authorLabel(m.author_type)}</span><time className="text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</time></div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
              </article>;
            })}
          </div>
        )}
      </section>

      {canReply(dispute.status) ? (
        <form className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" onSubmit={(e) => { e.preventDefault(); if (message.trim() && !reply.isPending) reply.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="dispute-reply">Your reply</Label><Textarea id="dispute-reply" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={4} placeholder="Add details or answer a question…" /></div>
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{message.length}/5000 characters</p><Button type="submit" disabled={!message.trim() || reply.isPending}>{reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send reply</Button></div>
        </form>
      ) : (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">This dispute is closed. Contact support if you need help with the outcome.</p>
      )}
    </div>
  );
}
