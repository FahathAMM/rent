"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import platformApi from "@/lib/platformAxios";
import { platformService } from "@/services/platformService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { FilterSelect } from "@/components/Datatable/FilterSelect";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { appDateKey, formatDate } from "@/lib/utils";
import { ACCOUNTS_SUMMARY_KEY, EXPENSE_CATEGORIES, PAYMENT_METHODS, categoryLabel } from "./labels";

const emptyForm = () => ({
  expense_date: appDateKey(),
  category: "hosting",
  paid_to: "",
  description: "",
  amount: "",
  payment_method: "",
  reference_no: "",
  notes: "",
});

/** The platform's own costs: record, edit and delete. They feed the profit / loss figures above. */
export function ExpensesTab({ from, to }) {
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = () => {
    setRefreshKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: [ACCOUNTS_SUMMARY_KEY] });
  };

  const save = useMutation({
    mutationFn: (data) => (editing ? platformService.accounts.updateExpense(editing.id, data) : platformService.accounts.createExpense(data)),
    onSuccess: () => {
      toast.success(editing ? "Expense updated" : "Expense recorded");
      setOpen(false);
      reload();
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Could not save the expense");
    },
  });

  const remove = useMutation({
    mutationFn: (id) => platformService.accounts.deleteExpense(id),
    onSuccess: () => {
      toast.success("Expense deleted");
      setDeleteTarget(null);
      reload();
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not delete the expense"),
  });

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));
  const setInput = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setForm({
      expense_date: expense.expense_date?.slice(0, 10) ?? "",
      category: expense.category ?? "other",
      paid_to: expense.paid_to ?? "",
      description: expense.description ?? "",
      amount: expense.amount ?? "",
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
    save.mutate({
      expense_date: form.expense_date,
      category: form.category,
      paid_to: form.paid_to || null,
      description: form.description || null,
      amount: form.amount,
      payment_method: form.payment_method || null,
      reference_no: form.reference_no || null,
      notes: form.notes || null,
    });
  };

  const columns = ({ sortField, sortOrder, handleSort }) => {
    const sortable = (label, column) => function SortHeader() { return <SortableHeader label={label} column={column} sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />; };
    return [
      { accessorKey: "expense_date", header: sortable("Date", "expense_date"), cell: (row) => <span className="whitespace-nowrap">{formatDate(row.expense_date)}</span> },
      { accessorKey: "expense_number", header: "Number", cell: (row) => <span className="font-mono text-[11px]">{row.expense_number}</span> },
      { accessorKey: "category", header: sortable("Category", "category"), cell: (row) => categoryLabel(row.category) },
      {
        accessorKey: "paid_to", header: "Paid to", style: { width: "24%" },
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate">{row.paid_to || "—"}</p>
            {row.description && <p className="truncate text-[10px] font-normal text-muted-foreground">{row.description}</p>}
          </div>
        ),
      },
      { accessorKey: "amount", header: sortable("Amount", "amount"), cell: (row) => <span className="font-semibold tabular-nums">{format(row.amount)}</span> },
      { accessorKey: "payment_method", header: "Method", cell: (row) => PAYMENT_METHODS.find((m) => m.value && m.value === row.payment_method)?.label ?? "—" },
      {
        accessorKey: "actions", header: "Actions",
        cell: (row) => (
          <div className="flex gap-1">
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit expense" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete expense" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          </div>
        ),
      },
    ];
  };

  return (
    <>
      <ServerDataTable
        key={refreshKey}
        api={platformApi}
        endpoint="/platform/accounts/expenses"
        columns={columns}
        breadcrumb={[]}
        defualtSortField="expense_date"
        defaultSortOrder="desc"
        filters={{ from: from || undefined, to: to || undefined, category: category || undefined }}
        isSheet
        openSheet={openCreate}
        model="Expense"
      >
        <FilterSelect value={category} onChange={setCategory} options={EXPENSE_CATEGORIES} allLabel="All categories" />
      </ServerDataTable>

      <Modal open={open} onOpenChange={setOpen} title={editing ? `Edit expense ${editing.expense_number}` : "Record expense"} size="2xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Details" grid={2}>
            <DatePicker label="Date" value={form.expense_date} onChange={set("expense_date")} required error={errors.expense_date?.[0]} />
            <SelectInput label="Category" value={form.category} onChange={set("category")} options={EXPENSE_CATEGORIES} required error={errors.category?.[0]} />
            <TextInput label="Paid to" value={form.paid_to} onChange={setInput("paid_to")} placeholder="e.g. hosting company, ad platform" error={errors.paid_to?.[0]} />
            <TextInput label="Amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={setInput("amount")} required error={errors.amount?.[0]} />
            <TextInput label="Description" value={form.description} onChange={setInput("description")} className="col-span-2" error={errors.description?.[0]} />
          </Fieldset>

          <Fieldset legend="Payment" grid={2}>
            <SelectInput label="Payment method" value={form.payment_method} onChange={set("payment_method")} options={PAYMENT_METHODS} error={errors.payment_method?.[0]} />
            <TextInput label="Reference no." value={form.reference_no} onChange={setInput("reference_no")} placeholder="Invoice or transfer number" error={errors.reference_no?.[0]} />
          </Fieldset>

          <Fieldset legend="Notes" grid={1}>
            <TextareaInput label="Notes" value={form.notes} onChange={setInput("notes")} error={errors.notes?.[0]} />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex items-center justify-end gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete expense"
        description={deleteTarget ? `Delete ${deleteTarget.expense_number} (${format(deleteTarget.amount)})? It is removed from the profit / loss figures.` : ""}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </>
  );
}
