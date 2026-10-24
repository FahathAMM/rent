"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformCommissionService } from "@/services/platformCommissionService";
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
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Home, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const SCOPE_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "category", label: "Category" },
  { value: "shop", label: "Shop" },
  { value: "vehicle", label: "Vehicle" },
];

const APPLIES_TO_OPTIONS = [
  { value: "rental_only", label: "Rental only" },
  { value: "rental_plus_extras", label: "Rental + extras" },
];

const FEE_BORNE_OPTIONS = [
  { value: "platform", label: "Platform" },
  { value: "owner", label: "Owner" },
  { value: "split", label: "Split" },
];

const emptyForm = {
  name: "", scope_type: "global", scope_id: "", percentage: "", fixed_amount: "",
  min_amount: "", max_amount: "", applies_to: "rental_only", processing_fee_borne_by: "platform",
  priority: 0, effective_from: new Date().toISOString().slice(0, 10), effective_to: "", is_active: true,
};

export default function PlatformCommissionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-commissions"],
    queryFn: () => platformCommissionService.getAll().then((r) => r.data.record),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-commissions"] });

  const save = useMutation({
    mutationFn: (payload) => editing ? platformCommissionService.update(editing.id, payload) : platformCommissionService.create(payload),
    onSuccess: () => { invalidate(); toast.success(editing ? "Rule updated" : "Rule created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => platformCommissionService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Rule deleted"); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErrors({}); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, scope_type: c.scope_type, scope_id: c.scope_id ?? "",
      percentage: c.percentage, fixed_amount: c.fixed_amount ?? "", min_amount: c.min_amount ?? "", max_amount: c.max_amount ?? "",
      applies_to: c.applies_to, processing_fee_borne_by: c.processing_fee_borne_by, priority: c.priority ?? 0,
      effective_from: c.effective_from?.slice(0, 10), effective_to: c.effective_to?.slice(0, 10) ?? "", is_active: !!c.is_active,
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({
      ...form,
      scope_id: form.scope_type === "global" ? null : Number(form.scope_id),
      fixed_amount: form.fixed_amount || null, min_amount: form.min_amount || null, max_amount: form.max_amount || null,
      effective_to: form.effective_to || null,
      priority: Number(form.priority),
    });
  };

  const rules = data?.data ?? [];

  const columns = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "scope_type", header: "Scope", render: (row) => <span className="capitalize">{row.scope_type}{row.scope_id ? ` #${row.scope_id}` : ""}</span> },
    { key: "percentage", header: "Rate", render: (row) => `${row.percentage}%${Number(row.fixed_amount) > 0 ? ` + ${row.fixed_amount}` : ""}` },
    { key: "priority", header: "Priority" },
    { key: "effective_from", header: "Effective from", render: (row) => formatDate(row.effective_from) },
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
    { label: "Commissions" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Commission Rules"
          description="Resolution order at confirmation: vehicle > shop > category > global, highest priority first. Editing or deleting a rule never re-prices a booking that already confirmed."
          action={<Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Rule</Button>}
        />

        <DataTable columns={columns} data={rules} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Commission Rule" : "New Commission Rule"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Scope" required options={SCOPE_OPTIONS} value={form.scope_type} onChange={(v) => setForm({ ...form, scope_type: v })} />
              {form.scope_type !== "global" && (
                <TextInput label="Scope id" required type="number" value={form.scope_id} onChange={(e) => setForm({ ...form, scope_id: e.target.value })} error={errors.scope_id?.[0]} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Percentage" required type="number" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} error={errors.percentage?.[0]} />
              <TextInput label="Fixed amount (optional)" type="number" value={form.fixed_amount} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Min amount (optional)" type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} />
              <TextInput label="Max amount (optional)" type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} error={errors.max_amount?.[0]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Applies to" required options={APPLIES_TO_OPTIONS} value={form.applies_to} onChange={(v) => setForm({ ...form, applies_to: v })} />
              <SelectInput label="Processing fee borne by" required options={FEE_BORNE_OPTIONS} value={form.processing_fee_borne_by} onChange={(v) => setForm({ ...form, processing_fee_borne_by: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextInput label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              <TextInput label="Effective from" required type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} error={errors.effective_from?.[0]} />
              <TextInput label="Effective to (optional)" type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} error={errors.effective_to?.[0]} />
            </div>
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
            <AlertDialogDescription>Bookings already confirmed under this rule keep their frozen rate — this only stops it applying to future ones.</AlertDialogDescription>
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
