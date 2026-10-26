"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { locationService } from "@/services/locationService";
import { useAuthStore } from "@/store/authStore";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Fieldset } from "@/components/forms/Fieldset";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { value: "branch", label: "Branch" },
  { value: "pickup_point", label: "Pickup Point" },
  { value: "airport", label: "Airport" },
  { value: "hotel", label: "Hotel" },
  { value: "custom", label: "Custom" },
];

const emptyForm = {
  name: "", type: "branch", address: "", city: "", district: "", country: "Sri Lanka",
  phone: "", email: "", contact_person: "", working_hours: "", notes: "", is_active: true,
};

export default function LocationsSettingsPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const save = useMutation({
    mutationFn: (payload) => editing ? locationService.update(editing.id, payload) : locationService.create(payload),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success(editing ? "Location updated" : "Location added"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => locationService.delete(id),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Location deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (loc) => {
    setEditing(loc);
    setForm({
      name: loc.name, type: loc.type ?? "branch", address: loc.address ?? "",
      city: loc.city ?? "", district: loc.district ?? "", country: loc.country ?? "Sri Lanka",
      phone: loc.phone ?? "", email: loc.email ?? "", contact_person: loc.contact_person ?? "",
      working_hours: loc.working_hours ?? "", notes: loc.notes ?? "", is_active: !!loc.is_active,
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate(form);
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "name",
      header: () => <SortableHeader label="Name" column="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    { accessorKey: "type", header: "Type", cell: (row) => <span className="capitalize">{row.type?.replace("_", " ")}</span> },
    { accessorKey: "city", header: "City", cell: (row) => row.city ?? "—" },
    { accessorKey: "vehicle_pickup_locations_count", header: "Vehicles", cell: (row) => row.vehicle_pickup_locations_count ?? 0 },
    {
      accessorKey: "is_active",
      header: () => <SortableHeader label="Status" column="is_active" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.is_active} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("vendor-settings-locations-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit location" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("vendor-settings-locations-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete location" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Locations" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/locations"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="name"
          defaultSortOrder="asc"
          isSheet={can("vendor-settings-locations-create")}
          openSheet={openCreate}
          model="Location"
        />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Location" : "New Location"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <Fieldset legend="Details" grid={2}>
              <TextInput label="Name" required value={form.name} onChange={fi("name")} error={errors.name?.[0]} />
              <SelectInput label="Type" options={TYPE_OPTIONS} value={form.type} onChange={(v) => setForm({ ...form, type: v })} error={errors.type?.[0]} />
              <TextInput label="City" value={form.city} onChange={fi("city")} error={errors.city?.[0]} />
              <TextInput label="District" value={form.district} onChange={fi("district")} error={errors.district?.[0]} />
              <TextInput label="Phone" value={form.phone} onChange={fi("phone")} error={errors.phone?.[0]} />
              <TextInput label="Email" type="email" value={form.email} onChange={fi("email")} error={errors.email?.[0]} />
              <TextInput label="Contact Person" value={form.contact_person} onChange={fi("contact_person")} error={errors.contact_person?.[0]} />
              <TextInput label="Working Hours" value={form.working_hours} onChange={fi("working_hours")} error={errors.working_hours?.[0]} />
            </Fieldset>
            <TextareaInput label="Address" rows={2} value={form.address} onChange={fi("address")} error={errors.address?.[0]} />
            <TextareaInput label="Notes" rows={2} value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Location"
        description={`Delete "${deleteTarget?.name}"? A location still assigned to vehicles cannot be deleted.`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
