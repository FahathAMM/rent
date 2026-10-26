"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { locationService } from "@/services/locationService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Fieldset } from "@/components/forms/Fieldset";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2 } from "lucide-react";
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
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-locations"],
    queryFn: () => locationService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-locations"] });

  const save = useMutation({
    mutationFn: (payload) => editing ? locationService.update(editing.id, payload) : locationService.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Location updated" : "Location added"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => locationService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Location deleted"); setDeleteTarget(null); },
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

  const locations = data?.data ?? [];

  const columns = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type?.replace("_", " ")}</span> },
    { key: "city", header: "City", render: (row) => row.city ?? "—" },
    { key: "vehicle_pickup_locations_count", header: "Vehicles", render: (row) => row.vehicle_pickup_locations_count ?? 0 },
    { key: "is_active", header: "Status", render: (row) => <StatusBadge status={row.is_active} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex gap-1.5">
          {can("vendor-settings-locations-edit") && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          )}
          {can("vendor-settings-locations-delete") && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
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
        <PageHeader
          title="Locations"
          description="Branches and vehicle pickup/return points customers can choose when booking."
          action={can("vendor-settings-locations-create") && (
            <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Location</Button>
          )}
        />

        <DataTable columns={columns} data={locations} loading={isLoading} />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. A location still assigned to vehicles cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteTarget.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
