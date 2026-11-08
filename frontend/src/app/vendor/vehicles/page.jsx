"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { Pencil, Trash2, Home, UploadCloud, DownloadCloud, Archive, Eye, BadgeDollarSign } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSubscription } from "@/app/vendor/settings/subscription/components/useSubscription";
import { MoveToSaleDialog } from "@/app/vendor/sales/components/MoveToSaleDialog";

export default function VehiclesPage() {
  const { can } = useAuthStore();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selling, setSelling] = useState(null);
  const { data: subscription } = useSubscription();
  const canSell = can("vendor-sales-listings-create") && subscription?.features?.includes("sales");

  const remove = useMutation({
    mutationFn: vehicleService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const publish = useMutation({
    mutationFn: vehicleService.publish,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle published");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to publish"),
  });

  const unpublish = useMutation({
    mutationFn: vehicleService.unpublish,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle unpublished");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const archive = useMutation({
    mutationFn: vehicleService.archive,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle archived");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  // Add / edit (details, pricing, photos) live on their own pages (VehicleForm).
  const openCreate = () => router.push("/vendor/vehicles/new");
  const openEdit = (vehicle) => router.push(`/vendor/vehicles/${vehicle.id}/edit`);

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
    { accessorKey: "category", header: "Category", cell: (row) => row.category?.name ?? "—" },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { accessorKey: "moderation_status", header: "Moderation", cell: (row) => <StatusBadge status={row.moderation_status} /> },
    {
      accessorKey: "booking_count",
      header: () => <SortableHeader label="Bookings" column="booking_count" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("vendor-vehicles-list-view") && (
            <ActionButton onClick={() => router.push(`/vendor/vehicles/${row.id}`)} icon={Eye} label="View vehicle" className="text-sky-700 border-sky-300 hover:text-sky-800 hover:bg-sky-50 hover:border-sky-400" />
          )}
          {can("vendor-vehicles-list-edit") && (
            <>
              <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit vehicle" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
              {row.status !== "published" ? (
                <ActionButton onClick={() => publish.mutate(row.id)} icon={UploadCloud} label="Publish" className="text-blue-600 border-blue-300 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400" />
              ) : (
                <ActionButton onClick={() => unpublish.mutate(row.id)} icon={DownloadCloud} label="Unpublish" className="text-amber-600 border-amber-300 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-400" />
              )}
              <ActionButton onClick={() => archive.mutate(row.id)} icon={Archive} label="Archive" className="text-slate-600 border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400" />
              {canSell && (
                <ActionButton onClick={() => setSelling(row)} icon={BadgeDollarSign} label="Move to sale" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" />
              )}
            </>
          )}
          {can("vendor-vehicles-list-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete vehicle" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Vehicles" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/vehicles"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          isSheet={can("vendor-vehicles-list-create")}
          openSheet={openCreate}
          model="Vehicle"
        />
      </HomePageWrapper>

      {selling && (
        <MoveToSaleDialog
          vehicle={selling}
          onClose={() => setSelling(null)}
          onMoved={() => { setSelling(null); router.push("/vendor/sales/listings"); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Vehicle"
        description={`Delete vehicle "${deleteTarget?.title}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
