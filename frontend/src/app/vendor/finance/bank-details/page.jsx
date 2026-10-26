"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorBankDetailService } from "@/services/vendorBankDetailService";
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
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Plus, Home, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  account_holder_name: "", bank_name: "", bank_code: "", branch_name: "", branch_code: "",
  account_number: "", account_type: "", is_primary: false,
};

export default function BankDetailsPage() {
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-bank-details"],
    queryFn: () => vendorBankDetailService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-bank-details"] });

  const save = useMutation({
    mutationFn: (payload) => vendorBankDetailService.create(payload),
    onSuccess: () => { invalidate(); toast.success("Bank detail added"); setOpen(false); setForm(emptyForm); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const makePrimary = useMutation({
    mutationFn: (id) => vendorBankDetailService.makePrimary(id),
    onSuccess: () => { invalidate(); toast.success("Primary bank detail updated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id) => vendorBankDetailService.delete(id),
    onSuccess: () => { invalidate(); toast.success("Bank detail deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => { setForm(emptyForm); setErrors({}); setOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate(form);
  };

  const canEdit = can("vendor-finance-bank_details-edit");
  const details = data ?? [];

  const columns = [
    { key: "bank_name", header: "Bank", render: (row) => <span className="font-medium">{row.bank_name}</span> },
    { key: "account_holder_name", header: "Account Holder" },
    { key: "account_number_last4", header: "Account No.", render: (row) => `•••• ${row.account_number_last4}` },
    { key: "verification_status", header: "Status", render: (row) => <StatusBadge status={row.verification_status} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.is_primary ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> Primary</span>
          ) : canEdit && (
            <Button size="sm" variant="outline" onClick={() => makePrimary.mutate(row.id)} disabled={makePrimary.isPending}>Make primary</Button>
          )}
          {canEdit && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" /></Button>
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Bank Details" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Bank Details"
          description="Where your payouts are sent. Only the shop owner can view or change this."
          action={canEdit && (
            <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Add Bank Detail</Button>
          )}
        />

        <DataTable columns={columns} data={details} loading={isLoading} />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Bank Detail</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <Fieldset legend="Account" grid={1}>
              <TextInput label="Account Holder Name" required value={form.account_holder_name} onChange={fi("account_holder_name")} error={errors.account_holder_name?.[0]} />
              <TextInput label="Bank Name" required value={form.bank_name} onChange={fi("bank_name")} error={errors.bank_name?.[0]} />
              <TextInput label="Branch Name" value={form.branch_name} onChange={fi("branch_name")} error={errors.branch_name?.[0]} />
              <TextInput label="Account Number" required value={form.account_number} onChange={fi("account_number")} error={errors.account_number?.[0]} />
              <TextInput label="Account Type (optional)" value={form.account_type} onChange={fi("account_type")} error={errors.account_type?.[0]} />
            </Fieldset>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: !!v })} />
              Set as primary payout account
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
            <AlertDialogTitle>Delete this bank detail?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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
