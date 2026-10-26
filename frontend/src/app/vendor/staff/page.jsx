"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorStaffService } from "@/services/vendorStaffService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Pencil, Trash2, Plus, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

const emptyInvite = { email: "", role: "staff" };

export default function StaffPage() {
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyInvite);
  const [errors, setErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-staff"],
    queryFn: () => vendorStaffService.getAll().then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-staff"] });

  const invite = useMutation({
    mutationFn: (payload) => vendorStaffService.invite(payload),
    onSuccess: () => { invalidate(); toast.success("Staff member added"); setOpen(false); setForm(emptyInvite); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }) => vendorStaffService.update(id, data),
    onSuccess: () => { invalidate(); toast.success("Staff member updated"); setOpen(false); },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: (id) => vendorStaffService.remove(id),
    onSuccess: () => { invalidate(); toast.success("Staff member removed"); setRemoveTarget(null); },
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

  const members = data ?? [];

  const columns = [
    { key: "name", header: "Name", render: (row) => row.user?.name ?? "—" },
    { key: "email", header: "Email", render: (row) => row.user?.email ?? "—" },
    { key: "role", header: "Role", render: (row) => <span className="capitalize">{row.role}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions", header: "Actions",
      render: (row) => row.role === "owner" ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <div className="flex gap-1.5">
          {can("vendor-staff-edit") && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          )}
          {can("vendor-staff-delete") && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setRemoveTarget(row)}><Trash2 className="h-4 w-4" /></Button>
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
        <PageHeader
          title="Staff"
          description="People who can act for this shop — they need an existing marketplace account to be added."
          action={can("vendor-staff-create") && (
            <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Add Staff</Button>
          )}
        />

        <DataTable columns={columns} data={members} loading={isLoading} />
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

      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.user?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They will immediately lose access to this shop.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(removeTarget.id)} className="bg-destructive hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
