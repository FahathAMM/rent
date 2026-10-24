"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformCategoryService } from "@/services/platformCategoryService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", slug: "", icon: "", sort_order: 0, is_active: true, commission_rate: "" };

export default function PlatformCategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-categories"],
    queryFn: () => platformCategoryService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-categories"] });

  const save = useMutation({
    mutationFn: (payload) => editing ? platformCategoryService.update(editing.id, payload) : platformCategoryService.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Category updated" : "Category created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => platformCategoryService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Category deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.errors?.category?.[0] ?? err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, icon: c.icon ?? "", sort_order: c.sort_order ?? 0, is_active: !!c.is_active, commission_rate: c.commission_rate ?? "" });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({ ...form, sort_order: Number(form.sort_order), commission_rate: form.commission_rate || null });
  };

  const categories = data ?? [];

  const columns = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "slug", header: "Slug" },
    { key: "vehicles_count", header: "Vehicles", render: (row) => row.vehicles_count },
    { key: "commission_rate", header: "Commission override", render: (row) => row.commission_rate ? `${row.commission_rate}%` : "—" },
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
    { label: "Categories" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Vehicle Categories"
          description="Feeds public search facets and category-scoped commission rules."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Category</Button>}
        />

        <DataTable columns={columns} data={categories} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />
            <TextInput label="Icon (lucide name, optional)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} error={errors.icon?.[0]} />
            <TextInput label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order?.[0]} />
            <TextInput label="Commission rate override % (optional)" type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} error={errors.commission_rate?.[0]} />
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
            <AlertDialogDescription>This cannot be undone. A category still assigned to vehicles cannot be deleted.</AlertDialogDescription>
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
