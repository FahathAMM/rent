"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import { platformService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmailPdfModal } from "@/components/shared/EmailPdfModal";
import { ActionButton } from "@/components/Datatable/ActionButton";
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
import { TranslationFields, appendTranslations, translationsForm } from "@/components/forms/TranslationFields";
import { cn, getInitials, formatDateTime, formatBytes } from "@/lib/utils";
import {
  Home, Building2, Save, Loader2, Database, Download, Trash2, Mail, User, Shield, Clock,
  Image as ImageIcon, Zap, Plus, Pencil, Settings, UploadCloud, Eye, CheckCircle2, XCircle,
  CalendarClock, History, HardDrive, Archive, Users, KeyRound, ScrollText, ChevronRight,
  Sparkles, PauseCircle, ShieldCheck, Lock,
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

// Branding text the public site can show in other languages.
const TRANSLATED_DETAIL = ["tagline", "login_eyebrow", "login_heading", "login_description"];

const EMPTY_DETAIL = {
  name: "", tagline: "", logo: null, login_logo: null,
  login_eyebrow: "", login_heading: "", login_description: "",
  translations: translationsForm(null, TRANSLATED_DETAIL),
};

const detailForm = (data) => ({ ...EMPTY_DETAIL, ...data, translations: translationsForm(data?.translations, TRANSLATED_DETAIL) });

// Same colour language as the table ActionButtons.
const TONE = {
  edit: "text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400",
  delete: "text-destructive border-destructive/40 hover:bg-destructive/10 hover:border-destructive",
  download: "text-blue-600 border-blue-300 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-400",
  mail: "text-teal-600 border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-400",
};

const SECTIONS = [
  { value: "profile", icon: User, title: "Profile", desc: "Your admin account", tone: "bg-indigo-500/10 text-indigo-600" },
  { value: "branding", icon: ImageIcon, title: "Branding", desc: "Logos, name & sign-in copy", tone: "bg-purple-500/10 text-purple-600" },
  { value: "automations", icon: Zap, title: "Automations", desc: "Scheduled background tasks", tone: "bg-amber-500/10 text-amber-600" },
  { value: "backups", icon: Database, title: "Backups", desc: "Database dumps & restore", tone: "bg-blue-500/10 text-blue-600" },
];

/* ─── Shared bits ─────────────────────────────────────────────────────── */

function SectionNavItem({ value, icon: Icon, title, desc, tone }) {
  return (
    <TabsTrigger
      value={value}
      className="group w-full justify-start gap-3 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-left shadow-none transition-all hover:bg-muted/60 data-[state=active]:border-primary/20 data-[state=active]:bg-primary/[0.06] data-[state=active]:shadow-none"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-data-[state=active]:translate-x-0.5 group-data-[state=active]:text-primary" />
    </TabsTrigger>
  );
}

function SectionHeader({ icon: Icon, tone, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-5 w-5" /></span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

/** Small on/off switch (there's no shared Switch component yet). */
function Toggle({ checked, onClick, busy, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={busy}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-emerald-500" : "bg-muted-foreground/30"
      )}
    >
      <span className={cn("inline-flex size-4 items-center justify-center rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")}>
        {busy && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
      </span>
    </button>
  );
}

/* ─── Profile ─────────────────────────────────────────────────────────── */

function ProfileCard({ admin }) {
  const status = admin?.status ?? (admin?.is_active === false ? "inactive" : "active");
  const isOwner = admin?.admin_role === "platform_owner";

  const links = [
    { href: "/platform/users", icon: Users, label: "Platform users", desc: "Add or remove admins" },
    { href: "/platform/roles", icon: KeyRound, label: "Roles & permissions", desc: "What each admin can do" },
    { href: "/platform/audit-logs", icon: ScrollText, label: "Audit log", desc: "Who changed what, and when" },
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <div className="relative h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.3),transparent_45%)]" />
        </div>
        <CardContent className="relative px-6 pb-6">
          <div className="-mt-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-md">
                {getInitials(admin?.name ?? "")}
              </div>
              <div className="pb-1">
                <p className="text-lg font-semibold leading-tight">{admin?.name}</p>
                <p className="text-sm text-muted-foreground">{admin?.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={isOwner ? "default" : "secondary"} className="gap-1 capitalize">
                {isOwner ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {admin?.admin_role?.replace("_", " ")}
              </Badge>
              <Badge variant={status === "active" ? "success" : "secondary"} className="capitalize">{status}</Badge>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatTile icon={Shield} label="Role" value={<span className="capitalize">{admin?.admin_role?.replace("_", " ") ?? "—"}</span>} tone="bg-indigo-500/10 text-indigo-600" />
            <StatTile icon={CheckCircle2} label="Account status" value={<span className="capitalize">{status}</span>} tone="bg-emerald-500/10 text-emerald-600" />
            <StatTile icon={Clock} label="Last login" value={admin?.last_login_at ? formatDateTime(admin.last_login_at) : "—"} tone="bg-sky-500/10 text-sky-600" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold">Quick links</p>
            <div className="space-y-1.5">
              {links.map(({ href, icon: Icon, label, desc }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-primary" /> Security tips</p>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                "Use a long, unique password for this admin account.",
                "Give other admins the smallest role that does the job.",
                "Check the audit log after bulk changes or deletes.",
                "Download a fresh backup before big changes.",
              ].map((tip) => (
                <li key={tip} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{tip}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Branding ────────────────────────────────────────────────────────── */

function LogoDrop({ label, hint, preview, fileName, onChange, error, inputRef }) {
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="flex items-center gap-1.5 text-xs text-primary"><UploadCloud className="h-3.5 w-3.5" />{fileName ?? (preview ? "Click to replace" : "Click to upload")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onChange} />
      {error && <p className="mt-1 text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}

/** Headline with the last word highlighted — the same rule the sign-in page uses. */
function HighlightedHeading({ text }) {
  const words = (text || "One flow to run your business.").trim().split(" ");
  const last = words.pop();
  return <>{words.join(" ")} <span className="text-primary">{last}</span></>;
}

function BrandPreview({ detail, logo, loginLogo }) {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Live preview</p>

      {/* Sidebar */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-7 max-w-[110px] object-contain" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">{detail.name?.charAt(0) || "B"}</span>
          )}
          <span className="truncate text-sm font-semibold">{detail.name || "Brand name"}</span>
        </div>
        <div className="space-y-1 p-2">
          {["Dashboard", "Bookings", "Vehicles"].map((item, i) => (
            <div key={item} className={cn("rounded-md px-2.5 py-1.5 text-xs", i === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground")}>{item}</div>
          ))}
        </div>
        <p className="border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">Sidebar</p>
      </div>

      {/* Sign-in */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-4">
          {(loginLogo || logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loginLogo || logo} alt="" className="mb-3 h-9 max-w-[140px] object-contain" />
          ) : (
            <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{detail.name?.charAt(0) || "B"}</span>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{detail.login_eyebrow || "Built for growing teams"}</p>
          <p className="mt-1 text-base font-bold leading-snug"><HighlightedHeading text={detail.login_heading} /></p>
          <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{detail.login_description || detail.tagline || "Sign in to pick up right where you left off."}</p>
          <div className="mt-3 space-y-1.5">
            <div className="h-7 rounded-md border bg-background" />
            <div className="h-7 rounded-md border bg-background" />
            <div className="h-7 rounded-md bg-primary" />
          </div>
        </div>
        <p className="border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">Sign-in page</p>
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
    platformService.details
      .get()
      .then((res) => {
        setDetail(detailForm(res.data.data));
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
      appendTranslations(fd, detail.translations);
      if (logoFile) fd.append("logo", logoFile);
      if (loginLogoFile) fd.append("login_logo", loginLogoFile);

      const res = await platformService.details.update(fd);
      setDetail(detailForm(res.data.data));
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

  const set = (key) => (e) => setDetail((d) => ({ ...d, [key]: e.target.value }));
  const unsaved = !!(logoFile || loginLogoFile);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={ImageIcon}
        tone="bg-purple-500/10 text-purple-600"
        title="Platform Branding"
        description="Shown across every tenant's app — sidebar, sign-in, and sign-up."
      />

      {loading ? (
        <Card className="rounded-2xl"><Spinner /></Card>
      ) : (
        <form onSubmit={handleSave} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="grid gap-1 p-5 sm:p-6">
              <Fieldset legend="Logos" grid={2}>
                <div className="col-span-2 mt-3 grid gap-3 md:grid-cols-2">
                  <LogoDrop
                    label="Sidebar logo"
                    hint="PNG or JPG, up to 2MB. Shown in every tenant's app sidebar."
                    preview={logoPreview}
                    fileName={logoFile?.name}
                    onChange={handleLogoChange}
                    error={errors.logo}
                    inputRef={fileInputRef}
                  />
                  <LogoDrop
                    label="Login page logo"
                    hint="PNG or JPG, up to 2MB. Falls back to the sidebar logo if unset."
                    preview={loginLogoPreview}
                    fileName={loginLogoFile?.name}
                    onChange={handleLoginLogoChange}
                    error={errors.login_logo}
                    inputRef={loginLogoInputRef}
                  />
                </div>
              </Fieldset>

              <Fieldset legend="Identity" grid={2}>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-name">Brand name</Label>
                  <Input id="brand-name" value={detail.name} onChange={set("name")} />
                  {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name[0]}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-tagline">Tagline</Label>
                  <Input id="brand-tagline" value={detail.tagline ?? ""} onChange={set("tagline")} />
                  {errors.tagline && <p className="mt-1 text-xs text-destructive">{errors.tagline[0]}</p>}
                </div>
              </Fieldset>

              <Fieldset legend="Company sign-in page" grid={2}>
                <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                  Hero copy shown on the company sign-in page only. Leave blank to keep the default wording.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="login-eyebrow">Eyebrow text</Label>
                  <Input id="login-eyebrow" placeholder="Built for growing sales & finance teams" value={detail.login_eyebrow ?? ""} onChange={set("login_eyebrow")} />
                  {errors.login_eyebrow && <p className="mt-1 text-xs text-destructive">{errors.login_eyebrow[0]}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-heading">Headline</Label>
                  <Input id="login-heading" placeholder="One flow to run your business." value={detail.login_heading ?? ""} onChange={set("login_heading")} />
                  <p className="text-xs text-muted-foreground">The last word is highlighted in colour.</p>
                  {errors.login_heading && <p className="mt-1 text-xs text-destructive">{errors.login_heading[0]}</p>}
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="login-description">Subtext</Label>
                  <Textarea id="login-description" rows={2} placeholder="Sign in to pick up right where you left off." value={detail.login_description ?? ""} onChange={set("login_description")} />
                  {errors.login_description && <p className="mt-1 text-xs text-destructive">{errors.login_description[0]}</p>}
                </div>
                <div className="col-span-2">
                  <TranslationFields
                    value={detail.translations}
                    onChange={(translations) => setDetail((d) => ({ ...d, translations }))}
                    fields={[
                      { key: "tagline", label: "Tagline" },
                      { key: "login_eyebrow", label: "Login eyebrow" },
                      { key: "login_heading", label: "Login heading" },
                      { key: "login_description", label: "Login subtext", multiline: true, rows: 2 },
                    ]}
                    english={{ tagline: detail.tagline, login_eyebrow: detail.login_eyebrow, login_heading: detail.login_heading, login_description: detail.login_description }}
                    errors={errors}
                  />
                </div>
              </Fieldset>

              <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex items-center justify-between gap-3 rounded-b-2xl border-t bg-card/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
                <p className="text-xs text-muted-foreground">
                  {unsaved ? <span className="font-medium text-amber-600">New logo selected, not saved yet</span> : "Changes apply to every tenant once saved."}
                </p>
                <Button type="submit" disabled={saving || !detail.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <aside className="xl:sticky xl:top-4 xl:self-start">
            <BrandPreview detail={detail} logo={logoPreview} loginLogo={loginLogoPreview} />
          </aside>
        </form>
      )}
    </div>
  );
}

/* ─── Automations ─────────────────────────────────────────────────────── */

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
    platformService.automations
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
        await platformService.automations.update(editing.id, payload);
        toast.success("Automation updated");
      } else {
        await platformService.automations.create(payload);
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
      await platformService.automations.update(automation.id, {
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
      await platformService.automations.delete(deleteTarget.id);
      toast.success("Automation deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Failed to delete automation");
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = automations.filter((a) => a.is_active).length;
  const failedCount = automations.filter((a) => a.last_run_status && a.last_run_status !== "success").length;
  const nextRun = automations
    .filter((a) => a.is_active && a.next_run_at)
    .map((a) => a.next_run_at)
    .sort()[0];

  return (
    <>
      <div className="space-y-5">
        <SectionHeader
          icon={Zap}
          tone="bg-amber-500/10 text-amber-600"
          title="Automation Scheduler"
          description="Scheduled background tasks and how often they run."
          action={
            <Button type="button" size="sm" onClick={openCreate} className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" /> New automation
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={Zap} label="Automations" value={automations.length} tone="bg-amber-500/10 text-amber-600" />
          <StatTile icon={CheckCircle2} label="Active" value={activeCount} tone="bg-emerald-500/10 text-emerald-600" />
          <StatTile icon={XCircle} label="Failed last run" value={failedCount} tone={failedCount ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"} />
          <StatTile icon={CalendarClock} label="Next run" value={nextRun ? formatDateTime(nextRun) : "—"} tone="bg-sky-500/10 text-sky-600" />
        </div>

        {loading ? (
          <Card className="rounded-2xl"><Spinner /></Card>
        ) : automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No automations yet"
            hint="Create one to run a background task on a schedule."
            action={<Button size="sm" className="mt-2 gap-1.5" onClick={openCreate}><Plus className="h-4 w-4" /> New automation</Button>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {automations.map((automation) => {
              const failed = automation.last_run_status && automation.last_run_status !== "success";
              return (
                <Card key={automation.id} className={cn("rounded-2xl shadow-sm transition-colors", !automation.is_active && "bg-muted/30")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          automation.is_active ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
                        )}>
                          {automation.is_active ? <Zap className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{automation.name}</p>
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />{automation.interval_label}{automation.fixed_time && ` at ${automation.fixed_time}`}
                          </span>
                        </div>
                      </div>
                      <Toggle
                        checked={automation.is_active}
                        busy={togglingId === automation.id}
                        label={automation.is_active ? "Pause automation" : "Activate automation"}
                        onClick={() => togglingId !== automation.id && handleToggleActive(automation)}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 p-2.5">
                        <p className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-3 w-3" /> Next run</p>
                        <p className="mt-0.5 font-medium">{automation.is_active && automation.next_run_at ? formatDateTime(automation.next_run_at) : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2.5">
                        <p className="flex items-center gap-1 text-muted-foreground"><History className="h-3 w-3" /> Last ran</p>
                        <p className="mt-0.5 flex items-center gap-1 font-medium">
                          {automation.last_run_at ? formatDateTime(automation.last_run_at) : "Never"}
                          {automation.last_run_status && (
                            failed
                              ? <XCircle className="h-3.5 w-3.5 text-destructive" aria-label="failed" />
                              : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="success" />
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className={cn("text-[11px] font-medium", automation.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                        {automation.is_active ? "● Running on schedule" : "○ Paused"}
                      </span>
                      <div className="flex gap-1">
                        <ActionButton onClick={() => openEdit(automation)} icon={Pencil} label="Edit" className={TONE.edit} />
                        <ActionButton onClick={() => setDeleteTarget(automation)} icon={Trash2} label="Delete" className={TONE.delete} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit automation" : "New automation"}</DialogTitle></DialogHeader>
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
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                        form.interval === opt.value ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/50"
                      )}
                    >
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

              <label className="flex cursor-pointer items-center gap-2 text-sm">
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

/* ─── Backups ─────────────────────────────────────────────────────────── */

function BackupsCard() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const isOwner = admin?.admin_role === "platform_owner";

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);

  const load = () => {
    setLoading(true);
    platformService.backups
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
      await platformService.backups.create();
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
      const res = await platformService.backups.download(backup.path);
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
      await platformService.backups.delete(deleteTarget.path);
      toast.success("Backup deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to delete backup");
    } finally {
      setDeleting(false);
    }
  };

  const totalSize = backups.reduce((sum, b) => sum + (Number(b.size) || 0), 0);
  const latest = backups.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);

  return (
    <>
      <div className="space-y-5">
        <SectionHeader
          icon={Database}
          tone="bg-blue-500/10 text-blue-600"
          title="Database Backups"
          description="Full database dumps, taken automatically every night and on demand."
          action={
            <Button type="button" size="sm" onClick={handleCreate} disabled={creating} className="shrink-0 gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {creating ? "Creating..." : "Backup now"}
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile icon={Archive} label="Backups kept" value={backups.length} tone="bg-blue-500/10 text-blue-600" />
          <StatTile icon={HardDrive} label="Total size" value={formatBytes(totalSize)} tone="bg-violet-500/10 text-violet-600" />
          <StatTile icon={History} label="Latest backup" value={latest ? formatDateTime(latest.created_at) : "—"} tone="bg-emerald-500/10 text-emerald-600" />
        </div>

        {!isOwner && (
          <p className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Only the Platform Owner can download, email or delete backups.
          </p>
        )}

        {loading ? (
          <Card className="rounded-2xl"><Spinner /></Card>
        ) : backups.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No backups yet"
            hint="A backup is taken automatically every night. You can also take one now."
            action={<Button size="sm" className="mt-2 gap-1.5" onClick={handleCreate} disabled={creating}><Database className="h-4 w-4" /> Backup now</Button>}
          />
        ) : (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="divide-y p-0">
              {backups.map((backup) => (
                <div key={backup.path} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Archive className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {formatDateTime(backup.created_at)}
                        {latest?.path === backup.path && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600"><Sparkles className="h-2.5 w-2.5" /> Latest</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{formatBytes(backup.size)} · {backup.path.split("/").pop()}</p>
                    </div>
                  </div>
                  {/* Download, email and delete are Platform Owner only (backend: platform.owner). */}
                  {isOwner && (
                    <div className="flex shrink-0 gap-1">
                      <ActionButton
                        onClick={() => handleDownload(backup)}
                        icon={downloadingPath === backup.path ? Loader2 : Download}
                        label="Download"
                        className={cn(TONE.download, downloadingPath === backup.path && "[&_svg]:animate-spin")}
                        disabled={downloadingPath === backup.path}
                      />
                      <ActionButton onClick={() => setEmailTarget(backup)} icon={Mail} label="Email" className={TONE.mail} />
                      <ActionButton onClick={() => setDeleteTarget(backup)} icon={Trash2} label="Delete" className={TONE.delete} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

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
        onSend={(data) => platformService.backups.email({ ...data, path: emailTarget.path })}
        hideCloseButton
      />
    </>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function PlatformSettingsPage() {
  const admin = usePlatformAuthStore((s) => s.admin);

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Settings" },
  ];

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-5 sm:p-6">
          <Settings aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-primary/[0.07]" />
          <div className="relative flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Settings className="h-6 w-6" /></span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Platform settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account, the platform brand, scheduled tasks and backups.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile" orientation="vertical" className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <TabsList className="h-auto w-full shrink-0 flex-col items-stretch justify-start gap-1 rounded-2xl border bg-card p-2 shadow-sm lg:sticky lg:top-4 lg:w-72">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
            {SECTIONS.map((s) => <SectionNavItem key={s.value} {...s} />)}
          </TabsList>

          <div className="min-w-0 flex-1">
            <TabsContent value="profile" className="mt-0"><ProfileCard admin={admin} /></TabsContent>
            <TabsContent value="branding" className="mt-0"><BrandingCard /></TabsContent>
            <TabsContent value="automations" className="mt-0"><AutomationsCard /></TabsContent>
            <TabsContent value="backups" className="mt-0"><BackupsCard /></TabsContent>
          </div>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
