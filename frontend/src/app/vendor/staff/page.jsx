"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { vendorStaffService } from "@/services/vendorStaffService";
import { useAuthStore } from "@/store/authStore";
import { getInitials } from "@/lib/utils";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/Elements/Modal";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { Pencil, Trash2, User as UserIcon, Home } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

const defaultForm = {
  email: "", role: "staff", abilities: [],
  employee_id: "", joining_date: "", emergency_contact: "",
};

export default function StaffPage() {
  const { can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: abilityData } = useQuery({
    queryKey: ["vendor-staff-abilities"],
    queryFn: () => vendorStaffService.abilities().then((r) => r.data.data),
  });
  const catalogue = abilityData?.catalogue ?? {};
  const presets = abilityData?.presets ?? {};

  const invite = useMutation({
    mutationFn: (payload) => vendorStaffService.invite(payload),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Staff member added"); setOpen(false); },
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

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggleAbility = (ability, checked) => {
    setForm((p) => ({
      ...p,
      abilities: checked ? [...p.abilities, ability] : p.abilities.filter((a) => a !== ability),
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, abilities: presets.staff ?? [] });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      email: member.user?.email ?? "",
      role: member.role,
      abilities: member.abilities ?? [],
      employee_id: member.employee_id ?? "",
      joining_date: member.joining_date?.slice(0, 10) ?? "",
      emergency_contact: member.emergency_contact ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  // Only re-seed abilities from the role preset while inviting (not editing)
  // — an existing member's abilities stay exactly as the owner last set
  // them, per the "editable per member" rule in the ability catalogue.
  const selectRole = (value) => {
    setForm((p) => ({
      ...p,
      role: value,
      abilities: editing ? p.abilities : (presets[value] ?? []),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      role: form.role,
      abilities: form.abilities,
      employee_id: form.employee_id || null,
      joining_date: form.joining_date || null,
      emergency_contact: form.emergency_contact || null,
    };
    if (editing) updateRole.mutate({ id: editing.id, data: payload });
    else invite.mutate({ ...payload, email: form.email });
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
      cell: (row) => <span className="capitalize">{row.role}</span>,
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

            <Fieldset legend="Identity" grid={2} className="flex-1">
              <TextInput
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={fi("email")}
                disabled={!!editing}
                placeholder="they must already have a marketplace account"
                error={errors.email?.[0]}
              />
              <TextInput label="Employee ID" value={form.employee_id} onChange={fi("employee_id")} placeholder="e.g. EMP-001" error={errors.employee_id?.[0]} />
            </Fieldset>
          </div>

          <Fieldset legend="Role & Work Details" grid={2}>
            <SelectInput label="Role" options={ROLE_OPTIONS} value={form.role} onChange={selectRole} error={errors.role?.[0]} />
            <DatePicker label="Joining Date" value={form.joining_date} onChange={(v) => setForm((p) => ({ ...p, joining_date: v }))} error={errors.joining_date?.[0]} />
            <TextInput label="Emergency Contact" value={form.emergency_contact} onChange={fi("emergency_contact")} placeholder="Name & number" className="col-span-2" error={errors.emergency_contact?.[0]} />
          </Fieldset>

          <Fieldset legend="Abilities">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(catalogue).map(([group, items]) => (
                <div key={group} className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{group}</p>
                  {items.map((ability) => (
                    <label key={ability} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                      <Checkbox checked={form.abilities.includes(ability)} onCheckedChange={(checked) => toggleAbility(ability, !!checked)} />
                      {ability}
                    </label>
                  ))}
                </div>
              ))}
            </div>
            {errors.abilities?.[0] && <p className="text-xs text-destructive">{errors.abilities[0]}</p>}
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
