"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useCustomerAuthStore } from "@/store/customerAuthStore";
import { customerService } from "@/services/customerService";
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

/** The customer account's profile editor — mirrors ProfileForm (shared by the vendor app), but against the separate customer identity. A customer has no role, so there's no Role row/note here. */
export function CustomerProfileForm() {
  const { customer, updateCustomer } = useCustomerAuthStore();
  const [tab, setTab] = useState("details");

  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // A new mobile number is only saved once the code texted to it is entered.
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const phoneChanged = !!form.phone.trim() && form.phone.trim() !== (customer?.phone ?? "");

  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setForm({ name: customer.name ?? "", email: customer.email ?? "", phone: customer.phone ?? "" });
    setAvatarPreview(customer.avatar ?? null);
  }, [customer]);

  const resetForm = () => {
    setForm({ name: customer?.name ?? "", email: customer?.email ?? "", phone: customer?.phone ?? "" });
    setAvatarFile(null);
    setAvatarPreview(customer?.avatar ?? null);
    setErrors({});
    setOtp("");
    setOtpSent(false);
  };

  const handleSendOtp = async () => {
    setErrors({});
    setSendingOtp(true);
    try {
      await customerService.sendOtp(form.phone);
      setOtpSent(true);
      toast.success("Code sent to your new mobile number");
    } catch (err) {
      const message = err.networkError ?? err.response?.data?.message ?? "Could not send the code";
      setErrors(err.response?.data?.errors ?? { phone: [message] });
    } finally {
      setSendingOtp(false);
    }
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
      if (phoneChanged && otp) fd.append("otp", otp);
      if (avatarFile) fd.append("avatar", avatarFile);
      const res = await customerService.updateProfile(fd);
      updateCustomer(res.data.data);
      setAvatarFile(null);
      setOtp("");
      setOtpSent(false);
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
      await customerService.changePassword(passwordForm);
      setPasswordForm({ current_password: "", new_password: "", new_password_confirmation: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      setPasswordErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!customer) return null;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border bg-card px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
            {avatarPreview ? <Image src={avatarPreview} alt="" fill unoptimized className="object-cover" /> : getInitials(customer.name ?? "")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{customer.name}</h1>
              <StatusBadge status={customer.status} />
            </div>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Member Since</p>
          <p className="text-sm font-semibold">{formatDate(customer.created_at)}</p>
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
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setOtp(""); setOtpSent(false); }}
                    />
                    {phoneChanged && (
                      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={handleSendOtp} disabled={sendingOtp}>
                        {sendingOtp ? "Sending..." : otpSent ? "Resend code" : "Send code"}
                      </Button>
                    )}
                  </div>
                  {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone[0]}</p>}
                  {phoneChanged && !errors.phone && (
                    <p className="text-xs text-muted-foreground mt-1">We&apos;ll text a code to the new number to confirm it&apos;s yours.</p>
                  )}
                </DetailRow>
                {phoneChanged && otpSent && (
                  <DetailRow label="Verification Code" required>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                    {errors.otp && <p className="text-xs text-destructive mt-1">{errors.otp[0]}</p>}
                  </DetailRow>
                )}
                {phoneChanged && !otpSent && errors.otp && <p className="text-xs text-destructive">{errors.otp[0]}</p>}
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
                  <ReadOnlyRow label="Date of Birth" value={customer.date_of_birth} />
                  <ReadOnlyRow label="Address" value={customer.address} />
                  <ReadOnlyRow label="Status" value={customer.status} />
                </div>
              </SectionCard>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <Lock className="h-3 w-3 shrink-0" />
                Status is set by an administrator. Contact support if it looks wrong.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>
                <Button type="button" onClick={handleSave} disabled={saving || !form.name.trim() || (phoneChanged && otp.length !== 6)}>
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
