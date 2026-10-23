"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Home, Wallet } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

export default function PurchasesPage() {
  const { can } = useAuthStore();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = useMutation({
    mutationFn: purchaseService.delete,
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Purchase deleted"); setDeleteTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "purchase_number",
      header: () => <SortableHeader label="Number" column="purchase_number" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    {
      accessorKey: "purchase_date",
      header: () => <SortableHeader label="Date" column="purchase_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => row.purchase_date?.slice(0, 10),
    },
    { accessorKey: "vendor", header: "Vendor", cell: (row) => row.vendor?.name ?? "—" },
    {
      accessorKey: "total",
      header: () => <SortableHeader label="Total" column="total" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => Number(row.total).toFixed(2),
    },
    {
      accessorKey: "balance_amount",
      header: () => <SortableHeader label="Balance" column="balance_amount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => {
        const balance = Number(row.balance_amount);
        return <span className={balance > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>{balance.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("purchasing-purchases-view") && (
            <ActionButton href={`/purchases/${row.id}`} icon={Eye} label="View purchase" className="text-sky-600 border-sky-300 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-400" />
          )}
          {can("purchasing-purchases-edit") && Number(row.balance_amount) > 0 && (
            <ActionButton onClick={() => setPayTarget(row)} icon={Wallet} label="Record payment" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" />
          )}
          {can("purchasing-purchases-edit") && (
            <ActionButton href={`/purchases/${row.id}/edit`} icon={Pencil} label="Edit purchase" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("purchasing-purchases-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete purchase" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Purchases" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/purchases"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="purchase_date"
          defaultSortOrder="desc"
          addPage={can("purchasing-purchases-create") ? "/purchases/new" : undefined}
          model="Purchase"
        />
      </HomePageWrapper>

      <RecordPaymentDialog
        open={!!payTarget}
        onOpenChange={() => setPayTarget(null)}
        purchase={payTarget}
        onRecorded={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Purchase"
        description={`Delete purchase "${deleteTarget?.purchase_number}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
