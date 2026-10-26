"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorStaffService } from "@/services/vendorStaffService";
import { useAuthStore } from "@/store/authStore";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Pencil, Trash2, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

const emptyInvite = { email: "", role: "staff" };

export default function StaffPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyInvite);
  const [errors, setErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const invite = useMutation({
    mutationFn: (payload) => vendorStaffService.invite(payload),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member added"); setOpen(false); setForm(emptyInvite); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }) => vendorStaffService.update(id, data),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => vendorStaffService.remove(id),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member removed"); setRemoveTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to remove"); setRemoveTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyInvite); setErrors({}); setOpen(true); };
  const openEdit = (member) => { setEditing(member); setForm({ email: member.user?.email ?? "", role: member.role }); setErrors({}); setOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    if (editing) updateRole.mutate({ id: editing.id, data: { role: form.role, abilities: editing.abilities ?? [] } });
    else invite.mutate({ email: form.email, role: form.role });
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    { accessorKey: "name", header: "Name", cell: (row) => row.user?.name ?? "—" },
    { accessorKey: "email", header: "Email", cell: (row) => row.user?.email ?? "—" },
    {
      accessorKey: "role",
      header: () => <SortableHeader label="Role" column="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="capitalize">{row.role}</span>,
    },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => row.role === "owner" ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <div className="flex gap-1">
          {can("vendor-staff-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit staff member" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("vendor-staff-delete") && (
            <ActionButton onClick={() => setRemoveTarget(row)} icon={Trash2} label="Remove staff member" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Staff" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/staff"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="role"
          defaultSortOrder="asc"
          isSheet={can("vendor-staff-create")}
          openSheet={openCreate}
          model="Staff Member"
        />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} error={errors.email?.[0]} />
            <SelectInput label="Role" options={ROLE_OPTIONS} value={form.role} onChange={(v) => setForm({ ...form, role: v })} error={errors.role?.[0]} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={invite.isPending || updateRole.isPending}>
                {(invite.isPending || updateRole.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
        title="Remove Staff Member"
        description={`Remove ${removeTarget?.user?.name}? They will immediately lose access to this shop.`}
        onConfirm={() => remove.mutate(removeTarget.id)}
        loading={remove.isPending}
        confirmText="Remove"
      />
    </div>
  );
}
