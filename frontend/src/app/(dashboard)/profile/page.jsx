"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/forms/FormField";
import { getInitials, formatDate } from "@/lib/utils";
import { User, Shield, Lock, Save } from "lucide-react";

const TABS = [
  { key: "details", label: "My Details", icon: User },
  { key: "security", label: "Security", icon: Shield },
];

const inputClass = "h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function DetailRow({ label, required, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-2">
      <label className="sm:w-36 shrink-0 text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <label className="w-36 shrink-0 text-sm font-medium text-muted-foreground">{label}</label>
      <p className="flex-1 text-sm text-foreground truncate">{value ?? "—"}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState("details");

  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "" });
    setAvatarPreview(user.avatar ?? null);
  }, [user]);

  const resetForm = () => {
    setForm({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" });
    setAvatarFile(null);
    setAvatarPreview(user?.avatar ?? null);
    setErrors({});
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("email", form.email);
      if (form.phone) fd.append("phone", form.phone);
      if (avatarFile) fd.append("avatar", avatarFile);
      const res = await authService.updateProfile(fd);
      updateUser(res.data.data);
      setAvatarFile(null);
      toast.success("Profile updated successfully");
    } catch (err) {
      setErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    setChangingPassword(true);
    try {
      await authService.changePassword(passwordForm);
      setPasswordForm({ current_password: "", new_password: "", new_password_confirmation: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      setPasswordErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  const role = user.roles?.[0] ?? "—";

  return (
    <div className="space-y-4 pb-6 max-w-4xl mx-auto">
      {/* Header card */}
      <div className="rounded-xl border bg-card px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
            {avatarPreview ? <Image src={avatarPreview} alt="" fill unoptimized className="object-cover" /> : getInitials(user.name ?? "")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{user.name}</h1>
              <StatusBadge status={user.is_active} />
            </div>
            <p className="text-sm text-muted-foreground">
              {user.employee_id ?? user.email} <span className="mx-1">|</span> <span className="capitalize">{role}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Member Since</p>
          <p className="text-sm font-semibold">{formatDate(user.created_at)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border bg-card">
        <div className="flex border-b px-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          {tab === "details" && (
            <>
              <SectionCard title="Your Details">
                <DetailRow label="Display Name" required>
                  <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name[0]}</p>}
                </DetailRow>
                <DetailRow label="Email">
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email[0]}</p>}
                </DetailRow>
                <DetailRow label="Contact No">
                  <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone[0]}</p>}
                </DetailRow>
              </SectionCard>

              <SectionCard title="Photo">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                    {avatarPreview ? <Image src={avatarPreview} alt="" fill unoptimized className="object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                      <span className="text-sm text-muted-foreground">{avatarFile?.name ?? "No file chosen"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB.</p>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} />
                    {errors.avatar && <p className="text-xs text-destructive mt-1">{errors.avatar[0]}</p>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Account">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <ReadOnlyRow label="Employee ID" value={user.employee_id} />
                  <ReadOnlyRow label="Role" value={role} />
                  <ReadOnlyRow label="Gender" value={user.gender} />
                  <ReadOnlyRow label="Date of Birth" value={user.date_of_birth} />
                  <ReadOnlyRow label="Joining Date" value={user.joining_date} />
                  <ReadOnlyRow label="Emergency Contact" value={user.emergency_contact} />
                  <ReadOnlyRow label="Address" value={user.address} />
                  <ReadOnlyRow label="Status" value={user.is_active ? "Active" : "Inactive"} />
                </div>
              </SectionCard>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <Lock className="h-3 w-3 shrink-0" />
                Role, access and status are set by an administrator. Contact them if any of these are wrong.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  <Save className="h-4 w-4" />{saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}

          {tab === "security" && (
            <>
              <SectionCard title="Change Password">
                <DetailRow label="Current Password">
                  <PasswordInput
                    inputClassName="text-sm"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                    error={passwordErrors.current_password?.[0]}
                  />
                </DetailRow>
                <DetailRow label="New Password">
                  <PasswordInput
                    inputClassName="text-sm"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                    error={passwordErrors.new_password?.[0]}
                  />
                </DetailRow>
                <DetailRow label="Confirm Password">
                  <PasswordInput
                    inputClassName="text-sm"
                    value={passwordForm.new_password_confirmation}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, new_password_confirmation: e.target.value }))}
                  />
                </DetailRow>
              </SectionCard>

              <div className="flex justify-end pt-3 border-t">
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwordForm.current_password || !passwordForm.new_password || !passwordForm.new_password_confirmation}
                >
                  <Save className="h-4 w-4" />{changingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
