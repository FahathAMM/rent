"use client";

import platformApi from "@/lib/platformAxios";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TextInput, PasswordInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Pencil, Trash2, Home } from "lucide-react";
import { getInitials, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { ActionButton } from "@/components/Datatable/ActionButton";

// Must match SystemAdmin::ROLE_* and the admin_role rule in Store/UpdateSystemAdminRequest.
const ROLE_OPTIONS = [
  { value: "platform_owner", label: "Platform Owner" },
  { value: "admin", label: "Admin" },
  { value: "finance", label: "Finance" },
  { value: "moderator", label: "Moderator" },
  { value: "support", label: "Support" },
];
const roleLabel = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role ?? "—";

const STATUS_OPTIONS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];

// `status` is a select-friendly string; it is sent to the API as the is_active boolean.
const defaultForm = { name: "", email: "", password: "", admin_role: "admin", status: "active" };

export default function PlatformUsersPage() {
  const currentAdmin = usePlatformAuthStore((s) => s.admin);
  const isOwner = currentAdmin?.admin_role === "platform_owner";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const create = useMutation({
    mutationFn: platformService.users.create,
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Platform admin created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => platformService.users.update(id, data),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Platform admin updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: platformService.users.delete,
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Platform admin deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));

  const openCreate = () => { setEditing(null); setForm(defaultForm); setErrors({}); setOpen(true); };
  const openEdit = (admin) => {
    setEditing(admin);
    setForm({ name: admin.name, email: admin.email, password: "", admin_role: admin.admin_role, status: admin.is_active ? "active" : "inactive" });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const { status, ...data } = form;
    if (editing) {
      if (!data.password) delete data.password;
      update.mutate({ id: editing.id, data: { ...data, is_active: status === "active" } });
    } else {
      create.mutate(data);
    }
  };

  const columns = () => [
    {
      accessorKey: "name", header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{getInitials(row.name)}</div>
          <div><p className="font-medium">{row.name}</p><p className="text-[11px] text-muted-foreground">{row.email}</p></div>
        </div>
      ),
    },
    { accessorKey: "admin_role", header: "Role", cell: (row) => <Badge variant={row.admin_role === "platform_owner" ? "default" : "secondary"}>{roleLabel(row.admin_role)}</Badge> },
    { accessorKey: "is_active", header: "Status", cell: (row) => <Badge variant={row.is_active ? "success" : "secondary"}>{row.is_active ? "Active" : "Inactive"}</Badge> },
    { accessorKey: "last_login_at", header: "Last Login", cell: (row) => row.last_login_at ? formatDateTime(row.last_login_at) : "Never" },
    ...(isOwner ? [{
      accessorKey: "actions", header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit admin" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          {row.id !== currentAdmin?.id && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete admin" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    }] : []),
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Platform Users" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          api={platformApi}
          endpoint="/platform/users"
          columns={columns}
          breadcrumb={[]}
          isSheet={isOwner}
          openSheet={openCreate}
          model="Platform Admin"
        />
      </HomePageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Platform Admin" : "New Platform Admin"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" value={form.name} onChange={fi("name")} error={errors.name?.[0]} required />
            <TextInput label="Email" type="email" value={form.email} onChange={fi("email")} error={errors.email?.[0]} required />
            <PasswordInput label={editing ? "New Password (leave blank to keep current)" : "Password"} value={form.password} onChange={fi("password")} error={errors.password?.[0]} required={!editing} />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Role" required value={form.admin_role} onChange={f("admin_role")} options={ROLE_OPTIONS} error={errors.admin_role?.[0]} />
              {editing && <SelectInput label="Status" value={form.status} onChange={f("status")} options={STATUS_OPTIONS} error={errors.is_active?.[0]} />}
            </div>
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
        title="Delete Platform Admin"
        description={`Delete "${deleteTarget?.name}"? They will immediately lose access to the platform console.`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
