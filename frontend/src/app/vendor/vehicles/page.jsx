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
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError, CheckboxInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Fieldset } from "@/components/forms/Fieldset";
import { VehicleImageManager } from "@/components/vendor/VehicleImageManager";
import { toast } from "sonner";
import { Pencil, Trash2, Home, UploadCloud, DownloadCloud, Archive, DollarSign, Images } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const defaultPricing = {
  daily_rate: "",
  weekly_rate: "",
  monthly_rate: "",
  security_deposit: "",
  deposit_method: "cash_on_pickup",
  mileage_allowance_per_day_km: "",
  driver_rate_per_day: "",
  delivery_available: false,
  min_rental_days: 1,
};

export default function VehiclesPage() {
  const { can } = useAuthStore();
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pricingTarget, setPricingTarget] = useState(null);
  const [pricingForm, setPricingForm] = useState(defaultPricing);
  const [pricingErrors, setPricingErrors] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [imagesTarget, setImagesTarget] = useState(null);

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

  const savePricing = useMutation({
    mutationFn: ({ id, data }) => vehicleService.updatePricing(id, data),
    onSuccess: () => {
      toast.success("Pricing updated");
      setPricingTarget(null);
    },
    onError: (err) => setPricingErrors(err.response?.data?.errors ?? {}),
  });

  const pf = (k) => (val) => setPricingForm((p) => ({ ...p, [k]: val }));
  const pfi = (k) => (e) => setPricingForm((p) => ({ ...p, [k]: e.target.value }));

  // Add / edit live on their own pages (VehicleForm) rather than a pop-up.
  const openCreate = () => router.push("/vendor/vehicles/new");
  const openEdit = (vehicle) => router.push(`/vendor/vehicles/${vehicle.id}/edit`);

  const openPricing = async (vehicle) => {
    setPricingErrors({});
    setPricingTarget(vehicle);
    try {
      const res = await vehicleService.getOne(vehicle.id);
      const pricing = res.data.data.pricing ?? {};
      setPricingForm({
        daily_rate: pricing.daily_rate ?? "",
        weekly_rate: pricing.weekly_rate ?? "",
        monthly_rate: pricing.monthly_rate ?? "",
        security_deposit: pricing.security_deposit ?? "",
        deposit_method: pricing.deposit_method ?? "cash_on_pickup",
        mileage_allowance_per_day_km: pricing.mileage_allowance_per_day_km ?? "",
        driver_rate_per_day: pricing.driver_rate_per_day ?? "",
        delivery_available: !!pricing.delivery_available,
        min_rental_days: pricing.min_rental_days ?? 1,
      });
    } catch {
      setPricingForm(defaultPricing);
    }
  };

  const handlePricingSubmit = (e) => {
    e.preventDefault();
    setPricingErrors({});
    savePricing.mutate({ id: pricingTarget.id, data: pricingForm });
  };

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
          {can("vendor-vehicles-list-edit") && (
            <>
              <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit vehicle" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
              <ActionButton onClick={() => setImagesTarget(row)} icon={Images} label="Manage photos" className="text-sky-600 border-sky-300 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-400" />
              <ActionButton onClick={() => openPricing(row)} icon={DollarSign} label="Edit pricing" className="text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400" />
              {row.status !== "published" ? (
                <ActionButton onClick={() => publish.mutate(row.id)} icon={UploadCloud} label="Publish" className="text-blue-600 border-blue-300 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400" />
              ) : (
                <ActionButton onClick={() => unpublish.mutate(row.id)} icon={DownloadCloud} label="Unpublish" className="text-amber-600 border-amber-300 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-400" />
              )}
              <ActionButton onClick={() => archive.mutate(row.id)} icon={Archive} label="Archive" className="text-slate-600 border-slate-300 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-400" />
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

      <Modal open={!!pricingTarget} onOpenChange={() => setPricingTarget(null)} title={`Pricing — ${pricingTarget?.title ?? ""}`} size="xl" headerBorder>
        <form onSubmit={handlePricingSubmit} className="space-y-5">
          <ValidationError errors={pricingErrors} />
          <Fieldset legend="Rates (LKR)" grid={3}>
            <TextInput label="Daily Rate" type="number" step="0.01" value={pricingForm.daily_rate} onChange={pfi("daily_rate")} required error={pricingErrors.daily_rate?.[0]} />
            <TextInput label="Weekly Rate" type="number" step="0.01" value={pricingForm.weekly_rate} onChange={pfi("weekly_rate")} error={pricingErrors.weekly_rate?.[0]} />
            <TextInput label="Monthly Rate" type="number" step="0.01" value={pricingForm.monthly_rate} onChange={pfi("monthly_rate")} error={pricingErrors.monthly_rate?.[0]} />
          </Fieldset>
          <Fieldset legend="Deposit & Mileage" grid={3}>
            <TextInput label="Security Deposit" type="number" step="0.01" value={pricingForm.security_deposit} onChange={pfi("security_deposit")} error={pricingErrors.security_deposit?.[0]} />
            <SelectInput
              label="Deposit Method"
              value={pricingForm.deposit_method}
              onChange={pf("deposit_method")}
              options={[
                { value: "cash_on_pickup", label: "Cash on pickup" },
                { value: "prepaid", label: "Prepaid" },
                { value: "waived", label: "Waived" },
              ]}
            />
            <TextInput label="Mileage Allowance (km/day)" type="number" value={pricingForm.mileage_allowance_per_day_km} onChange={pfi("mileage_allowance_per_day_km")} error={pricingErrors.mileage_allowance_per_day_km?.[0]} />
          </Fieldset>
          <Fieldset legend="Options" grid={3}>
            <TextInput label="Driver Rate (per day)" type="number" step="0.01" value={pricingForm.driver_rate_per_day} onChange={pfi("driver_rate_per_day")} error={pricingErrors.driver_rate_per_day?.[0]} />
            <TextInput label="Min Rental Days" type="number" value={pricingForm.min_rental_days} onChange={pfi("min_rental_days")} error={pricingErrors.min_rental_days?.[0]} />
            <CheckboxInput label="Delivery Available" checked={pricingForm.delivery_available} onChange={(v) => pf("delivery_available")(v)} />
          </Fieldset>
          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setPricingTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={savePricing.isPending}>{savePricing.isPending ? "Saving..." : "Save Pricing"}</Button>
          </div>
        </form>
      </Modal>

      <VehicleImageManager vehicle={imagesTarget} open={!!imagesTarget} onOpenChange={(v) => !v && setImagesTarget(null)} />

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
