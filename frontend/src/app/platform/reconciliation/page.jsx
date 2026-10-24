"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { platformReconciliationService } from "@/services/platformReconciliationService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/forms/FormField";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { Download, Home, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function StatCard({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DiscrepancyRow({ label, items }) {
  const count = items?.length ?? 0;
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2.5 last:border-0">
      <div className="flex items-center gap-2">
        {count > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{count}</p>
        {count > 0 && <p className="max-w-xs truncate text-xs text-muted-foreground">{items.join(", ")}</p>}
      </div>
    </div>
  );
}

export default function PlatformReconciliationPage() {
  const { format } = useCurrencyFormat();
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-reconciliation", dateFrom, dateTo],
    queryFn: () => platformReconciliationService.summary({ date_from: dateFrom, date_to: dateTo }).then((r) => r.data.data),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await platformReconciliationService.export({ date_from: dateFrom, date_to: dateTo });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation-${dateFrom}-to-${dateTo}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Reconciliation" },
  ];

  const discrepancies = data?.discrepancies ?? {};
  const totalDiscrepancies = Object.values(discrepancies).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Reconciliation"
        description="Gateway vs. ledger vs. payouts — three independently-written sources that should agree."
        action={
          <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <TextInput label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <TextInput label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gateway received" value={format(data.gateway.received)} hint="Succeeded payments" />
            <StatCard label="Ledger cash in" value={format(data.ledger.cash_in)} hint="platform_cash debits" />
            <StatCard label="Commission income" value={format(data.ledger.commission_income)} />
            <StatCard label="Owner payable accrued" value={format(data.ledger.owner_payable_accrued)} />
            <StatCard label="Deposits held" value={format(data.ledger.deposits_held)} />
            <StatCard label="Payouts paid" value={format(data.payouts.paid)} />
            <StatCard label="Refunds paid" value={format(data.refunds.paid)} />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Discrepancies
                {totalDiscrepancies === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DiscrepancyRow label="Unbalanced ledger batches" items={discrepancies.unbalanced_ledger_batches} />
              <DiscrepancyRow label="Confirmed bookings without financials" items={discrepancies.confirmed_bookings_without_financials} />
              <DiscrepancyRow label="Succeeded payments without financials" items={discrepancies.succeeded_payments_without_financials} />
              <DiscrepancyRow label="Bookings with financials but no ledger entries" items={discrepancies.bookings_with_financials_but_no_ledger_entries} />
            </CardContent>
          </Card>
        </>
      )}
    </PageWrapper>
  );
}
