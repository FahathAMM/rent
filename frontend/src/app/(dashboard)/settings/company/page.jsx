"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { toast } from "sonner";
import { companyService, companySettingService } from "@/services/companyService";
import { useAuthStore } from "@/store/authStore";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fieldset } from "@/components/forms/Fieldset";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Home, Building2, Image as ImageIcon, MapPin, Globe, Hash, Save, Loader2 } from "lucide-react";

const TABS = [
  { key: "logo",         label: "Logo",             icon: ImageIcon,    iconBg: "bg-purple-100",  iconColor: "text-purple-600"  },
  { key: "business",     label: "Business Details", icon: Building2,    iconBg: "bg-blue-100",    iconColor: "text-blue-600"    },
  { key: "address",      label: "Address",          icon: MapPin,       iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  { key: "localization", label: "Localization",     icon: Globe,        iconBg: "bg-amber-100",   iconColor: "text-amber-600"   },
  { key: "numbering",    label: "Numbering",        icon: Hash,         iconBg: "bg-indigo-100",  iconColor: "text-indigo-600"  },
];

function CardHeading({ icon: Icon, iconBg, iconColor, title, description }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "LKR", label: "LKR - Sri Lankan Rupee (Rs)" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "AED", label: "AED - UAE Dirham" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Colombo", label: "Sri Lanka (Asia/Colombo)" },
  { value: "Asia/Dubai", label: "Dubai (Asia/Dubai)" },
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { value: "UTC", label: "UTC" },
];

const EMPTY_COMPANY = {
  name: "", legal_name: "", email: "", phone: "", website: "", trn: "",
  address_line_1: "", address_line_2: "", city: "", emirate: "", country: "United Arab Emirates",
  currency: "AED", timezone: "Asia/Dubai",
};

const EMPTY_SETTINGS = {
  invoice_prefix: "INV", expense_prefix: "EXP", invoice_footer: "",
};

export default function CompanySettingsPage() {
  const authUser = useAuthStore((s) => s.user);
  const updateAuthUser = useAuthStore((s) => s.updateUser);
  const [tab, setTab] = useState("logo");
  const [loading, setLoading] = useState(true);

  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [companyErrors, setCompanyErrors] = useState({});
  const [savingCompany, setSavingCompany] = useState(false);
  const fileInputRef = useRef(null);

  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  let currencyPreview;
  try {
    currencyPreview = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: company.currency || "AED",
    }).format(1234567.89);
  } catch {
    currencyPreview = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(1234567.89);
  }

  useEffect(() => {
    Promise.all([companyService.get(), companySettingService.get()])
      .then(([companyRes, settingsRes]) => {
        setCompany({ ...EMPTY_COMPANY, ...companyRes.data.data });
        setLogoPreview(companyRes.data.data.logo ?? null);
        setSettings({ ...EMPTY_SETTINGS, ...settingsRes.data.data });
      })
      .catch(() => toast.error("Failed to load company settings"))
      .finally(() => setLoading(false));
  }, []);

  // Mirrors the backend's `dimensions:min_width=64,min_height=64,max_width=1024,max_height=1024`
  // rule (UpdateCompanyRequest) — checked client-side too so a bad image is
  // rejected instantly instead of round-tripping to the server first.
  const LOGO_MIN = 64;
  const LOGO_MAX = 1024;

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      if (img.width < LOGO_MIN || img.height < LOGO_MIN || img.width > LOGO_MAX || img.height > LOGO_MAX) {
        setCompanyErrors((prev) => ({
          ...prev,
          logo: [`Image must be between ${LOGO_MIN}x${LOGO_MIN} and ${LOGO_MAX}x${LOGO_MAX}px (this one is ${img.width}x${img.height}px).`],
        }));
        URL.revokeObjectURL(url);
        e.target.value = "";
        return;
      }
      setCompanyErrors((prev) => ({ ...prev, logo: undefined }));
      setLogoFile(file);
      setLogoPreview(url);
    };
    img.src = url;
  };

  const handleSaveCompany = async () => {
    setCompanyErrors({});
    setSavingCompany(true);
    try {
      const fd = new FormData();
      // Only the known editable fields — not a blind spread of `company`,
      // which also carries read-only server fields like `logo` (a URL
      // string once loaded), `id`, `status`, `created_at`. Sending that
      // logo string as the `logo` field fails the backend's `image` rule
      // on every save, even ones that never touch the logo.
      Object.keys(EMPTY_COMPANY).forEach((key) => {
        const value = company[key];
        if (value !== null && value !== undefined) fd.append(key, value);
      });
      if (logoFile) fd.append("logo", logoFile);
      const res = await companyService.update(fd);
      setCompany({ ...EMPTY_COMPANY, ...res.data.data });
      setLogoFile(null);

      // Sync into the global auth store too — Header/Sidebar read
      // user.company (logo, name, ...) from there, and it otherwise stays
      // stale (whatever it was at login) until the next sign-in.
      if (authUser) {
        updateAuthUser({ ...authUser, company: { ...authUser.company, ...res.data.data } });
      }

      toast.success("Company profile updated");
    } catch (err) {
      setCompanyErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to update company profile");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsErrors({});
    setSavingSettings(true);
    try {
      const res = await companySettingService.update(settings);
      setSettings({ ...EMPTY_SETTINGS, ...res.data.data });
      toast.success("Numbering & tax settings updated");
    } catch (err) {
      setSettingsErrors(err.response?.data?.errors ?? {});
      toast.error(err.response?.data?.message ?? "Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard", icon: <Home className="size-4" /> },
    { label: "Company Settings" },
  ];

  if (loading) {
    return (
      <PageWrapper breadcrumb={breadcrumbItems}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  const activeTab = TABS.find((t) => t.key === tab);

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Company Settings" description="Your company profile appears on every quotation and invoice PDF." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tab sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2.5 space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                  tab === key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-0.5"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  tab === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground group-hover:bg-background"
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Active panel */}
        <Card className="lg:col-span-3 h-fit">
          <CardContent className="p-6">
            <CardHeading
              icon={activeTab.icon}
              iconBg={activeTab.iconBg}
              iconColor={activeTab.iconColor}
              title={activeTab.label}
              description={{
                logo: "Shown in the sidebar and on every quotation and invoice PDF.",
                business: "Your legal identity as it appears on official documents.",
                address: "Your registered business address for documents and correspondence.",
                localization: "Currency and timezone used across quotations, invoices and reports.",
                numbering: "Document number prefixes and the invoice footer text.",
              }[tab]}
            />

            {tab === "logo" && (
              <>
                <Fieldset legend="Company Logo" grid={false}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreview ? <NextImage src={logoPreview} alt="" fill unoptimized className="object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                        <span className="text-sm text-muted-foreground">{logoFile?.name ?? "No file chosen"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG or JPG, up to 2MB. Square recommended (e.g. 200×200px) since it&apos;s shown as a small icon in the header/sidebar — between {LOGO_MIN}×{LOGO_MIN} and {LOGO_MAX}×{LOGO_MAX}px.
                      </p>
                      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
                      {companyErrors.logo && <p className="text-xs text-destructive mt-1">{companyErrors.logo[0]}</p>}
                    </div>
                  </div>
                </Fieldset>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" onClick={handleSaveCompany} disabled={savingCompany || !company.name.trim()}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}

            {tab === "business" && (
              <>
                <Fieldset legend="Business Information" grid={2}>
                  <TextInput label="Trading Name" required value={company.name} onChange={(e) => setCompany((f) => ({ ...f, name: e.target.value }))} error={companyErrors.name?.[0]} />
                  <TextInput label="Legal Name" value={company.legal_name ?? ""} onChange={(e) => setCompany((f) => ({ ...f, legal_name: e.target.value }))} error={companyErrors.legal_name?.[0]} />
                  <TextInput label="TRN" value={company.trn ?? ""} onChange={(e) => setCompany((f) => ({ ...f, trn: e.target.value }))} error={companyErrors.trn?.[0]} />
                  <TextInput label="Email" type="email" value={company.email ?? ""} onChange={(e) => setCompany((f) => ({ ...f, email: e.target.value }))} error={companyErrors.email?.[0]} />
                  <TextInput label="Phone" value={company.phone ?? ""} onChange={(e) => setCompany((f) => ({ ...f, phone: e.target.value }))} error={companyErrors.phone?.[0]} />
                  <TextInput label="Website" value={company.website ?? ""} onChange={(e) => setCompany((f) => ({ ...f, website: e.target.value }))} error={companyErrors.website?.[0]} />
                </Fieldset>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" onClick={handleSaveCompany} disabled={savingCompany || !company.name.trim()}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}

            {tab === "address" && (
              <>
                <Fieldset legend="Registered Address" grid={2}>
                  <TextInput label="Address Line 1" className="col-span-2" value={company.address_line_1 ?? ""} onChange={(e) => setCompany((f) => ({ ...f, address_line_1: e.target.value }))} error={companyErrors.address_line_1?.[0]} />
                  <TextInput label="Address Line 2" className="col-span-2" value={company.address_line_2 ?? ""} onChange={(e) => setCompany((f) => ({ ...f, address_line_2: e.target.value }))} error={companyErrors.address_line_2?.[0]} />
                  <TextInput label="City" value={company.city ?? ""} onChange={(e) => setCompany((f) => ({ ...f, city: e.target.value }))} error={companyErrors.city?.[0]} />
                  <TextInput label="Emirate" value={company.emirate ?? ""} onChange={(e) => setCompany((f) => ({ ...f, emirate: e.target.value }))} error={companyErrors.emirate?.[0]} />
                  <TextInput label="Country" className="col-span-2" value={company.country ?? ""} onChange={(e) => setCompany((f) => ({ ...f, country: e.target.value }))} error={companyErrors.country?.[0]} />
                </Fieldset>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" onClick={handleSaveCompany} disabled={savingCompany || !company.name.trim()}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}

            {tab === "localization" && (
              <>
                <Fieldset legend="Currency & Timezone" grid={2}>
                  <SelectInput label="Currency" value={company.currency ?? ""} onChange={(v) => setCompany((f) => ({ ...f, currency: v }))} options={CURRENCY_OPTIONS} placeholder="Select currency" error={companyErrors.currency?.[0]} />
                  <SelectInput label="Timezone" value={company.timezone ?? ""} onChange={(v) => setCompany((f) => ({ ...f, timezone: v }))} options={TIMEZONE_OPTIONS} placeholder="Select timezone" error={companyErrors.timezone?.[0]} />
                </Fieldset>

                {/* Live preview — visual only, does not touch stored data */}
                <div className="mt-1 rounded-xl border bg-muted/30 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
                    <p className="text-2xl font-bold text-primary mt-0.5">{currencyPreview}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>Currency: <span className="font-mono font-medium text-foreground">{company.currency || "AED"}</span></p>
                    <p>Timezone: <span className="font-mono font-medium text-foreground">{company.timezone || "Asia/Dubai"}</span></p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-5">
                  <Button type="button" onClick={handleSaveCompany} disabled={savingCompany || !company.name.trim()}>
                    {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCompany ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}

            {tab === "numbering" && (
              <>
                <Fieldset legend="Document Prefixes" grid={2}>
                  <TextInput label="Invoice Prefix" value={settings.invoice_prefix} onChange={(e) => setSettings((f) => ({ ...f, invoice_prefix: e.target.value }))} error={settingsErrors.invoice_prefix?.[0]} />
                  <TextInput label="Expense Prefix" value={settings.expense_prefix} onChange={(e) => setSettings((f) => ({ ...f, expense_prefix: e.target.value }))} error={settingsErrors.expense_prefix?.[0]} />
                </Fieldset>

                <Fieldset legend="Invoice Footer" grid={1}>
                  <TextareaInput label="Invoice Footer" value={settings.invoice_footer ?? ""} onChange={(e) => setSettings((f) => ({ ...f, invoice_footer: e.target.value }))} error={settingsErrors.invoice_footer?.[0]} />
                </Fieldset>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
