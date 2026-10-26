"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorBankDetailService } from "@/services/vendorBankDetailService";
import { useAuthStore } from "@/store/authStore";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Home, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  account_holder_name: "", bank_name: "", bank_code: "", branch_name: "", branch_code: "",
  account_number: "", account_type: "", is_primary: false,
};

export default function BankDetailsPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const save = useMutation({
    mutationFn: (payload) => vendorBankDetailService.create(payload),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Bank detail added"); setOpen(false); setForm(emptyForm); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const makePrimary = useMutation({
    mutationFn: (id) => vendorBankDetailService.makePrimary(id),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Primary bank detail updated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id) => vendorBankDetailService.delete(id),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Bank detail deleted"); setDeleteTarget(null); },
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

  const columns = () => [
    { accessorKey: "bank_name", header: "Bank", cell: (row) => <span className="font-medium">{row.bank_name}</span> },
    { accessorKey: "account_holder_name", header: "Account Holder" },
    { accessorKey: "account_number_last4", header: "Account No.", cell: (row) => `•••• ${row.account_number_last4}` },
    { accessorKey: "verification_status", header: "Status", cell: (row) => <StatusBadge status={row.verification_status} /> },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          {row.is_primary ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> Primary</span>
          ) : canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => makePrimary.mutate(row.id)} disabled={makePrimary.isPending}>Make primary</Button>
          )}
          {canEdit && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete bank detail" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
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
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/bank-details"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="is_primary"
          defaultSortOrder="desc"
          isSheet={canEdit}
          openSheet={openCreate}
          model="Bank Detail"
        />
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Bank Detail"
        description="This cannot be undone."
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
