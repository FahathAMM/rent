"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import platformApi from "@/lib/platformAxios";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { Button } from "@/components/ui/button";
import { cn, downloadBlob, formatDate } from "@/lib/utils";
import { categoryLabel } from "./labels";

const SOURCE_OPTIONS = [
  { value: "income", label: "All money in" },
  { value: "subscription", label: "Subscriptions" },
  { value: "promotion", label: "Promotions" },
  { value: "expense", label: "Expenses" },
];

const SOURCE_STYLES = {
  subscription: ["Subscription", "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"],
  promotion: ["Promotion", "bg-amber-500/10 text-amber-700 dark:text-amber-300"],
  expense: ["Expense", "bg-rose-500/10 text-rose-700 dark:text-rose-300"],
};

function detail(row) {
  if (row.source === "subscription") return `${row.detail} plan`;
  if (row.source === "promotion") return row.detail === "featured" ? "Featured vehicle" : "Sponsored shop";
  return categoryLabel(row.detail);
}

/** Every line of the books in the period, money in and money out together, newest first. */
export function TransactionsTab({ from, to }) {
  const { format } = useCurrencyFormat();
  const [source, setSource] = useState("");
  const [exporting, setExporting] = useState(false);
  const filters = { from: from || undefined, to: to || undefined, source: source || undefined };

  const exportCsv = async () => {
    setExporting(true);
    try {
      // The search box lives inside the table (and in the URL), so read it from there.
      const search = new URLSearchParams(window.location.search).get("search") || undefined;
      const res = await platformService.accounts.exportTransactions({ ...filters, search });
      downloadBlob(res.data, `platform-accounts${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`);
    } catch {
      toast.error("Could not export the transactions");
    } finally {
      setExporting(false);
    }
  };

  const columns = () => [
    { accessorKey: "entry_date", header: "Date", cell: (row) => <span className="whitespace-nowrap">{formatDate(row.entry_date)}</span> },
    { accessorKey: "reference", header: "Reference", cell: (row) => <span className="font-mono text-[11px]">{row.reference}</span> },
    {
      accessorKey: "source", header: "Type",
      cell: (row) => {
        const [label, tone] = SOURCE_STYLES[row.source] ?? [row.source, "bg-muted"];
        return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>{label}</span>;
      },
    },
    {
      accessorKey: "party", header: "Shop / Paid to", style: { width: "22%" },
      cell: (row) => row.shop_id
        ? <Link href={`/platform/shops/${row.shop_id}`} className="block truncate font-medium text-primary hover:underline">{row.party}</Link>
        : <span className="block truncate">{row.party || "—"}</span>,
    },
    {
      accessorKey: "detail", header: "Detail", style: { width: "22%" },
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{detail(row)}</p>
          {row.note && <p className="truncate text-[10px] font-normal text-muted-foreground">{row.source === "expense" ? row.note : `Bank ref ${row.note}`}</p>}
        </div>
      ),
    },
    { accessorKey: "credit", header: "Money in", cell: (row) => (Number(row.credit) > 0 ? <span className="tabular-nums text-emerald-600">{format(row.credit)}</span> : "—") },
    { accessorKey: "debit", header: "Money out", cell: (row) => (Number(row.debit) > 0 ? <span className="tabular-nums text-destructive">{format(row.debit)}</span> : "—") },
  ];

  return (
    <ServerDataTable
      api={platformApi}
      endpoint="/platform/accounts/transactions"
      columns={columns}
      breadcrumb={[]}
      filters={filters}
      actions={(
        <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={exportCsv} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
        </Button>
      )}
    >
      <FilterSelect value={source} onChange={setSource} options={SOURCE_OPTIONS} allLabel="All transactions" />
    </ServerDataTable>
  );
}
