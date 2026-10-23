"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { saleService } from "@/services/saleService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Home, Wallet, Store } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { RecordSalePaymentDialog } from "./RecordSalePaymentDialog";
import Link from "next/link";

export default function SalesPage() {
  const { can } = useAuthStore();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = useMutation({
    mutationFn: saleService.delete,
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Sale deleted"); setDeleteTarget(null); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "sale_number",
      header: () => <SortableHeader label="Invoice #" column="sale_number" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    {
      accessorKey: "sale_date",
      header: () => <SortableHeader label="Date" column="sale_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => row.sale_date?.slice(0, 10),
    },
    { accessorKey: "customer", header: "Customer", cell: (row) => row.customer?.name ?? row.walk_in_name ?? "Walk-in" },
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
          {can("sales-orders-view") && (
            <ActionButton href={`/sales/${row.id}`} icon={Eye} label="View sale" className="text-sky-600 border-sky-300 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-400" />
          )}
          {can("sales-orders-edit") && Number(row.balance_amount) > 0 && (
            <ActionButton onClick={() => setPayTarget(row)} icon={Wallet} label="Record payment" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" />
          )}
          {can("sales-orders-edit") && (
            <ActionButton href={`/sales/${row.id}/edit`} icon={Pencil} label="Edit sale" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("sales-orders-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete sale" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/sales"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="sale_date"
          defaultSortOrder="desc"
          addPage={can("sales-orders-create") ? "/sales/new" : undefined}
          model="Sale"
          actions={
            can("pos-new_sale-view") && (
              <Button asChild size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                <Link href="/pos"><Store className="h-3.5 w-3.5" />New Sale (POS)</Link>
              </Button>
            )
          }
        />
      </HomePageWrapper>

      <RecordSalePaymentDialog
        open={!!payTarget}
        onOpenChange={() => setPayTarget(null)}
        sale={payTarget}
        onRecorded={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Sale"
        description={`Delete sale "${deleteTarget?.sale_number}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
