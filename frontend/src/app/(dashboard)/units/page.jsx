"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { unitService } from "@/services/unitService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { toast } from "sonner";
import { Pencil, Trash2, Home } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const defaultForm = { name: "", short_name: "" };

export default function UnitsPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const create = useMutation({
    mutationFn: unitService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Unit created");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => unitService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Unit updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: unitService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("Unit deleted");
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

  const openEdit = (unit) => {
    setEditing(unit);
    setForm({ name: unit.name, short_name: unit.short_name ?? "" });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = { name: form.name, short_name: form.short_name || null };

    if (editing) update.mutate({ id: editing.id, data: payload });
    else create.mutate(payload);
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "name",
      header: () => <SortableHeader label="Name" column="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    { accessorKey: "short_name", header: "Short Name", cell: (row) => row.short_name ?? "—" },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("product-unit-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit unit" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("product-unit-delete") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete unit" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Units" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/units"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="name"
          defaultSortOrder="asc"
          isSheet={can("product-unit-create")}
          openSheet={openCreate}
          model="Unit"
        />
      </HomePageWrapper>

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Unit" : "Add Unit"} size="sm" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <Fieldset legend="Details" grid={1}>
            <TextInput label="Name" value={form.name} onChange={fi("name")} placeholder="e.g. Kilogram" required error={errors.name?.[0]} />
            <TextInput label="Short Name" value={form.short_name} onChange={fi("short_name")} placeholder="e.g. kg" error={errors.short_name?.[0]} />
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
        title="Delete Unit"
        description={`Delete "${deleteTarget?.name}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
