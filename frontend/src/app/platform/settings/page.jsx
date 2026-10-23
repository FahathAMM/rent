"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { platformDetailService, platformBackupService, platformAutomationService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmailPdfModal } from "@/components/shared/EmailPdfModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { getInitials, formatDateTime, formatBytes } from "@/lib/utils";
import {
  Home, Building2, Save, Loader2, Database, Download, Trash2, Mail,
  User, Shield, Clock, Image as ImageIcon, Zap, Plus, Pencil,
} from "lucide-react";

// Mutually exclusive — a task runs on exactly one of these (radio), never a
// combination — so the stored `interval` is always a single value, never a
// comma-joined one like "everyFiveMinutes,fixed_time".
const AUTOMATION_INTERVAL_OPTIONS = [
  { value: "everyFiveMinutes", label: "Every 5 minutes" },
  { value: "everyTenMinutes", label: "Every 10 minutes" },
  { value: "everyFifteenMinutes", label: "Every 15 minutes" },
  { value: "everyThirtyMinutes", label: "Every 30 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "everyTwoHours", label: "Every 2 hours" },
  { value: "everyThreeHours", label: "Every 3 hours" },
  { value: "everyFourHours", label: "Every 4 hours" },
  { value: "everySixHours", label: "Every 6 hours" },
  { value: "fixed_time", label: "Fixed time" },
];

const EMPTY_AUTOMATION_FORM = { name: "", interval: "", fixed_time: "", is_active: true };

const EMPTY_DETAIL = {
  name: "", tagline: "", logo: null, login_logo: null,
  login_eyebrow: "", login_heading: "", login_description: "",
};

/** A vertical, icon-led nav item — deliberately not the pill-tab look used elsewhere in the app. */
function SettingsTabTrigger({ value, icon: Icon, children }) {
  return (
    <TabsTrigger
      value={value}
      className="w-full justify-start gap-2.5 rounded-lg border-l-[3px] border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </TabsTrigger>
  );
}

function CardHeading({ icon: Icon, iconBg, iconColor, title, description, action }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function LogoField({ label, hint, preview, fileName, onChange, error, inputRef, className = "" }) {
  return (
    <div className={`col-span-2 flex items-center gap-4 ${className}`}>
      <div className="w-16 h-16 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-full object-contain" />
        ) : (
          <Building2 className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose File
          </Button>
          <span className="text-sm text-muted-foreground">{fileName ?? "No file chosen"}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onChange} />
        {error && <p className="text-xs text-destructive mt-1">{error[0]}</p>}
      </div>
    </div>
  );
}

function BrandingCard() {
  const [detail, setDetail] = useState(EMPTY_DETAIL);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loginLogoFile, setLoginLogoFile] = useState(null);
  const [loginLogoPreview, setLoginLogoPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const loginLogoInputRef = useRef(null);

  useEffect(() => {
    platformDetailService
      .get()
      .then((res) => {
        setDetail({ ...EMPTY_DETAIL, ...res.data.data });
        setLogoPreview(res.data.data.logo ?? null);
        setLoginLogoPreview(res.data.data.login_logo ?? null);
      })
      .catch(() => toast.error("Failed to load platform branding"))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLoginLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoginLogoFile(file);
    setLoginLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", detail.name);
      fd.append("tagline", detail.tagline ?? "");
      fd.append("login_eyebrow", detail.login_eyebrow ?? "");
      fd.append("login_heading", detail.login_heading ?? "");
      fd.append("login_description", detail.login_description ?? "");
      if (logoFile) fd.append("logo", logoFile);
      if (loginLogoFile) fd.append("login_logo", loginLogoFile);

      const res = await platformDetailService.update(fd);
      setDetail({ ...EMPTY_DETAIL, ...res.data.data });
      setLogoFile(null);
      setLoginLogoFile(null);
      toast.success("Platform branding updated");
    } catch (err) {
      setErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to update platform branding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center min-h-[240px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <CardHeading
          icon={ImageIcon}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          title="Platform Branding"
          description="Shown across every tenant's app — sidebar, sign-in, and sign-up."
        />

        <form onSubmit={handleSave} className="grid gap-1">
          <Fieldset legend="Logos" grid={2}>
            <LogoField
              label="Sidebar Logo"
              hint="PNG, JPG up to 2MB. Shown in every tenant's app sidebar."
              preview={logoPreview}
              fileName={logoFile?.name}
              onChange={handleLogoChange}
              error={errors.logo}
              inputRef={fileInputRef}
              className="mt-3"
            />

            <LogoField
              label="Login Page Logo"
              hint="PNG, JPG up to 2MB. Shown big on the sign-in screen — falls back to the sidebar logo if unset."
              preview={loginLogoPreview}
              fileName={loginLogoFile?.name}
              onChange={handleLoginLogoChange}
              error={errors.login_logo}
              inputRef={loginLogoInputRef}
            />
          </Fieldset>

          <Fieldset legend="Identity" grid={2}>
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Brand Name</Label>
              <Input id="brand-name" value={detail.name} onChange={(e) => setDetail((d) => ({ ...d, name: e.target.value }))} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-tagline">Tagline</Label>
              <Input id="brand-tagline" value={detail.tagline ?? ""} onChange={(e) => setDetail((d) => ({ ...d, tagline: e.target.value }))} />
              {errors.tagline && <p className="text-xs text-destructive mt-1">{errors.tagline[0]}</p>}
            </div>
          </Fieldset>

          <Fieldset legend="Company Sign-in Page" grid={2}>
            <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
              Hero copy shown on the company sign-in page only — leave blank to keep the current default wording.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="login-eyebrow">Eyebrow Text</Label>
              <Input id="login-eyebrow" placeholder="Built for growing sales & finance teams" value={detail.login_eyebrow ?? ""} onChange={(e) => setDetail((d) => ({ ...d, login_eyebrow: e.target.value }))} />
              {errors.login_eyebrow && <p className="text-xs text-destructive mt-1">{errors.login_eyebrow[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-heading">Headline</Label>
              <Input id="login-heading" placeholder="One flow to run your business." value={detail.login_heading ?? ""} onChange={(e) => setDetail((d) => ({ ...d, login_heading: e.target.value }))} />
              <p className="text-xs text-muted-foreground">The last word is automatically highlighted in color.</p>
              {errors.login_heading && <p className="text-xs text-destructive mt-1">{errors.login_heading[0]}</p>}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="login-description">Subtext</Label>
              <Textarea id="login-description" rows={2} placeholder="One Flow. One Business. — CRM, quotations, invoicing, expenses and accounting in one place. Sign in to pick up right where you left off." value={detail.login_description ?? ""} onChange={(e) => setDetail((d) => ({ ...d, login_description: e.target.value }))} />
              {errors.login_description && <p className="text-xs text-destructive mt-1">{errors.login_description[0]}</p>}
            </div>
          </Fieldset>

          <div className="flex justify-end pt-2 border-t">
            <Button type="submit" disabled={saving || !detail.name.trim()}>
              <Save className="h-4 w-4" />{saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BackupsCard() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const isOwner = admin?.role === "platform_owner";

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);

  const load = () => {
    setLoading(true);
    platformBackupService
      .getAll()
      .then((res) => setBackups(res.data.data))
      .catch(() => toast.error("Failed to load backups"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await platformBackupService.create();
      toast.success("Database backup created");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup) => {
    setDownloadingPath(backup.path);
    try {
      const res = await platformBackupService.download(backup.path);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.path.split("/").pop();
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download backup");
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await platformBackupService.delete(deleteTarget.path);
      toast.success("Backup deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to delete backup");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <CardHeading
            icon={Database}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            title="Database Backups"
            description="Full database dumps, taken automatically every night and on demand."
            action={
              <Button type="button" size="sm" onClick={handleCreate} disabled={creating} className="shrink-0">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {creating ? "Creating..." : "Backup Now"}
              </Button>
            }
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No backups yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {backups.map((backup) => (
                <li key={backup.path} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{formatDateTime(backup.created_at)}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(backup.size)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="!h-7 !w-7"
                      onClick={() => handleDownload(backup)}
                      disabled={downloadingPath === backup.path}
                    >
                      {downloadingPath === backup.path ? (
                        <Loader2 className="!h-3.5 !w-3.5 animate-spin" />
                      ) : (
                        <Download className="!h-3.5 !w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="!h-7 !w-7"
                      onClick={() => setEmailTarget(backup)}
                    >
                      <Mail className="!h-3.5 !w-3.5" />
                    </Button>
                    {isOwner && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="!h-7 !w-7 text-destructive border-destructive/40"
                        onClick={() => setDeleteTarget(backup)}
                      >
                        <Trash2 className="!h-3.5 !w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Backup"
        description={`Delete the backup from ${deleteTarget ? formatDateTime(deleteTarget.created_at) : ""}? This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
        confirmText="Delete"
      />

      <EmailPdfModal
        open={!!emailTarget}
        onOpenChange={() => setEmailTarget(null)}
        docLabel="Database Backup"
        docNumber={emailTarget ? formatDateTime(emailTarget.created_at) : ""}
        onSend={(data) => platformBackupService.email({ ...data, path: emailTarget.path })}
        hideCloseButton
      />
    </>
  );
}

function AutomationsCard() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_AUTOMATION_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = () => {
    setLoading(true);
    platformAutomationService
      .getAll()
      .then((res) => setAutomations(res.data.data))
      .catch(() => toast.error("Failed to load automations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_AUTOMATION_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (automation) => {
    setEditing(automation);
    setForm({
      name: automation.name,
      interval: automation.intervals?.[0] ?? "",
      fixed_time: automation.fixed_time ?? "",
      is_active: automation.is_active,
    });
    setErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const payload = {
      name: form.name,
      interval: form.interval,
      fixed_time: form.interval === "fixed_time" ? form.fixed_time : null,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await platformAutomationService.update(editing.id, payload);
        toast.success("Automation updated");
      } else {
        await platformAutomationService.create(payload);
        toast.success("Automation created");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setErrors(err.response?.data?.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (automation) => {
    setTogglingId(automation.id);
    try {
      await platformAutomationService.update(automation.id, {
        name: automation.name,
        interval: automation.interval,
        fixed_time: automation.fixed_time,
        is_active: !automation.is_active,
      });
      load();
    } catch {
      toast.error("Failed to update automation");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await platformAutomationService.delete(deleteTarget.id);
      toast.success("Automation deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Failed to delete automation");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <CardHeading
            icon={Zap}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            title="Automation Scheduler"
            description="Scheduled background tasks and how often they run."
            action={
              <Button type="button" size="sm" onClick={openCreate} className="shrink-0">
                <Plus className="h-4 w-4" /> New Automation
              </Button>
            }
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No automations yet.</p>
          ) : (
            <ul className="grid gap-2">
              {automations.map((automation) => (
                <li key={automation.id} className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{automation.name}</p>
                    <p className="text-xs text-muted-foreground">{automation.interval_label}</p>
                    {automation.fixed_time && <p className="text-xs text-muted-foreground">at {automation.fixed_time}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Next run: {automation.next_run_at ? formatDateTime(automation.next_run_at) : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Last ran: {automation.last_run_at ? formatDateTime(automation.last_run_at) : "never"}
                      {automation.last_run_status && (
                        <span className={automation.last_run_status === "success" ? "text-emerald-600" : "text-destructive"}>
                          {" "}({automation.last_run_status})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      variant={automation.is_active ? "success" : "secondary"}
                      className="cursor-pointer select-none"
                      onClick={() => togglingId !== automation.id && handleToggleActive(automation)}
                    >
                      {togglingId === automation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : automation.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button type="button" variant="outline" size="icon" className="!h-7 !w-7" onClick={() => openEdit(automation)}>
                      <Pencil className="!h-3.5 !w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="!h-7 !w-7 text-destructive border-destructive/40"
                      onClick={() => setDeleteTarget(automation)}
                    >
                      <Trash2 className="!h-3.5 !w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Automation" : "New Automation"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-1">
            <ValidationError errors={errors} />

            <Fieldset legend="Details" grid={1}>
              <TextInput
                label="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={errors.name?.[0]}
                required
              />
            </Fieldset>

            <Fieldset legend="Schedule" grid={1}>
              <div className="space-y-1.5">
                <Label>Runs on</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AUTOMATION_INTERVAL_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="automation-interval"
                        className="h-4 w-4 accent-primary"
                        checked={form.interval === opt.value}
                        onChange={() => setForm((f) => ({ ...f, interval: opt.value }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {errors.interval && <p className="text-xs text-destructive">{errors.interval[0]}</p>}
              </div>

              {form.interval === "fixed_time" && (
                <TextInput
                  type="time"
                  label="Fixed time"
                  value={form.fixed_time}
                  onChange={(e) => setForm((f) => ({ ...f, fixed_time: e.target.value }))}
                  error={errors.fixed_time?.[0]}
                  required
                />
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.is_active} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: !!c }))} />
                Active
              </label>
            </Fieldset>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Automation"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
        confirmText="Delete"
      />
    </>
  );
}

function ProfileCard({ admin }) {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <CardHeading icon={User} iconBg="bg-indigo-100" iconColor="text-indigo-600" title="My Account" description="Your Platform Admin profile." />

        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-lg font-bold text-white">
            {getInitials(admin?.name ?? "")}
          </div>
          <div>
            <p className="text-lg font-semibold">{admin?.name}</p>
            <p className="text-sm text-muted-foreground">{admin?.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <InfoRow icon={Shield} label="Role">
            <Badge variant={admin?.role === "platform_owner" ? "default" : "secondary"} className="capitalize">{admin?.role?.replace("_", " ")}</Badge>
          </InfoRow>
          <InfoRow icon={Shield} label="Status">
            <Badge variant="success" className="capitalize">{admin?.status}</Badge>
          </InfoRow>
          <InfoRow icon={Clock} label="Last Login">
            {admin?.last_login_at ? formatDateTime(admin.last_login_at) : "—"}
          </InfoRow>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          To manage other Platform Owner/Admin accounts, go to <a href="/platform/users" className="text-primary hover:underline font-medium">Users</a>.
        </p>
      </CardContent>
    </Card>
  );
}

export default function PlatformSettingsPage() {
  const admin = usePlatformAuthStore((s) => s.admin);

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Settings" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Settings" />

      <Tabs defaultValue="profile" orientation="vertical" className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <TabsList className="h-auto w-full shrink-0 flex-col items-stretch justify-start gap-1 rounded-xl border bg-card p-2 lg:w-60">
          <SettingsTabTrigger value="profile" icon={User}>Profile</SettingsTabTrigger>
          <SettingsTabTrigger value="branding" icon={ImageIcon}>Branding</SettingsTabTrigger>
          <SettingsTabTrigger value="automations" icon={Zap}>Automations</SettingsTabTrigger>
          <SettingsTabTrigger value="backups" icon={Database}>Backups</SettingsTabTrigger>
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="profile" className="mt-0">
            <div className="max-w-md">
              <ProfileCard admin={admin} />
            </div>
          </TabsContent>

          <TabsContent value="branding" className="mt-0">
            <BrandingCard />
          </TabsContent>

          <TabsContent value="automations" className="mt-0">
            <AutomationsCard />
          </TabsContent>

          <TabsContent value="backups" className="mt-0">
            <BackupsCard />
          </TabsContent>
        </div>
      </Tabs>
    </PageWrapper>
  );
}
