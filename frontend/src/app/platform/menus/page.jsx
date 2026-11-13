"use client";

import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

const AUDIENCE_OPTIONS = [
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
];

const emptyForm = { audience: "vendor", name: "", slug: "", route_name: "", icon: "", parent_id: "", sort_order: 0, is_active: true };

const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function PlatformMenusPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Every menu, for the parent dropdown.
  const { data: allMenus = [] } = useQuery({
    queryKey: ["platform-menus-all"],
    queryFn: () => platformService.menus.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });

  const invalidate = () => {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["platform-menus-all"] });
  };

  const save = useMutation({
    mutationFn: (payload) => editing ? platformService.menus.update(editing.id, payload) : platformService.menus.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Menu updated" : "Menu created"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => platformService.menus.delete(id),
    onSuccess: () => { invalidate(); toast.success("Menu deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({
      audience: m.audience, name: m.name, slug: m.slug, route_name: m.route_name ?? "", icon: m.icon ?? "",
      parent_id: m.parent_id ?? "", sort_order: m.sort_order ?? 0, is_active: !!m.is_active,
    });
    setErrors({});
    setOpen(true);
  };

  const setName = (name) => setForm((p) => ({
    ...p,
    name,
    slug: !editing && (p.slug === "" || p.slug === slugify(p.name)) ? slugify(name) : p.slug,
  }));

  const parentOptions = [
    { value: "", label: "None (top level)" },
    ...allMenus
      .filter((m) => m.audience === form.audience && m.id !== editing?.id)
      .map((m) => ({ value: m.id, label: m.name })),
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({
      ...form,
      route_name: form.route_name || null,
      icon: form.icon || null,
      parent_id: form.parent_id || null,
      sort_order: Number(form.sort_order) || 0,
    });
  };

  const columns = () => [
    { accessorKey: "name", header: "Name", cell: (row) => <span className="font-medium">{row.name}</span> },
    { accessorKey: "audience", header: "Audience", cell: (row) => <span className="capitalize">{row.audience}</span> },
    { accessorKey: "parent", header: "Parent", cell: (row) => row.parent?.name ?? "—" },
    { accessorKey: "route_name", header: "Route", cell: (row) => row.route_name ?? <span className="text-muted-foreground">Section</span> },
    { accessorKey: "icon", header: "Icon", cell: (row) => row.icon ?? "—" },
    { accessorKey: "sort_order", header: "Order" },
    { accessorKey: "is_active", header: "Status", cell: (row) => <StatusBadge status={row.is_active} /> },
    {
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Menus" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/menus"
          columns={columns}
          breadcrumb={[]}
          isSheet
          openSheet={openCreate}
          model="Menu"
        />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Menu" : "New Menu"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <SelectInput label="Audience" required options={AUDIENCE_OPTIONS} value={form.audience} onChange={(v) => setForm({ ...form, audience: v, parent_id: "" })} error={errors.audience?.[0]} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} />
            <TextInput label="Slug" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} error={errors.slug?.[0]} />
            <TextInput label="Route" placeholder="/vendor/bookings — leave empty for a section header" value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} error={errors.route_name?.[0]} />
            <TextInput label="Icon" placeholder="Lucide icon name, e.g. Car" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} error={errors.icon?.[0]} />
            <SelectInput label="Parent" options={parentOptions} value={form.parent_id} onChange={(v) => setForm({ ...form, parent_id: v })} error={errors.parent_id?.[0]} />
            <TextInput label="Sort order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} error={errors.sort_order?.[0]} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              Active (shown in the sidebar)
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
            <AlertDialogDescription>Its sub-menus move up one level. Consider deactivating it instead.</AlertDialogDescription>
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
