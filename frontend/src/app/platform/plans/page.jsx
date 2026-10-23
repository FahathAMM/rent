"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformPlanService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TextInput, NumberInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2, Package, Home } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const defaultForm = {
  name: "", slug: "", monthly_price: "0", yearly_price: "",
  max_users: "", max_customers: "", max_invoices: "",
  trial_days: "14", status: "active", sort_order: "0",
  accounting_disabled: false,
};

export default function PlatformPlansPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformPlanService.getAll().then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: platformPlanService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-plans"] }); toast.success("Plan created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => platformPlanService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-plans"] }); toast.success("Plan updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: platformPlanService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-plans"] }); toast.success("Plan deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete plan"); setDeleteTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));

  const openCreate = () => { setEditing(null); setForm(defaultForm); setErrors({}); setOpen(true); };
  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      name: plan.name, slug: plan.slug,
      monthly_price: String(plan.monthly_price ?? 0), yearly_price: plan.yearly_price != null ? String(plan.yearly_price) : "",
      max_users: plan.max_users != null ? String(plan.max_users) : "", max_customers: plan.max_customers != null ? String(plan.max_customers) : "",
      max_invoices: plan.max_invoices != null ? String(plan.max_invoices) : "",
      trial_days: String(plan.trial_days ?? 14), status: plan.status, sort_order: String(plan.sort_order ?? 0),
      accounting_disabled: (plan.disabled_modules ?? []).includes("accounting"),
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const { accounting_disabled, ...rest } = form;
    const data = {
      ...rest,
      yearly_price: form.yearly_price || null,
      max_users: form.max_users || null,
      max_customers: form.max_customers || null,
      max_invoices: form.max_invoices || null,
      disabled_modules: accounting_disabled ? ["accounting"] : [],
    };
    if (editing) update.mutate({ id: editing.id, data });
    else create.mutate(data);
  };

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Plans" },
  ];

  return (
    <div>
      <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Plans"
        description="Subscription plans available to every company on the platform."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Plan</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <Package className="h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">No plans yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <Badge variant={plan.status === "active" ? "success" : "secondary"} className="capitalize">{plan.status}</Badge>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(plan.monthly_price)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                {plan.yearly_price != null && <p className="text-xs text-muted-foreground">{formatCurrency(plan.yearly_price)}/year</p>}
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>Users: {plan.max_users ?? "Unlimited"}</li>
                  <li>Customers: {plan.max_customers ?? "Unlimited"}</li>
                  <li>Invoices: {plan.max_invoices ?? "Unlimited"}</li>
                  <li>Trial: {plan.trial_days} days</li>
                  <li>Subscribers: {plan.subscriptions_count ?? 0}</li>
                  {(plan.disabled_modules ?? []).includes("accounting") && (
                    <li className="text-amber-600">Accounting module disabled</li>
                  )}
                </ul>
                <div className="mt-4 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(plan)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(plan)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Name" value={form.name} onChange={fi("name")} error={errors.name?.[0]} required />
              <TextInput label="Slug" value={form.slug} onChange={fi("slug")} error={errors.slug?.[0]} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Monthly Price" min="0" step="0.01" value={form.monthly_price} onChange={fi("monthly_price")} error={errors.monthly_price?.[0]} required />
              <NumberInput label="Yearly Price" min="0" step="0.01" value={form.yearly_price} onChange={fi("yearly_price")} error={errors.yearly_price?.[0]} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="Max Users" min="1" value={form.max_users} onChange={fi("max_users")} error={errors.max_users?.[0]} placeholder="∞" />
              <NumberInput label="Max Customers" min="1" value={form.max_customers} onChange={fi("max_customers")} error={errors.max_customers?.[0]} placeholder="∞" />
              <NumberInput label="Max Invoices" min="1" value={form.max_invoices} onChange={fi("max_invoices")} error={errors.max_invoices?.[0]} placeholder="∞" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="Trial Days" min="0" value={form.trial_days} onChange={fi("trial_days")} error={errors.trial_days?.[0]} required />
              <NumberInput label="Sort Order" min="0" value={form.sort_order} onChange={fi("sort_order")} error={errors.sort_order?.[0]} />
              <SelectInput label="Status" value={form.status} onChange={f("status")} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.accounting_disabled} onCheckedChange={(c) => setForm((p) => ({ ...p, accounting_disabled: !!c }))} />
              Disable Accounting module for this plan
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Plan"
        description={`Delete "${deleteTarget?.name}"? Companies with an active or historical subscription to this plan will block this.`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
