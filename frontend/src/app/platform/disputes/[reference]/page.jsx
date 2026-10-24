"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformDisputeService } from "@/services/platformDisputeService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Home, Loader2, Send } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const FAVOUR_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "owner", label: "Owner" },
  { value: "split", label: "Split" },
  { value: "none", label: "None" },
];

function ResolveDialog({ open, onOpenChange, disputeId, onDone }) {
  const [form, setForm] = useState({ resolution: "", resolution_amount: "", resolution_in_favour_of: "", close: true });

  const resolve = useMutation({
    mutationFn: () => platformDisputeService.resolve(disputeId, { ...form, resolution_amount: form.resolution_amount || undefined }),
    onSuccess: () => { toast.success("Dispute resolved"); onDone(); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to resolve"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <TextareaInput label="Resolution" required rows={4} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
          <SelectInput label="In favour of" required options={FAVOUR_OPTIONS} value={form.resolution_in_favour_of} onChange={(v) => setForm({ ...form, resolution_in_favour_of: v })} />
          <TextareaInput label="Resolution amount (optional)" value={form.resolution_amount} onChange={(e) => setForm({ ...form, resolution_amount: e.target.value })} />
          <div className="flex items-center gap-2">
            <Checkbox checked={form.close} onCheckedChange={(v) => setForm({ ...form, close: !!v })} />
            <span className="text-sm">Close the dispute</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => resolve.mutate()} disabled={!form.resolution || !form.resolution_in_favour_of || resolve.isPending}>
            {resolve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformDisputeDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolving, setResolving] = useState(false);

  const { data: dispute, isLoading } = useQuery({
    queryKey: ["platform-dispute", reference],
    queryFn: () => platformDisputeService.getOne(reference).then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-dispute", reference] });

  const assign = useMutation({
    mutationFn: () => platformDisputeService.assign(dispute.id),
    onSuccess: () => { invalidate(); toast.success("Assigned to you"); },
  });

  const send = useMutation({
    mutationFn: () => platformDisputeService.addMessage(dispute.id, draft, internal),
    onSuccess: () => { invalidate(); setDraft(""); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to send message"),
  });

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Disputes", href: "/platform/disputes" },
    { label: reference },
  ];

  if (isLoading || !dispute) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </PageWrapper>
    );
  }

  const canAct = !["resolved", "closed"].includes(dispute.status);

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title={dispute.subject}
        description={`${dispute.dispute_reference} · Booking ${dispute.booking?.booking_reference} · Raised by ${dispute.raised_by?.name} (${dispute.raised_by_side})`}
        action={
          canAct && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => assign.mutate()} disabled={assign.isPending}>Assign to me</Button>
              <Button onClick={() => setResolving(true)}>Resolve</Button>
            </div>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={dispute.status} />
        <span className="text-sm text-muted-foreground capitalize">{dispute.category.replace("_", " ")} · {dispute.priority} priority</span>
        {dispute.claimed_amount && <span className="text-sm text-muted-foreground">Claimed: {dispute.claimed_amount}</span>}
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{dispute.description}</CardContent>
      </Card>

      {dispute.resolution && (
        <Card className="mb-4 border-emerald-400/60">
          <CardHeader><CardTitle className="text-base">Resolution</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{dispute.resolution}</p>
            <p className="text-xs text-muted-foreground">In favour of: {dispute.resolution_in_favour_of} · Resolved by {dispute.resolved_by?.name}</p>
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
              <div key={m.id} className={`rounded-md p-3 text-sm ${m.is_internal ? "bg-amber-50 border border-amber-200" : "bg-muted"}`}>
                <p className="text-xs font-semibold capitalize text-muted-foreground">
                  {m.author_type.replace("_", " ")} · {formatDateTime(m.created_at)} {m.is_internal && "· internal"}
                </p>
                <p>{m.message}</p>
              </div>
            ))
          )}

          {canAct && (
            <div className="space-y-2 pt-2">
              <TextareaInput placeholder="Add a message..." value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
                  Internal note (not visible to customer/owner)
                </label>
                <Button onClick={() => send.mutate()} disabled={!draft.trim() || send.isPending} className="gap-1.5">
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ResolveDialog
        open={resolving}
        onOpenChange={setResolving}
        disputeId={dispute.id}
        onDone={() => { invalidate(); setResolving(false); }}
      />
    </PageWrapper>
  );
}
