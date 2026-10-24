"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { disputeService } from "@/services/disputeService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextareaInput } from "@/components/forms/FormField";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function DisputeDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: dispute, isLoading } = useQuery({
    queryKey: ["my-dispute", reference],
    queryFn: () => disputeService.getOne(reference).then((r) => r.data.data),
  });

  const send = useMutation({
    mutationFn: () => disputeService.addMessage(reference, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-dispute", reference] });
      setDraft("");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to send message"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!dispute) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-semibold">Dispute not found</p>
        <Button asChild variant="outline"><Link href="/account/disputes">Back to disputes</Link></Button>
      </div>
    );
  }

  const canReply = !["resolved", "closed"].includes(dispute.status);

  return (
    <div className="space-y-4">
      <Link href="/account/disputes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to disputes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{dispute.subject}</h1>
          <p className="text-sm text-muted-foreground">{dispute.dispute_reference} · Booking {dispute.booking?.booking_reference}</p>
        </div>
        <StatusBadge status={dispute.status} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-muted-foreground">{dispute.description}</p>
          {dispute.claimed_amount && <p className="mt-2"><span className="text-muted-foreground">Claimed amount: </span>{dispute.claimed_amount}</p>}
        </CardContent>
      </Card>

      {dispute.resolution && (
        <Card className="border-emerald-400/60">
          <CardHeader><CardTitle className="text-base">Resolution</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{dispute.resolution}</p>
            <p className="text-xs text-muted-foreground">In favour of: {dispute.resolution_in_favour_of}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Messages</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!dispute.messages?.length ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            dispute.messages.map((m) => (
              <div key={m.id} className="rounded-md bg-muted p-3 text-sm">
                <p className="text-xs font-semibold capitalize text-muted-foreground">{m.author_type.replace("_", " ")} · {formatDateTime(m.created_at)}</p>
                <p>{m.message}</p>
              </div>
            ))
          )}

          {canReply && (
            <div className="flex items-end gap-2 pt-2">
              <TextareaInput className="flex-1" placeholder="Add a message..." value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button size="icon" onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending}>
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
