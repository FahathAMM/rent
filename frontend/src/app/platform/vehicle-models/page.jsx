"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformBrandService } from "@/services/platformBrandService";
import { platformVehicleModelService, platformVehicleVariantService } from "@/services/platformVehicleCatalogueService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

const ALL = "all";

const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Inline add / toggle / delete for one model's variants. */
function VariantsDialog({ model, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const key = ["platform-vehicle-variants", model?.id];

  const { data: variants, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => platformVehicleVariantService.getAll(model.id).then((r) => r.data.data),
    enabled: !!model,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["platform-vehicle-models"] });
  };

  const add = useMutation({
    mutationFn: () => platformVehicleVariantService.create({ model_id: model.id, name, sort_order: (variants?.length ?? 0) + 1, is_active: true }),
    onSuccess: () => { setName(""); setError(null); refresh(); },
    onError: (err) => setError(err.response?.data?.errors?.name?.[0] ?? err.response?.data?.message ?? "Could not add variant"),
  });

  const toggle = useMutation({
    mutationFn: (v) => platformVehicleVariantService.update(v.id, { model_id: model.id, name: v.name, sort_order: v.sort_order, is_active: !v.is_active }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id) => platformVehicleVariantService.delete(id),
    onSuccess: () => { refresh(); toast.success("Variant deleted"); },
  });

  return (
    <Dialog open={!!model} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{model?.brand?.name} {model?.name} — variants</DialogTitle>
          <DialogDescription>Optional trims vendors can pick for this model. Deleting one keeps its name on existing vehicles.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}
          className="flex gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. G, Crossover, High Roof" className="h-9" />
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={add.isPending || !name.trim()}>
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
          </Button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!isLoading && !variants?.length && <p className="py-6 text-center text-sm text-muted-foreground">No variants yet.</p>}
          {variants?.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={v.is_active ? "text-sm font-medium" : "text-sm text-muted-foreground line-through"}>{v.name}</span>
                <span className="text-xs text-muted-foreground">{v.vehicles_count} vehicles</span>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggle.mutate(v)}>
                  {v.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(v.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformVehicleModelsPage() {
  const qc = useQueryClient();
  const [brandFilter, setBrandFilter] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ brand_id: "", name: "", slug: "", sort_order: 0, is_active: true });
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [variantsTarget, setVariantsTarget] = useState(null);

  const { data: brands } = useQuery({
    queryKey: ["platform-brands"],
    queryFn: () => platformBrandService.getAll().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["platform-vehicle-models", brandFilter],
    queryFn: () => platformVehicleModelService.getAll(brandFilter === ALL ? {} : { brand_id: brandFilter }).then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-vehicle-models"] });

  const save = useMutation({
    mutationFn: (payload) => editing ? platformVehicleModelService.update(editing.id, payload) : platformVehicleModelService.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Model updated" : "Model created"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      // Not a validation error (e.g. a 500) - say so instead of failing silently.
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => platformVehicleModelService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Model deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.errors?.model?.[0] ?? err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ brand_id: brandFilter === ALL ? "" : brandFilter, name: "", slug: "", sort_order: 0, is_active: true });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ brand_id: String(m.brand_id), name: m.name, slug: m.slug, sort_order: m.sort_order ?? 0, is_active: !!m.is_active });
    setErrors({});
    setOpen(true);
  };

  // Auto-fill the slug from the name until the admin edits the slug themselves.
  const setName = (name) => setForm((p) => ({
    ...p,
    name,
    slug: !editing && (p.slug === "" || p.slug === slugify(p.name)) ? slugify(name) : p.slug,
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({ ...form, brand_id: Number(form.brand_id) || null, sort_order: Number(form.sort_order) || 0 });
  };

  const brandOptions = (brands ?? []).map((b) => ({ value: String(b.id), label: b.name }));

  const columns = [
    { key: "brand", header: "Brand", render: (row) => row.brand?.name ?? "—" },
    { key: "name", header: "Model", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "variants_count", header: "Variants", render: (row) => row.variants_count },
    { key: "vehicles_count", header: "Vehicles", render: (row) => row.vehicles_count },
    { key: "is_active", header: "Status", render: (row) => <StatusBadge status={row.is_active} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setVariantsTarget(row)}><Layers className="h-3.5 w-3.5" /> Variants</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Models & Variants" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Models & Variants"
          description="Models under each brand, and the optional variants (trims) under each model."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Model</Button>}
        />

        <div className="mb-4 max-w-xs">
          <SelectInput
            label="Brand"
            value={brandFilter}
            onChange={setBrandFilter}
            options={[{ value: ALL, label: "All brands" }, ...brandOptions]}
          />
        </div>

        <DataTable columns={columns} data={data ?? []} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Model" : "New Model"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <SelectInput label="Brand" placeholder="Select brand" required value={form.brand_id} onChange={(v) => setForm({ ...form, brand_id: v })} options={brandOptions} error={errors.brand_id?.[0]} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />
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

      <VariantsDialog model={variantsTarget} onClose={() => setVariantsTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.brand?.name} {deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>Its variants are deleted too. A model still assigned to vehicles cannot be deleted — deactivate it instead.</AlertDialogDescription>
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
