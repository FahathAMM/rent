"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import { publicService } from "@/services/publicService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, TextareaInput, ValidationError, CheckboxInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Fieldset } from "@/components/forms/Fieldset";
import { toast } from "sonner";
import { Pencil, Trash2, Home, UploadCloud, DownloadCloud, Archive, DollarSign } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const TRANSMISSIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "semi_automatic", label: "Semi-automatic" },
  { value: "cvt", label: "CVT" },
];

const FUEL_TYPES = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG" },
];

const defaultForm = {
  category_id: "",
  title: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  variant: "",
  colour: "",
  registration_number: "",
  transmission: "automatic",
  fuel_type: "petrol",
  engine_capacity_cc: "",
  seating_capacity: 5,
  luggage_capacity: "",
  doors: "",
  air_conditioned: true,
  description: "",
  condition_notes: "",
};

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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pricingTarget, setPricingTarget] = useState(null);
  const [pricingForm, setPricingForm] = useState(defaultPricing);
  const [pricingErrors, setPricingErrors] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: categories } = useQuery({
    queryKey: ["public-categories"],
    queryFn: () => publicService.categories().then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: vehicleService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle created — it will appear once approved and published");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => vehicleService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Vehicle updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

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

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const pf = (k) => (val) => setPricingForm((p) => ({ ...p, [k]: val }));
  const pfi = (k) => (e) => setPricingForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (vehicle) => {
    setEditing(vehicle);
    setForm({
      category_id: vehicle.category_id ? String(vehicle.category_id) : "",
      title: vehicle.title ?? "",
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ?? new Date().getFullYear(),
      variant: vehicle.variant ?? "",
      colour: vehicle.colour ?? "",
      registration_number: vehicle.registration_number ?? "",
      transmission: vehicle.transmission ?? "automatic",
      fuel_type: vehicle.fuel_type ?? "petrol",
      engine_capacity_cc: vehicle.engine_capacity_cc ?? "",
      seating_capacity: vehicle.seating_capacity ?? 5,
      luggage_capacity: vehicle.luggage_capacity ?? "",
      doors: vehicle.doors ?? "",
      air_conditioned: !!vehicle.air_conditioned,
      description: vehicle.description ?? "",
      condition_notes: vehicle.condition_notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      ...form,
      engine_capacity_cc: form.engine_capacity_cc || null,
      luggage_capacity: form.luggage_capacity || null,
      doors: form.doors || null,
      variant: form.variant || null,
      colour: form.colour || null,
    };
    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const handlePricingSubmit = (e) => {
    e.preventDefault();
    setPricingErrors({});
    savePricing.mutate({ id: pricingTarget.id, data: pricingForm });
  };

  const categoryOptions = (categories ?? []).map((c) => ({ value: String(c.id), label: c.name }));

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

  const isPending = create.isPending || update.isPending;

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

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Vehicle" : "Add Vehicle"} size="3xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Identity" grid={2}>
            <SelectInput label="Category" value={form.category_id} onChange={f("category_id")} options={categoryOptions} required error={errors.category_id?.[0]} />
            <TextInput label="Listing Title" value={form.title} onChange={fi("title")} placeholder="e.g. Toyota Aqua - Colombo" required error={errors.title?.[0]} />
            <TextInput label="Make" value={form.make} onChange={fi("make")} required error={errors.make?.[0]} />
            <TextInput label="Model" value={form.model} onChange={fi("model")} required error={errors.model?.[0]} />
            <TextInput label="Year" type="number" value={form.year} onChange={fi("year")} required error={errors.year?.[0]} />
            <TextInput label="Variant" value={form.variant} onChange={fi("variant")} error={errors.variant?.[0]} />
            <TextInput label="Colour" value={form.colour} onChange={fi("colour")} error={errors.colour?.[0]} />
            <TextInput label="Registration Number" value={form.registration_number} onChange={fi("registration_number")} required error={errors.registration_number?.[0]} />
          </Fieldset>

          <Fieldset legend="Specifications" grid={3}>
            <SelectInput label="Transmission" value={form.transmission} onChange={f("transmission")} options={TRANSMISSIONS} required error={errors.transmission?.[0]} />
            <SelectInput label="Fuel Type" value={form.fuel_type} onChange={f("fuel_type")} options={FUEL_TYPES} required error={errors.fuel_type?.[0]} />
            <TextInput label="Engine Capacity (cc)" type="number" value={form.engine_capacity_cc} onChange={fi("engine_capacity_cc")} error={errors.engine_capacity_cc?.[0]} />
            <TextInput label="Seating Capacity" type="number" value={form.seating_capacity} onChange={fi("seating_capacity")} required error={errors.seating_capacity?.[0]} />
            <TextInput label="Luggage Capacity" type="number" value={form.luggage_capacity} onChange={fi("luggage_capacity")} error={errors.luggage_capacity?.[0]} />
            <TextInput label="Doors" type="number" value={form.doors} onChange={fi("doors")} error={errors.doors?.[0]} />
            <CheckboxInput label="Air Conditioned" checked={form.air_conditioned} onChange={(v) => f("air_conditioned")(v)} />
          </Fieldset>

          <Fieldset legend="Description" grid={1}>
            <TextareaInput label="Description" value={form.description} onChange={fi("description")} error={errors.description?.[0]} />
            <TextareaInput label="Condition Notes (internal)" value={form.condition_notes} onChange={fi("condition_notes")} error={errors.condition_notes?.[0]} />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

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
