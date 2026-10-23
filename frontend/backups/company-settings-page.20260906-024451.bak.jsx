"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { companyService, companySettingService } from "@/services/companyService";
import { Button } from "@/components/ui/button";
import { Building2, Save, Loader2 } from "lucide-react";

const TABS = [
  { key: "profile", label: "Company Profile", icon: Building2 },
  { key: "numbering", label: "Numbering & Tax", icon: Save },
];

const inputClass = "h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function DetailRow({ label, required, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-2">
      <label className="sm:w-40 shrink-0 text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex-1">{children}</div>
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

const EMPTY_COMPANY = {
  name: "", legal_name: "", email: "", phone: "", website: "", trn: "",
  address_line_1: "", address_line_2: "", city: "", emirate: "", country: "United Arab Emirates",
  currency: "AED", timezone: "Asia/Dubai",
};

const EMPTY_SETTINGS = {
  quotation_prefix: "QUO", invoice_prefix: "INV", payment_prefix: "PAY",
  expense_prefix: "EXP", customer_prefix: "CUS", default_tax_rate: 5,
  quotation_terms: "", invoice_terms: "", invoice_footer: "",
};

export default function CompanySettingsPage() {
  const [tab, setTab] = useState("profile");
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

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveCompany = async () => {
    setCompanyErrors({});
    setSavingCompany(true);
    try {
      const fd = new FormData();
      Object.entries(company).forEach(([key, value]) => {
        if (value !== null && value !== undefined) fd.append(key, value);
      });
      if (logoFile) fd.append("logo", logoFile);
      const res = await companyService.update(fd);
      setCompany({ ...EMPTY_COMPANY, ...res.data.data });
      setLogoFile(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">Company Settings</h1>
        <p className="text-sm text-muted-foreground">Your company profile appears on every quotation and invoice PDF.</p>
      </div>

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
          {tab === "profile" && (
            <>
              <SectionCard title="Logo">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
                      <span className="text-sm text-muted-foreground">{logoFile?.name ?? "No file chosen"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB.</p>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
                    {companyErrors.logo && <p className="text-xs text-destructive mt-1">{companyErrors.logo[0]}</p>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Business Details">
                <DetailRow label="Trading Name" required>
                  <input className={inputClass} value={company.name} onChange={(e) => setCompany((f) => ({ ...f, name: e.target.value }))} />
                  {companyErrors.name && <p className="text-xs text-destructive mt-1">{companyErrors.name[0]}</p>}
                </DetailRow>
                <DetailRow label="Legal Name">
                  <input className={inputClass} value={company.legal_name ?? ""} onChange={(e) => setCompany((f) => ({ ...f, legal_name: e.target.value }))} />
                </DetailRow>
                <DetailRow label="TRN">
                  <input className={inputClass} value={company.trn ?? ""} onChange={(e) => setCompany((f) => ({ ...f, trn: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Email">
                  <input type="email" className={inputClass} value={company.email ?? ""} onChange={(e) => setCompany((f) => ({ ...f, email: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Phone">
                  <input className={inputClass} value={company.phone ?? ""} onChange={(e) => setCompany((f) => ({ ...f, phone: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Website">
                  <input className={inputClass} value={company.website ?? ""} onChange={(e) => setCompany((f) => ({ ...f, website: e.target.value }))} />
                </DetailRow>
              </SectionCard>

              <SectionCard title="Address">
                <DetailRow label="Address Line 1">
                  <input className={inputClass} value={company.address_line_1 ?? ""} onChange={(e) => setCompany((f) => ({ ...f, address_line_1: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Address Line 2">
                  <input className={inputClass} value={company.address_line_2 ?? ""} onChange={(e) => setCompany((f) => ({ ...f, address_line_2: e.target.value }))} />
                </DetailRow>
                <DetailRow label="City">
                  <input className={inputClass} value={company.city ?? ""} onChange={(e) => setCompany((f) => ({ ...f, city: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Emirate">
                  <input className={inputClass} value={company.emirate ?? ""} onChange={(e) => setCompany((f) => ({ ...f, emirate: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Country">
                  <input className={inputClass} value={company.country ?? ""} onChange={(e) => setCompany((f) => ({ ...f, country: e.target.value }))} />
                </DetailRow>
              </SectionCard>

              <SectionCard title="Localization">
                <DetailRow label="Currency">
                  <input className={inputClass} value={company.currency ?? ""} onChange={(e) => setCompany((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
                </DetailRow>
                <DetailRow label="Timezone">
                  <input className={inputClass} value={company.timezone ?? ""} onChange={(e) => setCompany((f) => ({ ...f, timezone: e.target.value }))} />
                </DetailRow>
              </SectionCard>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" onClick={handleSaveCompany} disabled={savingCompany || !company.name.trim()}>
                  <Save className="h-4 w-4" />{savingCompany ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}

          {tab === "numbering" && (
            <>
              <SectionCard title="Document Prefixes">
                <DetailRow label="Quotation Prefix">
                  <input className={inputClass} value={settings.quotation_prefix} onChange={(e) => setSettings((f) => ({ ...f, quotation_prefix: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Invoice Prefix">
                  <input className={inputClass} value={settings.invoice_prefix} onChange={(e) => setSettings((f) => ({ ...f, invoice_prefix: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Payment Prefix">
                  <input className={inputClass} value={settings.payment_prefix} onChange={(e) => setSettings((f) => ({ ...f, payment_prefix: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Expense Prefix">
                  <input className={inputClass} value={settings.expense_prefix} onChange={(e) => setSettings((f) => ({ ...f, expense_prefix: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Customer Prefix">
                  <input className={inputClass} value={settings.customer_prefix} onChange={(e) => setSettings((f) => ({ ...f, customer_prefix: e.target.value }))} />
                </DetailRow>
              </SectionCard>

              <SectionCard title="Tax">
                <DetailRow label="Default VAT %">
                  <input type="number" step="0.01" min="0" max="100" className={inputClass} value={settings.default_tax_rate}
                    onChange={(e) => setSettings((f) => ({ ...f, default_tax_rate: e.target.value }))} />
                  {settingsErrors.default_tax_rate && <p className="text-xs text-destructive mt-1">{settingsErrors.default_tax_rate[0]}</p>}
                </DetailRow>
              </SectionCard>

              <SectionCard title="Default Terms">
                <DetailRow label="Quotation Terms">
                  <textarea className={`${inputClass} h-20 py-2`} value={settings.quotation_terms ?? ""} onChange={(e) => setSettings((f) => ({ ...f, quotation_terms: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Invoice Terms">
                  <textarea className={`${inputClass} h-20 py-2`} value={settings.invoice_terms ?? ""} onChange={(e) => setSettings((f) => ({ ...f, invoice_terms: e.target.value }))} />
                </DetailRow>
                <DetailRow label="Invoice Footer">
                  <textarea className={`${inputClass} h-16 py-2`} value={settings.invoice_footer ?? ""} onChange={(e) => setSettings((f) => ({ ...f, invoice_footer: e.target.value }))} />
                </DetailRow>
              </SectionCard>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" onClick={handleSaveSettings} disabled={savingSettings}>
                  <Save className="h-4 w-4" />{savingSettings ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
