"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformSystemAdminService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TextInput, PasswordInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import { getInitials, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const defaultForm = { name: "", email: "", password: "", role: "platform_admin", status: "active" };

export default function PlatformUsersPage() {
  const queryClient = useQueryClient();
  const currentAdmin = usePlatformAuthStore((s) => s.admin);
  const isOwner = currentAdmin?.role === "platform_owner";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-system-admins"],
    queryFn: () => platformSystemAdminService.getAll().then((r) => r.data.data),
  });

  const create = useMutation({
    mutationFn: platformSystemAdminService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-system-admins"] }); toast.success("Platform admin created"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => platformSystemAdminService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-system-admins"] }); toast.success("Platform admin updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: platformSystemAdminService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-system-admins"] }); toast.success("Platform admin deleted"); setDeleteTarget(null); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setDeleteTarget(null); },
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));

  const openCreate = () => { setEditing(null); setForm(defaultForm); setErrors({}); setOpen(true); };
  const openEdit = (admin) => { setEditing(admin); setForm({ name: admin.name, email: admin.email, password: "", role: admin.role, status: admin.status }); setErrors({}); setOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const data = { ...form };
    if (editing && !data.password) delete data.password;
    if (editing) update.mutate({ id: editing.id, data });
    else create.mutate(data);
  };

  const columns = [
    {
      key: "name", header: "Name",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{getInitials(row.name)}</div>
          <div><p className="font-medium">{row.name}</p><p className="text-[11px] text-muted-foreground">{row.email}</p></div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (row) => <Badge variant={row.role === "platform_owner" ? "default" : "secondary"} className="capitalize">{row.role.replace("_", " ")}</Badge> },
    { key: "status", header: "Status", render: (row) => <Badge variant={row.status === "active" ? "success" : "secondary"} className="capitalize">{row.status}</Badge> },
    { key: "last_login_at", header: "Last Login", render: (row) => row.last_login_at ? formatDateTime(row.last_login_at) : "Never" },
    ...(isOwner ? [{
      key: "actions", header: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>
          {row.id !== currentAdmin?.id && (
            <Button variant="outline" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(row)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
      <PageWrapper breadcrumb={breadcrumbItems}>
        <PageHeader
          title="Platform Users"
          description="Platform Owner and Platform Admin accounts — separate from company users."
          action={isOwner ? <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Platform Admin</Button> : null}
        />

        <DataTable columns={columns} data={data ?? []} loading={isLoading} />
      </PageWrapper>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Platform Admin" : "New Platform Admin"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <ValidationError errors={errors} />
            <TextInput label="Name" value={form.name} onChange={fi("name")} error={errors.name?.[0]} required />
            <TextInput label="Email" type="email" value={form.email} onChange={fi("email")} error={errors.email?.[0]} required />
            <PasswordInput label={editing ? "New Password (leave blank to keep current)" : "Password"} value={form.password} onChange={fi("password")} error={errors.password?.[0]} required={!editing} />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Role" value={form.role} onChange={f("role")} options={[{ value: "platform_owner", label: "Platform Owner" }, { value: "platform_admin", label: "Platform Admin" }]} />
              {editing && <SelectInput label="Status" value={form.status} onChange={f("status")} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />}
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
