"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformVehicleColourService } from "@/services/platformVehicleCatalogueService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ColourSwatch } from "@/components/marketplace/ColourSwatch";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", slug: "", hex: "#FFFFFF", has_hex: true, sort_order: 0, is_active: true };

const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function PlatformVehicleColoursPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-vehicle-colours"],
    queryFn: () => platformVehicleColourService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["platform-vehicle-colours"] });
    qc.invalidateQueries({ queryKey: ["public-colours"] });
  };

  const save = useMutation({
    mutationFn: (payload) => editing ? platformVehicleColourService.update(editing.id, payload) : platformVehicleColourService.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Colour updated" : "Colour created"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      // Not a validation error (e.g. a 500) - say so instead of failing silently.
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => platformVehicleColourService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Colour deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, hex: c.hex ?? "#FFFFFF", has_hex: !!c.hex, sort_order: c.sort_order ?? 0, is_active: !!c.is_active });
    setErrors({});
    setOpen(true);
  };

  const setName = (name) => setForm((p) => ({
    ...p,
    name,
    slug: !editing && (p.slug === "" || p.slug === slugify(p.name)) ? slugify(name) : p.slug,
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const { has_hex, ...rest } = form;
    save.mutate({ ...rest, hex: has_hex ? form.hex.toUpperCase() : null, sort_order: Number(form.sort_order) || 0 });
  };

  const columns = [
    {
      key: "name", header: "Colour",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ColourSwatch hex={row.hex} className="size-5" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: "hex", header: "Hex", render: (row) => row.hex ?? "—" },
    { key: "vehicles_count", header: "Vehicles", render: (row) => row.vehicles_count },
    { key: "sort_order", header: "Order" },
    { key: "is_active", header: "Status", render: (row) => <StatusBadge status={row.is_active} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex gap-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Colours" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Vehicle Colours"
          description="The colour list vendors pick from."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Colour</Button>}
        />

        <DataTable columns={columns} data={data ?? []} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Colour" : "New Colour"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={form.has_hex} onCheckedChange={(v) => setForm({ ...form, has_hex: !!v })} />
                Show a swatch
              </label>
              {form.has_hex && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.hex}
                    onChange={(e) => setForm({ ...form, hex: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                    aria-label="Swatch colour"
                  />
                  <span className="font-mono text-sm text-muted-foreground">{form.hex.toUpperCase()}</span>
                </div>
              )}
              {errors.hex?.[0] && <p className="text-xs text-destructive">{errors.hex[0]}</p>}
            </div>

            <TextInput label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order?.[0]} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Active (vendors can pick it)
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
            <AlertDialogDescription>Vehicles using it keep the colour name but lose the link. Consider deactivating it instead.</AlertDialogDescription>
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
