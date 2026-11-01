"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useAuthStore } from "@/store/authStore";
import { getInitials } from "@/lib/utils";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { Pencil, Trash2, User as UserIcon, Home } from "lucide-react";
import { toast } from "sonner";

const defaultForm = {
  name: "", email: "", phone: "", password: "", role_id: "",
  employee_id: "", joining_date: "", emergency_contact: "",
};

const ACTION_ORDER = ["view", "create", "edit", "delete"];
const titleCase = (v) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Read-only summary of a role's permissions ("vendor-vehicles-list-edit" →
 * Vehicles · List: view, edit). Access comes from the role alone — pick a
 * different role to change it.
 */
function RolePermissions({ permissions }) {
  if (!permissions) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const areas = {};
  permissions.forEach((name) => {
    const parts = name.replace(/^vendor-/, "").split("-");
    const action = parts.pop();
    const area = parts.map(titleCase).join(" · ");
    (areas[area] ??= []).push(action);
  });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Object.entries(areas).map(([area, actions]) => (
        <div key={area} className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{area}</span>
          <span className="flex flex-wrap justify-end gap-1">
            {actions.sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)).map((a) => (
              <span key={a} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">{a}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StaffPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Roles the owner created: [{ id, name, permissions }]
  const { data: roleOptions } = useQuery({
    queryKey: ["vendor-staff-roles"],
    queryFn: () => vendorService.staff.roles().then((r) => r.data.data),
  });
  const pickedRole = roleOptions?.find((r) => String(r.id) === form.role_id);

  const invite = useMutation({
    mutationFn: (payload) => vendorService.staff.invite(payload),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member added"); setOpen(false); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.response?.data?.message ?? "Could not add the staff member");
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }) => vendorService.staff.update(id, data),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => vendorService.staff.remove(id),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member removed"); setRemoveTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to remove"); setRemoveTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, role_id: roleOptions?.[0] ? String(roleOptions[0].id) : "" });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      name: member.user?.name ?? "",
      email: member.user?.email ?? "",
      phone: member.user?.phone ?? "",
      password: "",
      role_id: member.role_id ? String(member.role_id) : "",
      employee_id: member.employee_id ?? "",
      joining_date: member.joining_date?.slice(0, 10) ?? "",
      emergency_contact: member.emergency_contact ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const selectRole = (value) => setForm((p) => ({ ...p, role_id: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      name: form.name,
      phone: form.phone || null,
      role_id: form.role_id ? Number(form.role_id) : null,
      employee_id: form.employee_id || null,
      joining_date: form.joining_date || null,
      emergency_contact: form.emergency_contact || null,
    };
    // Editing: a blank password keeps the current one.
    if (editing) updateRole.mutate({ id: editing.id, data: { ...payload, ...(form.password ? { password: form.password } : {}) } });
    else invite.mutate({ ...payload, email: form.email, password: form.password });
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "avatar",
      header: "Photo",
      class: "w-14",
      cell: (row) => row.user?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.user.avatar} alt={row.user?.name} className="my-2 h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="my-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {getInitials(row.user?.name ?? "") || <UserIcon className="h-4 w-4" />}
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.user?.name ?? "—"}</p>
          {row.employee_id && <p className="text-[10px] font-mono text-muted-foreground">{row.employee_id}</p>}
        </div>
      ),
    },
    { accessorKey: "email", header: "Email", cell: (row) => row.user?.email ?? "—" },
    {
      accessorKey: "role",
      header: () => <SortableHeader label="Role" column="role" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <span className="capitalize">{row.role_label ?? row.role}</span>,
    },
    {
      accessorKey: "joining_date",
      header: "Joined",
      cell: (row) => row.joining_date ? row.joining_date.slice(0, 10) : "—",
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

  const isPending = invite.isPending || updateRole.isPending;

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

      <Modal open={open} onOpenChange={setOpen} title={editing ? "Edit Staff Member" : "Add Staff Member"} size="3xl" headerBorder>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <div className="flex gap-3">
            <Fieldset legend="Photo" grid={false} className="shrink-0">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted">
                {editing?.user?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </Fieldset>

            <Fieldset legend="Login & Contact" grid={2} className="flex-1">
              <TextInput label="Full Name" required value={form.name} onChange={fi("name")} placeholder="e.g. Kasun Perera" error={errors.name?.[0]} />
              <TextInput
                label="Email (login)"
                type="email"
                required
                value={form.email}
                onChange={fi("email")}
                disabled={!!editing}
                placeholder="staff@example.com"
                error={errors.email?.[0]}
              />
              <TextInput label="Phone" value={form.phone} onChange={fi("phone")} placeholder="07XXXXXXXX" error={errors.phone?.[0]} />
              <TextInput
                label={editing ? "New Password" : "Password"}
                type="password"
                required={!editing}
                autoComplete="new-password"
                value={form.password}
                onChange={fi("password")}
                placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"}
                error={errors.password?.[0]}
              />
            </Fieldset>
          </div>

          <Fieldset legend="Role & Work Details" grid={2}>
            <SelectInput
              label="Role"
              options={(roleOptions ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
              value={form.role_id}
              onChange={selectRole}
              error={errors.role_id?.[0]}
            />
            <TextInput label="Employee ID" value={form.employee_id} onChange={fi("employee_id")} placeholder="e.g. EMP-001" error={errors.employee_id?.[0]} />
            <DatePicker label="Joining Date" value={form.joining_date} onChange={(v) => setForm((p) => ({ ...p, joining_date: v }))} error={errors.joining_date?.[0]} />
            <TextInput label="Emergency Contact" value={form.emergency_contact} onChange={fi("emergency_contact")} placeholder="Name & number" className="col-span-2" error={errors.emergency_contact?.[0]} />
          </Fieldset>

          <Fieldset legend={`What ${pickedRole?.name ?? "this role"} can do`}>
            <RolePermissions permissions={pickedRole?.permissions} />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </Modal>

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
