"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { toast } from "sonner";
import { Pencil, Trash2, Home } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  credit_terms_days: "0",
  notes: "",
};

export default function CustomersPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const create = useMutation({
    mutationFn: customerService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Customer created");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => customerService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Customer updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: customerService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Customer deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      credit_terms_days: String(customer.credit_terms_days ?? 0),
      notes: customer.notes ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      credit_terms_days: form.credit_terms_days || 0,
      notes: form.notes || null,
    };

    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "name",
      header: () => <SortableHeader label="Name" column="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    { accessorKey: "phone", header: "Phone", cell: (row) => row.phone ?? "—" },
    { accessorKey: "email", header: "Email", cell: (row) => row.email ?? "—" },
    {
      accessorKey: "credit_terms_days",
      header: "Credit Terms",
      cell: (row) => (row.credit_terms_days > 0 ? `${row.credit_terms_days} days` : "Pay on delivery"),
    },
    {
      accessorKey: "sales_count",
      header: "Sales",
      cell: (row) => row.sales_count ?? 0,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("sales-customers-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit customer" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("sales-customers-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete customer" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Customers" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/customers"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="name"
          defaultSortOrder="asc"
          isSheet={can("sales-customers-create")}
          openSheet={openCreate}
          model="Customer"
        />
      </HomePageWrapper>

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Customer" : "Add Customer"} size="2xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Details" grid={2}>
            <TextInput label="Name" value={form.name} onChange={fi("name")} required error={errors.name?.[0]} />
            <TextInput label="Phone" value={form.phone} onChange={fi("phone")} error={errors.phone?.[0]} />
            <TextInput label="Email" type="email" value={form.email} onChange={fi("email")} error={errors.email?.[0]} />
            <TextInput
              label="Credit Terms (days)"
              type="number"
              min="0"
              max="365"
              value={form.credit_terms_days}
              onChange={fi("credit_terms_days")}
              error={errors.credit_terms_days?.[0]}
            />
          </Fieldset>

          <Fieldset legend="Address & Notes" grid={1}>
            <TextareaInput label="Address" value={form.address} onChange={fi("address")} error={errors.address?.[0]} />
            <TextareaInput label="Notes" value={form.notes} onChange={fi("notes")} error={errors.notes?.[0]} />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Customer"
        description={`Delete "${deleteTarget?.name}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
