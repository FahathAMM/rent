"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { userService } from "@/services/userService";
import { useRoles } from "@/hooks/useRoles";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/Elements/Modal";
import {
  TextInput,
  PasswordInput,
  TextareaInput,
  ValidationError,
} from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { DatePicker } from "@/components/forms/DatePicker";
import { Fieldset } from "@/components/forms/Fieldset";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Camera,
  User as UserIcon,
  Home,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import Image from "next/image";

const avatarUrl = (path) =>
  path
    ? path.startsWith("http") || path.startsWith("blob:")
      ? path
      : `/storage/${path}`
    : null;

const defaultForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  is_active: "1",
  employee_id: "",
  gender: "",
  date_of_birth: "",
  joining_date: "",
  address: "",
  emergency_contact: "",
};

export default function UsersPage() {
  const { user: me, can } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef(null);

  const { data: availableRoles } = useRoles();

  const create = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("User created");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => userService.update(id, data),
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("User updated");
      setOpen(false);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const remove = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const f = (k) => (val) => setForm((p) => ({ ...p, [k]: val }));
  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const toggleRole = (roleName, checked) => {
    setSelectedRoles((prev) =>
      checked ? [...prev, roleName] : prev.filter((r) => r !== roleName),
    );
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setSelectedRoles([]);
    setAvatarFile(null);
    setAvatarPreview(null);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      phone: u.phone ?? "",
      is_active: u.is_active ? "1" : "0",
      employee_id: u.employee_id ?? "",
      gender: u.gender ?? "",
      date_of_birth: u.date_of_birth?.slice(0, 10) ?? "",
      joining_date: u.joining_date?.slice(0, 10) ?? "",
      address: u.address ?? "",
      emergency_contact: u.emergency_contact ?? "",
    });
    setSelectedRoles(
      (u.roles ?? []).map((r) => (typeof r === "string" ? r : r.name)),
    );
    setAvatarFile(null);
    setAvatarPreview(avatarUrl(u.avatar));
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("email", form.email);
    if (form.password) fd.append("password", form.password);
    fd.append("is_active", form.is_active);
    if (form.phone) fd.append("phone", form.phone);
    if (form.employee_id) fd.append("employee_id", form.employee_id);
    if (form.gender) fd.append("gender", form.gender);
    if (form.date_of_birth) fd.append("date_of_birth", form.date_of_birth);
    if (form.joining_date) fd.append("joining_date", form.joining_date);
    if (form.address) fd.append("address", form.address);
    if (form.emergency_contact)
      fd.append("emergency_contact", form.emergency_contact);
    if (avatarFile) fd.append("avatar", avatarFile);
    selectedRoles.forEach((r) => fd.append("roles[]", r));

    if (editing) update.mutate({ id: editing.id, data: fd });
    else create.mutate(fd);
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "avatar",
      header: "Photo",
      class: "w-14",
      cell: (row) =>
        row.avatar ? (
          <div className="relative w-8 h-8 shrink-0 my-2">
            <Image
              src={avatarUrl(row.avatar)}
              alt={row.name}
              fill
              className="object-cover rounded-full"
            />
          </div>
        ) : (
          <div className="w-8 h-8 my-2 rounded-full bg-muted flex items-center justify-center shrink-0">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      accessorKey: "name",
      header: () => <SortableHeader label="Name" column="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          {row.employee_id && (
            <p className="text-[10px] text-muted-foreground font-mono">
              {row.employee_id}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: () => <SortableHeader label="Email" column="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
    },
    { accessorKey: "phone", header: "Phone", cell: (row) => row.phone ?? "—" },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: (row) =>
        row.gender ? <span className="capitalize">{row.gender}</span> : "—",
    },
    {
      accessorKey: "joining_date",
      header: () => <SortableHeader label="Joined" column="joining_date" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => (row.joining_date ? row.joining_date.slice(0, 10) : "—"),
    },
    {
      accessorKey: "roles",
      header: "Roles",
      cell: (row) => {
        const roles = row.roles ?? [];
        if (!roles.length)
          return (
            <span className="text-muted-foreground italic text-[10px]">
              No role
            </span>
          );
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge
                key={r.id ?? r}
                variant={(r.name ?? r) === "admin" ? "default" : "secondary"}
                className="capitalize text-[10px] px-1.5 py-0"
              >
                {r.name ?? r}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: (row) => <StatusBadge status={row.is_active} />,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-1">
          {can("admin-users-edit") && (
            <ActionButton onClick={() => openEdit(row)} icon={Pencil} label="Edit user" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
          )}
          {can("admin-users-delete") && row.id !== me?.id && !(row.roles ?? []).some((r) => (r.name ?? r) === "super-admin") && (
            <ActionButton onClick={() => setDeleteTarget(row)} icon={Trash2} label="Delete user" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive" />
          )}
        </div>
      ),
    },
  ];

  const isPending = create.isPending || update.isPending;

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Users" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/users"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
          isSheet={can("admin-users-create")}
          openSheet={openCreate}
          model="User"
        />
      </HomePageWrapper>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit User" : "Add User"}
        size="4xl"
        headerBorder
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <ValidationError errors={errors} />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Fieldset legend="Photo" grid={false} className="sm:shrink-0">
              <div
                className="relative w-16 h-16 rounded-full cursor-pointer overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="avatar"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </Fieldset>

            <Fieldset legend="Identity" grid={2} className="flex-1">
              <TextInput
                label="Full Name"
                value={form.name}
                onChange={fi("name")}
                required
                error={errors.name?.[0]}
              />
              <TextInput
                label="Email"
                type="email"
                value={form.email}
                onChange={fi("email")}
                required
                error={errors.email?.[0]}
              />
              <TextInput
                label="Employee ID"
                value={form.employee_id}
                onChange={fi("employee_id")}
                placeholder="e.g. EMP-001"
                error={errors.employee_id?.[0]}
              />
            </Fieldset>
          </div>

          <Fieldset legend="Contact & Personal" grid={2}>
            <TextInput
              label="Phone"
              value={form.phone}
              onChange={fi("phone")}
              placeholder="+60 12-345 6789"
              error={errors.phone?.[0]}
            />
            <SelectInput
              label="Gender"
              value={form.gender}
              onChange={f("gender")}
              options={[
                { value: "", label: "Select gender" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
            />
            <DatePicker
              label="Date of Birth"
              value={form.date_of_birth}
              onChange={f("date_of_birth")}
              error={errors.date_of_birth?.[0]}
            />
            <DatePicker
              label="Joining Date"
              value={form.joining_date}
              onChange={f("joining_date")}
              error={errors.joining_date?.[0]}
            />
          </Fieldset>

          <Fieldset legend="Address & Roles">
            <TextareaInput
              label="Address"
              value={form.address}
              onChange={fi("address")}
              placeholder="Full address..."
              error={errors.address?.[0]}
              className="[&_textarea]:min-h-[76px]"
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Roles</label>
              {availableRoles && availableRoles.length > 0 ? (
                <div className="flex flex-wrap items-start content-start gap-x-5 gap-y-2.5 rounded-md border bg-muted/30 px-3 py-2.5 min-h-[76px]">
                  {availableRoles.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={selectedRoles.includes(role.name)}
                        onCheckedChange={(checked) =>
                          toggleRole(role.name, !!checked)
                        }
                      />
                      <span className="text-sm capitalize">{role.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No roles available
                </p>
              )}
              {errors.roles?.[0] && (
                <p className="text-xs text-destructive">{errors.roles[0]}</p>
              )}
            </div>
          </Fieldset>

          <Fieldset legend="Account" grid={2}>
            <TextInput
              label="Emergency Contact"
              value={form.emergency_contact}
              onChange={fi("emergency_contact")}
              placeholder="Name & number"
              error={errors.emergency_contact?.[0]}
            />
            <SelectInput
              label="Status"
              value={form.is_active}
              onChange={f("is_active")}
              options={[
                { value: "1", label: "Active" },
                { value: "0", label: "Inactive" },
              ]}
            />
            <PasswordInput
              label={
                editing ? "New Password (leave blank to keep)" : "Password"
              }
              value={form.password}
              onChange={fi("password")}
              required={!editing}
              error={errors.password?.[0]}
            />
          </Fieldset>

          <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete User"
        description={`Delete "${deleteTarget?.name}"?`}
        onConfirm={() => remove.mutate(deleteTarget.id)}
        loading={remove.isPending}
        confirmText="Delete"
      />
    </div>
  );
}
