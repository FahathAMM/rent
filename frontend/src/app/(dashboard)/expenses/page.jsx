"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { expenseService } from "@/services/expenseService";
import { expenseCategoryService } from "@/services/expenseCategoryService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { AttachmentPanel } from "@/components/shared/AttachmentPanel";
import { toast } from "sonner";
import { Pencil, Trash2, Home } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const PAYMENT_METHODS = [
  { value: "", label: "Not specified" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const defaultForm = {
  expense_category_id: "",
  expense_date: new Date().toISOString().slice(0, 10),
  vendor_name: "",
  description: "",
  subtotal: "",
  tax_rate: "",
  payment_method: "",
  reference_no: "",
  notes: "",
};

export default function ExpensesPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: categories } = useQuery({
    queryKey: ["expense-categories-lite"],
    queryFn: () => expenseCategoryService.getAll({ perPage: 100 }).then((r) => r.data.record.data),
  });

  const create = useMutation({
    mutationFn: expenseService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Expense recorded");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => expenseService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Expense updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: expenseService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Expense deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setForm({
      expense_category_id: expense.expense_category_id ? String(expense.expense_category_id) : "",
      expense_date: expense.expense_date?.slice(0, 10) ?? "",
      vendor_name: expense.vendor_name ?? "",
      description: expense.description ?? "",
      subtotal: expense.subtotal ?? "",
      tax_rate: expense.tax_rate ?? "",
      payment_method: expense.payment_method ?? "",
      reference_no: expense.reference_no ?? "",
      notes: expense.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      expense_category_id: form.expense_category_id || null,
      expense_date: form.expense_date,
      vendor_name: form.vendor_name || null,
      description: form.description || null,
      subtotal: form.subtotal,
      tax_rate: form.tax_rate || null,
      payment_method: form.payment_method || null,
      reference_no: form.reference_no || null,
      notes: form.notes || null,
    };

    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const categoryOptions = [{ value: "", label: "Uncategorized" }, ...(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))];

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "expense_number",
      header: () => <SortableHeader label="Number" column="expense_number" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    {
      accessorKey: "expense_date",
      header: () => <SortableHeader label="Date" column="expense_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => row.expense_date?.slice(0, 10),
    },
    { accessorKey: "category", header: "Category", cell: (row) => row.category?.name ?? "—" },
    { accessorKey: "vendor_name", header: "Paid To", cell: (row) => row.vendor_name ?? "—" },
    {
      accessorKey: "total",
      header: () => <SortableHeader label="Total" column="total" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => Number(row.total).toFixed(2),
    },
    { accessorKey: "payment_method", header: "Method", cell: (row) => row.payment_method ?? "—" },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("vendor-expense-expenses-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit expense" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("vendor-expense-expenses-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete expense" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Expenses" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/expenses"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="expense_date"
          defaultSortOrder="desc"
          isSheet={can("vendor-expense-expenses-create")}
          openSheet={openCreate}
          model="Expense"
        />
      </HomePageWrapper>

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Expense" : "Record Expense"} size="2xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Details" grid={2}>
            <DatePicker label="Date" value={form.expense_date} onChange={f("expense_date")} required error={errors.expense_date?.[0]} />
            <SelectInput label="Category" value={form.expense_category_id} onChange={f("expense_category_id")} options={categoryOptions} error={errors.expense_category_id?.[0]} />
            <TextInput label="Paid To" value={form.vendor_name} onChange={fi("vendor_name")} placeholder="e.g. DEWA, landlord, feed supplier" error={errors.vendor_name?.[0]} />
            <SelectInput label="Payment Method" value={form.payment_method} onChange={f("payment_method")} options={PAYMENT_METHODS} error={errors.payment_method?.[0]} />
            <TextInput label="Description" value={form.description} onChange={fi("description")} className="col-span-2" error={errors.description?.[0]} />
          </Fieldset>

          <Fieldset legend="Amount" grid={3}>
            <TextInput label="Amount" type="number" step="0.01" min="0" value={form.subtotal} onChange={fi("subtotal")} required error={errors.subtotal?.[0]} />
            <TextInput label="Tax Rate (%)" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={fi("tax_rate")} error={errors.tax_rate?.[0]} />
            <TextInput label="Reference No." value={form.reference_no} onChange={fi("reference_no")} error={errors.reference_no?.[0]} />
          </Fieldset>

          <Fieldset legend="Notes" grid={1}>
            <TextareaInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
          </Fieldset>

          {editing && (
            <Fieldset legend="Receipt / Documents" grid={1}>
              <AttachmentPanel attachableType="expense" attachableId={editing.id} />
            </Fieldset>
          )}

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Expense"
        description={`Delete expense "${deleteTarget?.expense_number}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
