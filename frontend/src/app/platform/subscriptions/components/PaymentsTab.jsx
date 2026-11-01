"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, X } from "lucide-react";
import { platformService } from "@/services/platformService";
import platformApi from "@/lib/platformAxios";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { formatDateTime, getInitials, openBlob } from "@/lib/utils";
import { SUBSCRIPTION_STATS_KEY } from "./StatsRow";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending", label: "Waiting to check" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** Shops' transfers for a plan — open the receipt, then approve (plan starts / extends) or reject. */
export function PaymentsTab({ status, onStatusChange }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [rejecting, setRejecting] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: SUBSCRIPTION_STATS_KEY });
  };

  const approve = useMutation({
    mutationFn: (id) => platformService.subscriptions.approve(id),
    onSuccess: (res) => { toast.success(res.data.message ?? "Payment approved"); reload(); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not approve"),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }) => platformService.subscriptions.reject(id, reason),
    onSuccess: () => { toast.success("Payment rejected"); setRejecting(null); reload(); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not reject"),
  });

  const viewProof = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const res = await platformService.subscriptions.proof(id);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Could not open the receipt");
    }
  };

  const columns = () => [
    {
      accessorKey: "shop", header: "Shop", style: { width: "28%" },
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5 py-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary">{getInitials(row.shop?.name ?? "?")}</span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.shop?.name}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{row.reference_no}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "plan", header: "Plan",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{row.plan?.name}</span>
          <span className="text-[11px] text-muted-foreground">× {row.periods}</span>
        </div>
      ),
    },
    { accessorKey: "amount", header: "Amount", cell: (row) => <span className="tabular-nums font-semibold">{format(row.amount)}</span> },
    {
      accessorKey: "created_at", header: "Sent",
      cell: (row) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap">{formatDateTime(row.created_at)}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {row.bank_reference ? `Ref ${row.bank_reference}` : "No bank reference"}{row.submitter?.name ? ` · ${row.submitter.name}` : ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status", header: "Status",
      cell: (row) => (
        <div className="min-w-0">
          <StatusBadge status={row.status} />
          {row.status !== "pending" && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {row.reviewer?.name ? `${row.reviewer.name} · ` : ""}{row.reviewed_at ? formatDateTime(row.reviewed_at) : ""}
            </p>
          )}
          {row.reject_reason && <p className="truncate text-[10px] text-destructive">{row.reject_reason}</p>}
        </div>
      ),
    },
    {
      accessorKey: "actions", header: "",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => viewProof(row.id)}><FileText className="h-3.5 w-3.5" /> Receipt</Button>
          {row.status === "pending" && (
            <>
              <Button size="sm" className="h-7 gap-1 bg-emerald-600 px-2 text-xs hover:bg-emerald-700" onClick={() => approve.mutate(row.id)} disabled={approve.isPending}><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button size="icon" variant="outline" className="h-7 w-7 border-destructive/40 text-destructive hover:bg-destructive/10" title="Reject" onClick={() => setRejecting(row)}><X className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ServerDataTable
        key={`${refreshKey}-${status}`}
        api={platformApi}
        endpoint="/platform/subscription-payments"
        columns={columns}
        breadcrumb={[]}
        searchable
        filters={{ status: status || undefined }}
      >
        <FilterSelect value={status} onChange={onStatusChange} options={STATUS_OPTIONS} allLabel="All payments" />
      </ServerDataTable>

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Reject payment"
        description={rejecting ? `${rejecting.shop?.name} · ${format(rejecting.amount)}. The shop sees this reason and can send a new receipt.` : ""}
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ id: rejecting.id, reason })}
      />
    </>
  );
}
