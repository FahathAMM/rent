"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGrid } from "@/components/shared/PermissionGrid";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Home, KeyRound, Pencil, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { name: "", permissions: new Set() };

/**
 * The shop owner's own roles (e.g. "Driver"): create them, pick what each can
 * do, then give them to staff on the Staff page. Staff management, roles and
 * bank details always stay with the owner, so they aren't offered.
 */
export default function VendorRolesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-roles"],
    queryFn: () => vendorService.roles.getAll().then((r) => r.data.data),
  });
  const { data: groups } = useQuery({
    queryKey: ["vendor-role-permissions"],
    queryFn: () => vendorService.roles.permissions().then((r) => r.data.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vendor-roles"] });
    qc.invalidateQueries({ queryKey: ["vendor-staff-roles"] });
  };
  const onError = (err) => {
    setErrors(err.response?.data?.errors ?? {});
    if (!err.response?.data?.errors) toast.error(err.response?.data?.message ?? "Something went wrong");
  };

  const save = useMutation({
    mutationFn: (payload) => (editing ? vendorService.roles.update(editing.id, payload) : vendorService.roles.create(payload)),
    onSuccess: () => { toast.success(editing ? "Role updated" : "Role created"); setOpen(false); refresh(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id) => vendorService.roles.remove(id),
    onSuccess: () => { toast.success("Role deleted"); setRemoveTarget(null); refresh(); },
    onError: (err) => { toast.error(err.response?.data?.message ?? "Failed to delete"); setRemoveTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, permissions: new Set(["vendor-dashboard-view"]) }); setErrors({}); setOpen(true); };
  const openEdit = (role) => {
    setEditing(role);
    setForm({ name: role.name, permissions: new Set(role.permissions) });
    setErrors({});
    setOpen(true);
  };
  const toggle = (names, on) => setForm((p) => {
    const next = new Set(p.permissions);
    names.forEach((n) => (on ? next.add(n) : next.delete(n)));
    return { ...p, permissions: next };
  });
  const submit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate({ name: form.name, permissions: [...form.permissions] });
  };

  const breadcrumb = [
    { label: "Dashboard", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Roles & Permissions" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumb}>
      <PageHeader
        title="Roles & Permissions"
        description="Create roles for your shop, choose what each can do, then give them to staff on the Staff page."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New role</Button>}
      />

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div>
          <section>
            {data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((r) => (
                  <RoleCard
                    key={r.id}
                    name={r.name}
                    count={r.users_count}
                    permissions={r.permissions.length}
                    onEdit={() => openEdit(r)}
                    onDelete={() => setRemoveTarget(r)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
                <KeyRound className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">No roles yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">Create a role such as “Driver” or “Front desk”, pick its permissions, then give it to staff on the Staff page.</p>
                <Button size="sm" variant="outline" className="mt-1" onClick={openCreate}><Plus className="h-4 w-4" /> New role</Button>
              </div>
            )}
          </section>
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title={editing ? `Edit role — ${editing.name}` : "New role"} size="3xl" headerBorder>
        <form onSubmit={submit} className="space-y-4">
          <ValidationError errors={errors} />
          <div className="max-w-sm">
            <TextInput label="Role name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Driver" error={errors.name?.[0]} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Permissions</p>
            <p className="mb-2 text-xs text-muted-foreground">Staff, roles and bank details always stay with you, so they aren&apos;t listed.</p>
            <PermissionGrid groups={groups ?? []} selected={form.permissions} onToggle={toggle} />
            {(errors.permissions?.[0] || Object.keys(errors).find((k) => k.startsWith("permissions."))) && (
              <p className="mt-1 text-xs text-destructive">{errors.permissions?.[0] ?? errors[Object.keys(errors).find((k) => k.startsWith("permissions."))]?.[0]}</p>
            )}
          </div>
          <div className="sticky bottom-0 z-10 -mx-6 flex items-center justify-between gap-2 border-t bg-background px-6 py-2">
            <span className="text-xs text-muted-foreground">{form.permissions.size} permissions selected</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : "Save role"}</Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={() => setRemoveTarget(null)}
        title="Delete role"
        description={removeTarget?.users_count
          ? `${removeTarget.users_count} staff still have “${removeTarget?.name}”. Give them another role on the Staff page first.`
          : `Delete “${removeTarget?.name}”? This can't be undone.`}
        onConfirm={() => remove.mutate(removeTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </PageWrapper>
  );
}

function RoleCard({ name, count, permissions, onEdit, onDelete }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <p className="font-semibold">{name}</p>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{count} staff</span>
        <span>{permissions} permissions</span>
      </div>
      <div className="mt-3 flex gap-2 border-t pt-3">
        <Button size="sm" variant="outline" className="gap-1" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
      </div>
    </div>
  );
}
