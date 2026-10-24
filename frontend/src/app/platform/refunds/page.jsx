"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformRefundService } from "@/services/platformRefundService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Plus, Home, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

const TYPE_OPTIONS = [
  { value: "cancellation", label: "Cancellation" },
  { value: "deposit_return", label: "Deposit return" },
  { value: "overcharge", label: "Overcharge" },
  { value: "damage_waiver", label: "Damage waiver" },
  { value: "goodwill", label: "Goodwill" },
  { value: "chargeback", label: "Chargeback" },
  { value: "no_show_partial", label: "No-show partial" },
];

const METHOD_OPTIONS = [
  { value: "gateway", label: "Gateway" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_note", label: "Credit note" },
];

function CreateDialog({ open, onOpenChange, onDone }) {
  const [form, setForm] = useState({ booking_reference: "", amount: "", type: "goodwill", reason: "", method: "bank_transfer" });
  const [errors, setErrors] = useState({});

  const create = useMutation({
    mutationFn: () => platformRefundService.create(form),
    onSuccess: () => { toast.success("Refund recorded"); onDone(); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record a Refund</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ValidationError errors={errors} />
          <TextInput label="Booking reference" required value={form.booking_reference} onChange={(e) => setForm({ ...form, booking_reference: e.target.value })} error={errors.booking_reference?.[0]} />
          <TextInput label="Amount" required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount?.[0]} />
          <SelectInput label="Type" required options={TYPE_OPTIONS} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          <SelectInput label="Method" required options={METHOD_OPTIONS} value={form.method} onChange={(v) => setForm({ ...form, method: v })} />
          <TextInput label="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.booking_reference || !form.amount || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ refund, onOpenChange, onDone }) {
  const [form, setForm] = useState({ gateway_refund_id: "", evidence_reference: "" });
  const [errors, setErrors] = useState({});

  const complete = useMutation({
    mutationFn: () => platformRefundService.complete(refund.id, form),
    onSuccess: () => { toast.success("Refund marked complete"); onDone(); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  return (
    <Dialog open={!!refund} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Complete Refund #{refund?.id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ValidationError errors={errors} />
          <p className="text-sm text-muted-foreground">Either field below is required — this is evidence the money actually moved.</p>
          <TextInput label="Gateway refund id" value={form.gateway_refund_id} onChange={(e) => setForm({ ...form, gateway_refund_id: e.target.value })} error={errors.gateway_refund_id?.[0]} />
          <TextInput label="Evidence reference" value={form.evidence_reference} onChange={(e) => setForm({ ...form, evidence_reference: e.target.value })} error={errors.evidence_reference?.[0]} />
        </div>
        <DialogFooter>
          <Button onClick={() => complete.mutate()} disabled={complete.isPending}>
            {complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformRefundsPage() {
  const { format } = useCurrencyFormat();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-refunds", status],
    queryFn: () => platformRefundService.getAll({ status: status || undefined }).then((r) => r.data.record),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-refunds"] });

  const approve = useMutation({
    mutationFn: (id) => platformRefundService.approve(id),
    onSuccess: () => { invalidate(); toast.success("Refund approved"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => platformRefundService.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success("Refund rejected"); setRejecting(null); },
  });

  const columns = [
    { key: "refund_reference", header: "Reference", render: (row) => <span className="font-mono text-xs">{row.refund_reference}</span> },
    { key: "booking", header: "Booking", render: (row) => row.booking?.booking_reference ?? "—" },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type.replace("_", " ")}</span> },
    { key: "amount", header: "Amount", render: (row) => format(row.amount) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "created_at", header: "Requested", render: (row) => formatDateTime(row.created_at) },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.status === "requested" && (
            <>
              <Button size="sm" onClick={() => approve.mutate(row.id)} disabled={approve.isPending}>Approve</Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setRejecting(row)}>Reject</Button>
            </>
          )}
          {row.status === "approved" && (
            <Button size="sm" onClick={() => setCompleting(row)}>Mark Complete</Button>
          )}
        </div>
      ),
    },
  ];

  const records = data?.data ?? [];
  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Refunds" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Refunds"
          description="Manual settlement — PayHere's refund API is unconfirmed, so completion requires recorded evidence."
          action={<Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Record Refund</Button>}
        />

        <div className="mb-4 w-56">
          <SelectInput label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>

        <DataTable columns={columns} data={records} loading={isLoading} />
      </PageWrapper>

      <CreateDialog open={creating} onOpenChange={setCreating} onDone={() => { invalidate(); setCreating(false); }} />
      <CompleteDialog refund={completing} onOpenChange={(v) => !v && setCompleting(null)} onDone={() => { invalidate(); setCompleting(null); }} />
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Reject Refund"
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ id: rejecting.id, reason })}
      />
    </div>
  );
}
