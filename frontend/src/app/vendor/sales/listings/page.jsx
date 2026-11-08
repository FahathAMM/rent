"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { BadgeDollarSign, CarFront, DownloadCloud, Home, Pencil, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { RecordSaleDialog } from "../components/RecordSaleDialog";

export default function SaleListingsPage() {
  const { can } = useAuthStore();
  const router = useRouter();
  const { format } = useCurrencyFormat();
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [selling, setSelling] = useState(null);

  const done = (message) => () => { setRefreshKey((k) => k + 1); toast.success(message); };
  const failed = (fallback) => (err) => {
    const errors = err.response?.data?.errors;
    toast.error((errors && Object.values(errors)[0]?.[0]) ?? err.response?.data?.message ?? fallback);
  };

  const publish = useMutation({ mutationFn: vendorService.sales.listings.publish, onSuccess: done("Listing published"), onError: failed("Could not publish") });
  const withdraw = useMutation({ mutationFn: vendorService.sales.listings.withdraw, onSuccess: done("Listing withdrawn"), onError: failed("Could not withdraw") });
  const remove = useMutation({
    mutationFn: vendorService.sales.listings.delete,
    onSuccess: () => { setDeleteTarget(null); done("Listing deleted")(); },
    onError: failed("Could not delete"),
  });
  const moveToRent = useMutation({
    mutationFn: vendorService.sales.listings.moveToRent,
    onSuccess: (res) => { setMoveTarget(null); done(res.data.message)(); },
    onError: (err) => { setMoveTarget(null); failed("Could not move this listing")(err); },
  });

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "title",
      header: () => <SortableHeader label="Vehicle" column="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.make} {row.model} · {row.year}</p>
        </div>
      ),
    },
    { accessorKey: "price", header: "Asking price", cell: (row) => (row.sale_detail ? format(row.sale_detail.price) : "—") },
    { accessorKey: "sale_status", header: "Sale", cell: (row) => <StatusBadge status={row.sale_detail?.sale_status} /> },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Listing" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { accessorKey: "moderation_status", header: "Moderation", cell: (row) => <StatusBadge status={row.moderation_status} /> },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => {
        if (row.sale_detail?.sale_status === "sold") return <span className="text-xs text-muted-foreground">Sold</span>;

        return (
          <div className="flex gap-1">
            {can("vendor-sales-listings-edit") && (
              <>
                <ActionButton onClick={() => router.push(`/vendor/sales/listings/${row.id}/edit`)} icon={Pencil} label="Edit listing" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
                {row.status !== "published" ? (
                  <ActionButton onClick={() => publish.mutate(row.id)} icon={UploadCloud} label="Publish" className="text-blue-600 border-blue-300 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400" />
                ) : (
                  <ActionButton onClick={() => withdraw.mutate(row.id)} icon={DownloadCloud} label="Withdraw from sale" className="text-amber-600 border-amber-300 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-400" />
                )}
                <ActionButton onClick={() => setMoveTarget(row)} icon={CarFront} label="Move to rentals" className="text-slate-600 border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400" />
              </>
            )}
            {can("vendor-sales-sold-create") && (
              <ActionButton onClick={() => setSelling({ ...row, price: row.sale_detail?.price })} icon={BadgeDollarSign} label="Record sale" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" />
            )}
            {can("vendor-sales-listings-delete") && (
              <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete listing" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
            )}
          </div>
        );
      },
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Sales" },
    { label: "Listings" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/sales/listings"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          isSheet={can("vendor-sales-listings-create")}
          openSheet={() => router.push("/vendor/sales/listings/new")}
          model="Listing"
        />
      </HomePageWrapper>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Listing"
        description={`Delete "${deleteTarget?.title}"? Any open enquiries on it will be closed.`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
      />
      <ConfirmDialog
        open={!!moveTarget}
        onOpenChange={() => setMoveTarget(null)}
        title="Move to Rentals"
        description={`Move "${moveTarget?.title}" to your rental vehicles? It goes back through review. Close any open enquiries first.`}
        onConfirm={() => moveToRent.mutate(moveTarget.id)}
        loading={moveToRent.isPending}
      />
      {selling && (
        <RecordSaleDialog
          vehicle={selling}
          onClose={() => setSelling(null)}
          onRecorded={(sale) => router.push(`/vendor/sales/sold/${sale.reference}`)}
        />
      )}
    </div>
  );
}
