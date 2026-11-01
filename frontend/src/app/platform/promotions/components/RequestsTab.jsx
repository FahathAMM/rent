"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Megaphone, Square, Star, X } from "lucide-react";
import { platformService } from "@/services/platformService";
import platformApi from "@/lib/platformAxios";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, openBlob } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending", label: "Waiting to check" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
  { value: "rejected", label: "Rejected" },
];
const TYPE_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "sponsored", label: "Sponsored" },
];
const STATE = {
  pending: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  live: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ended: "bg-muted text-muted-foreground",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-300",
};
const STATE_LABEL = { pending: "Waiting", scheduled: "Scheduled", live: "Live", ended: "Ended", rejected: "Rejected" };

/** Payments to check, and every live / scheduled / ended promotion. */
export function RequestsTab({ status, onStatusChange, statsKey }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [type, setType] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [ending, setEnding] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => { setRefreshKey((k) => k + 1); qc.invalidateQueries({ queryKey: statsKey }); };
  const fail = (fallback) => (err) => toast.error(err.response?.data?.message ?? fallback);

  const approve = useMutation({ mutationFn: (id) => platformService.promotions.approve(id), onSuccess: (r) => { toast.success(r.data.message); reload(); }, onError: fail("Could not approve") });
  const reject = useMutation({ mutationFn: ({ id, reason }) => platformService.promotions.reject(id, reason), onSuccess: () => { toast.success("Payment rejected"); setRejecting(null); reload(); }, onError: fail("Could not reject") });
  const end = useMutation({ mutationFn: ({ id, reason }) => platformService.promotions.end(id, reason), onSuccess: () => { toast.success("Promotion ended"); setEnding(null); reload(); }, onError: fail("Could not end it") });

  const viewProof = async (id) => {
    const tab = window.open("", "_blank");
    try {
      const res = await platformService.promotions.proof(id);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Could not open the receipt");
    }
  };

  const columns = () => [
    {
      accessorKey: "shop", header: "Shop", style: { width: "24%" },
      cell: (row) => (
        <div className="min-w-0 py-1">
          <p className="truncate font-medium">{row.shop?.name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{row.reference_no}</p>
        </div>
      ),
    },
    {
      accessorKey: "type", header: "Promotion",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", row.type === "featured" ? "bg-amber-500/15 text-amber-600" : "bg-indigo-500/15 text-indigo-600")}>
            {row.type === "featured" ? <Star className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate">{row.target}</p>
            <p className="text-[10px] text-muted-foreground">{row.type === "featured" ? "Featured" : "Sponsored city"} · {row.days} days{row.kind === "granted" ? " · granted" : ""}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "amount", header: "Amount", cell: (row) => <span className="tabular-nums font-semibold">{row.amount > 0 ? format(row.amount) : "—"}</span> },
    {
      accessorKey: "starts_at", header: "Runs",
      cell: (row) => row.starts_at
        ? <div className="whitespace-nowrap text-xs"><p>{formatDateTime(row.starts_at)}</p><p className="text-muted-foreground">→ {formatDateTime(row.ends_at)}</p></div>
        : <span className="text-xs text-muted-foreground">Sent {formatDateTime(row.created_at)}{row.bank_reference ? ` · ref ${row.bank_reference}` : ""}</span>,
    },
    {
      accessorKey: "state", header: "Status",
      cell: (row) => (
        <div className="min-w-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATE[row.state])}>{STATE_LABEL[row.state] ?? row.state}</span>
          {row.reject_reason && <p className="mt-0.5 truncate text-[10px] text-destructive">{row.reject_reason}</p>}
        </div>
      ),
    },
    {
      accessorKey: "actions", header: "",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.has_proof && <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => viewProof(row.id)}><FileText className="h-3.5 w-3.5" /> Receipt</Button>}
          {row.state === "pending" && (
            <>
              <Button size="sm" className="h-7 gap-1 bg-emerald-600 px-2 text-xs hover:bg-emerald-700" onClick={() => approve.mutate(row.id)} disabled={approve.isPending}><Check className="h-3.5 w-3.5" /> Approve</Button>
              <Button size="icon" variant="outline" className="h-7 w-7 border-destructive/40 text-destructive hover:bg-destructive/10" title="Reject" onClick={() => setRejecting(row)}><X className="h-3.5 w-3.5" /></Button>
            </>
          )}
          {["live", "scheduled"].includes(row.state) && (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setEnding(row)}><Square className="h-3 w-3" /> End</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <ServerDataTable
        key={`${refreshKey}-${status}-${type}`}
        api={platformApi}
        endpoint="/platform/promotions"
        columns={columns}
        breadcrumb={[]}
        searchable
        filters={{ status: status || undefined, type: type || undefined }}
      >
        <FilterSelect value={status} onChange={onStatusChange} options={STATUS_OPTIONS} allLabel="All statuses" />
        <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} allLabel="All types" />
      </ServerDataTable>

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Reject payment"
        description={rejecting ? `${rejecting.shop?.name} · ${format(rejecting.amount)}. The shop sees this reason and can pay again.` : ""}
        confirmText="Reject"
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate({ id: rejecting.id, reason })}
      />
      <ReasonDialog
        open={!!ending}
        onOpenChange={(v) => !v && setEnding(null)}
        title="End promotion now"
        description={ending ? `${ending.target} stops being ${ending.type === "featured" ? "featured" : "sponsored"} immediately. No refund is made automatically.` : ""}
        confirmText="End now"
        loading={end.isPending}
        onConfirm={(reason) => end.mutate({ id: ending.id, reason })}
      />
    </>
  );
}
