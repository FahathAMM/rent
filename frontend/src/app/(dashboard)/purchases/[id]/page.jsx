"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttachmentPanel } from "@/components/shared/AttachmentPanel";
import { Button } from "@/components/ui/button";
import { useCompanyCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { formatDate } from "@/lib/utils";
import { Pencil, Wallet, Loader2, Home, Receipt, AlertCircle, StickyNote, History, FileSearch, Download } from "lucide-react";
import Link from "next/link";
import { viewPdf, downloadPdf } from "@/lib/pdf";
import { RecordPaymentDialog } from "../RecordPaymentDialog";

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const { can } = useAuthStore();
  const formatCurrency = useCompanyCurrencyFormat();
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchaseService.getOne(id).then((r) => r.data.data),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!purchase) return null;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Purchases", href: "/purchases" },
    { label: purchase.purchase_number },
  ];

  return (
    <PageWrapper childMaxWidth="max-w-4xl" breadcrumb={breadcrumbItems}>
      <div className="rounded-xl border bg-card px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold font-mono">{purchase.purchase_number}</h1>
            <StatusBadge status={purchase.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {purchase.vendor?.name ?? "—"} · Purchased {formatDate(purchase.purchase_date)}
            {purchase.due_date && <> · Due {formatDate(purchase.due_date)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="text-sky-600 border-sky-300 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-400"
            onClick={() => viewPdf(`/purchases/${purchase.id}/pdf`)}
          ><FileSearch className="h-4 w-4" />View PDF</Button>
          <Button
            variant="outline" size="sm"
            className="text-slate-600 border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400"
            onClick={() => downloadPdf(`/purchases/${purchase.id}/pdf`, `${purchase.purchase_number}.pdf`)}
          ><Download className="h-4 w-4" />PDF</Button>
          {can("purchasing-purchases-edit") && (
            <Button
              asChild variant="outline" size="sm"
              className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400"
            >
              <Link href={`/purchases/${purchase.id}/edit`}><Pencil className="h-4 w-4" />Edit</Link>
            </Button>
          )}
          {can("purchasing-purchases-edit") && Number(purchase.balance_amount) > 0 && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setPaymentOpen(true)}>
              <Wallet className="h-4 w-4" />Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="text-lg font-bold truncate">{formatCurrency(purchase.total)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-emerald-600 truncate">{formatCurrency(purchase.paid_amount)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Balance</p>
            <p className="text-lg font-bold text-amber-600 truncate">{formatCurrency(purchase.balance_amount)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground bg-muted/40 border-b">
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3 text-right">Unit Price</th>
                <th className="py-2 px-3 text-right">Tax</th>
                <th className="py-2 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.items ?? []).map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3">{item.item?.name ?? item.description}</td>
                  <td className="py-2 px-3 text-right">{item.quantity}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(item.tax_amount)} ({item.tax_rate}%)</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(purchase.subtotal)}</span></div>
            {purchase.discount_amount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {formatCurrency(purchase.discount_amount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(purchase.tax_amount)}</span></div>
            <div className="flex justify-between font-bold text-base pt-1.5 border-t"><span>Total</span><span>{formatCurrency(purchase.total)}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment History</p>
        </div>
        {!purchase.payments?.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet className="h-8 w-8 mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {purchase.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs">
                      {formatDate(p.payment_date)}
                      {p.reference_no && <span className="text-muted-foreground"> · {p.reference_no}</span>}
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {p.createdBy?.name ?? "System"}
                      {p.notes && <> · {p.notes}</>}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold block">{formatCurrency(p.amount)}</span>
                  {p.payment_method && (
                    <span className="mt-0.5 inline-block rounded border px-1.5 py-0 text-[10px] capitalize text-muted-foreground">
                      {p.payment_method.replace("_", " ")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {purchase.notes && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
          </div>
          <p className="text-sm whitespace-pre-wrap">{purchase.notes}</p>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <AttachmentPanel attachableType="purchase" attachableId={purchase.id} />
      </div>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        purchase={purchase}
        onRecorded={() => qc.invalidateQueries({ queryKey: ["purchase", id] })}
      />
    </PageWrapper>
  );
}
