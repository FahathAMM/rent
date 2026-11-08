"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopOnboardingService } from "@/services/shopOnboardingService";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { useShopStore } from "@/store/shopStore";
import { publicService } from "@/services/publicService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatusBanner } from "@/components/shared/StatusBanner";
import { OnboardingStepper } from "@/components/account/OnboardingStepper";
import { ShopCover } from "@/components/marketplace/ShopCover";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import {
  Loader2, UploadCloud, FileCheck2, Store, Clock, XCircle, Building2, FileBarChart, MapPin, Phone,
  Mail, Globe, MessageCircle, Sparkles, ShieldCheck, Users, Wallet, CarFront, CheckCircle2, Circle,
  FileText, Send, BadgeCheck, ArrowRight, Eye, Download, Quote,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn, downloadBlob, openBlob, APP_TIMEZONE } from "@/lib/utils";

const defaultForm = {
  name: "", description: "", tagline: "", email: "", phone: "", whatsapp: "", website: "",
  address_line_1: "", address_line_2: "", city: "", district: "", postal_code: "",
  business_registration_no: "", tax_id: "",
};

const EDITABLE_VERIFICATION_STATES = ["unverified", "rejected"];
const UNVERIFIED_STATES = ["unverified", "pending", "rejected"];
const STEPS = ["Details", "Documents", "Review"];
const TAGLINE_MAX = 255;

const GRADIENT = "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90";

const BENEFITS = [
  { icon: Users, title: "Reach more customers", body: "List on the marketplace and get found by renters and buyers island-wide." },
  { icon: CarFront, title: "Manage your vehicles", body: "Rentals, sale listings, pricing and photos in one place." },
  { icon: Wallet, title: "Get paid directly", body: "Customers pay you in cash at pickup or by bank transfer to your account." },
  { icon: ShieldCheck, title: "Verified badge", body: "Verified shops earn customers' trust and rank higher." },
];

const NEXT_STEPS = [
  { icon: FileText, title: "Upload registration", body: "Your business registration certificate (JPG, PNG or PDF)." },
  { icon: Send, title: "Submit for review", body: "Our team checks your details, usually within 1–2 business days." },
  { icon: BadgeCheck, title: "Go live", body: "Once verified, your shop and vehicles appear on the marketplace." },
];

export default function NewShopPage() {
  const qc = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const setShop = useShopStore((state) => state.setShop);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: shops, isLoading } = useQuery({
    queryKey: ["onboarding-shops"],
    queryFn: () => shopOnboardingService.index().then((r) => r.data.data),
  });

  const inProgressShop = (shops ?? []).find((s) => UNVERIFIED_STATES.includes(s.verification_status));

  const { data: districts } = useQuery({
    queryKey: ["public-districts"],
    queryFn: () => publicService.districts().then((r) => r.data.data),
  });

  const register = useMutation({
    mutationFn: shopOnboardingService.register,
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["onboarding-shops"] });
      qc.invalidateQueries({ queryKey: ["menus", "navigation", "vendor"] });
      try {
        const response = await authService.me();
        updateUser(response.data.data);
        setShop(response.data.data.shop);
      } catch {
        toast.error("Shop registered. Refresh the page to load vendor access.");
      }
      toast.success("Shop registered — add your documents to continue");
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const upload = useMutation({
    mutationFn: ({ shopId, file }) => shopOnboardingService.uploadDocument(shopId, "business_registration", file),
    onMutate: () => setUploading(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-shops"] });
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Upload failed"),
    onSettled: () => setUploading(false),
  });

  const submit = useMutation({
    mutationFn: shopOnboardingService.submit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-shops"] });
      toast.success("Shop submitted for verification");
    },
    onError: (err) => toast.error(err.response?.data?.errors?.documents?.[0] ?? err.response?.data?.message ?? "Could not submit"),
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const selectDistrict = (value) => setForm((p) => ({ ...p, district: value, city: "" }));
  const selectCity = (value) => setForm((p) => ({ ...p, city: value }));

  const districtOptions = (districts ?? []).map((d) => ({ value: d.name, label: d.name }));
  const cityOptions = (districts ?? []).find((d) => d.name === form.district)?.cities
    .map((c) => ({ value: c.name, label: c.name })) ?? [];

  const handleRegister = (e) => {
    e.preventDefault();
    setErrors({});
    register.mutate(form);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && inProgressShop) upload.mutate({ shopId: inProgressShop.id, file });
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && inProgressShop) upload.mutate({ shopId: inProgressShop.id, file });
  };

  const handleView = async (verificationId) => {
    // Open the tab now, inside the click, or the browser blocks it as a popup once the request resolves.
    const tab = window.open("", "_blank");
    try {
      const res = await shopOnboardingService.downloadDocument(verificationId);
      openBlob(res.data, tab);
    } catch {
      tab?.close();
      toast.error("Failed to open file");
    }
  };

  const handleDownload = async (verificationId, filename) => {
    try {
      const res = await shopOnboardingService.downloadDocument(verificationId);
      downloadBlob(res.data, filename);
    } catch {
      toast.error("Failed to download file");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if ((shops ?? []).some((s) => s.verification_status === "verified")) {
    return (
      <Card className="mx-auto w-full max-w-6xl rounded-3xl">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <BadgeCheck className="h-7 w-7" />
          </div>
          <p className="text-lg font-semibold">You already have a verified shop</p>
          <p className="max-w-sm text-sm text-muted-foreground">Head to your vendor workspace to manage vehicles, bookings and payments.</p>
          <Button asChild className={GRADIENT}><Link href="/vendor/dashboard">Go to vendor dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const businessReg = inProgressShop?.verifications?.find((v) => v.document_type === "business_registration");
  const canEdit = !inProgressShop || EDITABLE_VERIFICATION_STATES.includes(inProgressShop.verification_status);
  const stepIndex = !inProgressShop ? 0 : (canEdit ? 1 : 2);

  // What the preview and checklist read from: the draft form before registering, the saved shop after.
  const shown = inProgressShop ?? form;
  const checklist = [
    { label: "Shop name", done: !!shown.name },
    { label: "Email, phone & WhatsApp", done: !!(shown.email && shown.phone && shown.whatsapp) },
    { label: "Address, district & city", done: !!(shown.address_line_1 && shown.district && shown.city) },
    { label: "Business registration no.", done: !!shown.business_registration_no },
    { label: "Description", done: !!shown.description },
  ];
  const completion = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-4" />
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Become a vendor
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Register a Shop</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Run a business with multiple vehicles and staff. Registration takes a few minutes — your vendor workspace opens once our team verifies your shop.
              </p>
            </div>
          </div>
          {inProgressShop && <StatusBadge status={inProgressShop.verification_status} />}
        </div>
        <div className="relative mt-6">
          <OnboardingStepper steps={STEPS} currentIndex={stepIndex} />
        </div>
      </div>

      {inProgressShop?.verification_status === "pending" && (
        <StatusBanner icon={Clock} tone="info" title="Awaiting platform review" body="Your shop is submitted and awaiting platform review. Your vendor workspace opens as soon as it is verified — we'll notify you." />
      )}

      {inProgressShop?.verification_status === "rejected" && (
        <StatusBanner icon={XCircle} tone="destructive" title="Verification rejected" body={inProgressShop.suspended_reason} />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          {!inProgressShop && (
            <form onSubmit={handleRegister} className="space-y-5">
              <ValidationError errors={errors} />

              <Section icon={Building2} title="Shop identity" description="How customers will see your business on the marketplace.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Shop Name" placeholder="e.g. Island Motors" value={form.name} onChange={fi("name")} required error={errors.name?.[0]} />
                  <div>
                    <TextInput label="Tagline" placeholder="e.g. Explore Sri Lanka your way" maxLength={TAGLINE_MAX} value={form.tagline} onChange={fi("tagline")} error={errors.tagline?.[0]} />
                    <p className="mt-1 text-right text-[11px] text-muted-foreground">{form.tagline.length}/{TAGLINE_MAX}</p>
                  </div>
                </div>
                <TextareaInput
                  label="Description"
                  placeholder="Tell customers about your vehicles, service area, and what makes you different…"
                  rows={4}
                  value={form.description}
                  onChange={fi("description")}
                  error={errors.description?.[0]}
                />
              </Section>

              <Section icon={Phone} title="Contact" description="Customers use these to reach you.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Email" required type="email" placeholder="bookings@yourshop.lk" value={form.email} onChange={fi("email")} error={errors.email?.[0]} />
                  <TextInput label="Phone" required type="tel" placeholder="07X XXX XXXX" value={form.phone} onChange={fi("phone")} error={errors.phone?.[0]} />
                  <TextInput label="WhatsApp" required type="tel" placeholder="07X XXX XXXX" value={form.whatsapp} onChange={fi("whatsapp")} error={errors.whatsapp?.[0]} />
                  <TextInput label="Website" placeholder="https://" value={form.website} onChange={fi("website")} error={errors.website?.[0]} />
                </div>
              </Section>

              <Section icon={MapPin} title="Location" description="Your main branch — customers filter shops by district and city.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Address Line 1" required placeholder="No. 12, Galle Road" value={form.address_line_1} onChange={fi("address_line_1")} error={errors.address_line_1?.[0]} />
                  <TextInput label="Address Line 2" value={form.address_line_2} onChange={fi("address_line_2")} error={errors.address_line_2?.[0]} />
                  <SelectInput label="District" required placeholder="Select district" options={districtOptions} value={form.district} onChange={selectDistrict} error={errors.district?.[0]} />
                  <SelectInput label="City" required placeholder={form.district ? "Select city" : "Select a district first"} options={cityOptions} value={form.city} onChange={selectCity} disabled={!form.district} error={errors.city?.[0]} />
                  <TextInput label="Postal Code" value={form.postal_code} onChange={fi("postal_code")} error={errors.postal_code?.[0]} />
                </div>
              </Section>

              <Section icon={FileBarChart} title="Business registration" description="Needed for verification — must match the certificate you upload next.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="Business Registration No." placeholder="PV 00012345" value={form.business_registration_no} onChange={fi("business_registration_no")} error={errors.business_registration_no?.[0]} />
                  <TextInput label="Tax ID" value={form.tax_id} onChange={fi("tax_id")} error={errors.tax_id?.[0]} />
                </div>
              </Section>

              <div className="flex flex-col-reverse items-stretch gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">You can edit these details later from your shop settings.</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button type="button" variant="outline" size="lg" asChild>
                    <Link href="/">Cancel</Link>
                  </Button>
                  <Button type="submit" size="lg" disabled={register.isPending} className={GRADIENT}>
                    {register.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Register Shop
                  </Button>
                </div>
              </div>
            </form>
          )}

          {inProgressShop && (
            <>
              <Section icon={FileBarChart} title="Required document" description="Upload your business registration certificate (JPG, PNG or PDF, max 5MB).">
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
                {businessReg ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-emerald-500/5 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white">
                        <FileCheck2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Business Registration</p>
                        <p className="truncate text-xs text-muted-foreground">{businessReg.attachment?.file_name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleView(businessReg.id)}><Eye className="mr-1.5 h-3.5 w-3.5" />View</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDownload(businessReg.id, businessReg.attachment?.file_name)}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
                      {canEdit && (
                        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canEdit || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                  >
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                    </div>
                    <p className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload or drag a file here"}</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or PDF · up to 5MB</p>
                  </button>
                )}
              </Section>

              <ShopSummary shop={inProgressShop} />

              <div className="flex flex-wrap justify-end gap-3">
                {canEdit && (
                  <Button size="lg" onClick={() => submit.mutate(inProgressShop.id)} disabled={!businessReg || submit.isPending} className={GRADIENT}>
                    {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit for Verification
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="space-y-5">
          <ShopPreview shop={shown} />

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Profile completeness</CardTitle>
                <span className="text-sm font-semibold text-primary">{completion}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 transition-all" style={{ width: `${completion}%` }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  {item.done
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {inProgressShop ? <NextStepsCard currentIndex={stepIndex} hasDocument={!!businessReg} /> : <BenefitsCard />}
        </aside>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/** How the shop will look as a marketplace tile — updates live as the form is typed. */
function ShopPreview({ shop }) {
  const place = [shop.city, shop.district].filter(Boolean).join(", ");
  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
        <span className="text-[11px] text-muted-foreground">Marketplace card</span>
      </div>
      <div className="relative h-28">
        <ShopCover shop={shop} variant="compact" />
      </div>
      <div className="relative px-4 pb-4">
        <div className="-mt-8 flex size-16 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xl font-bold text-white shadow-md">
          {shop.name?.trim()?.charAt(0)?.toUpperCase() || <Building2 className="h-6 w-6" />}
        </div>
        <p className={cn("mt-2 truncate font-semibold", !shop.name && "text-muted-foreground")}>{shop.name || "Your shop name"}</p>
        <p className={cn("line-clamp-2 text-sm", shop.tagline ? "text-muted-foreground" : "italic text-muted-foreground/60")}>
          {shop.tagline || "A short tagline customers will see"}
        </p>
        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          <PreviewLine icon={MapPin} value={place} fallback="City, District" />
          <PreviewLine icon={Phone} value={shop.phone} fallback="Phone number" />
          {shop.whatsapp && <PreviewLine icon={MessageCircle} value={shop.whatsapp} />}
          {shop.email && <PreviewLine icon={Mail} value={shop.email} />}
          {shop.website && <PreviewLine icon={Globe} value={shop.website} />}
        </div>
      </div>
    </Card>
  );
}

function PreviewLine({ icon: Icon, value, fallback }) {
  return (
    <p className={cn("flex items-center gap-1.5 truncate", !value && "text-muted-foreground/60")}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{value || fallback}</span>
    </p>
  );
}

function BenefitsCard() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-sm">Why list with us</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NextStepsCard({ currentIndex, hasDocument }) {
  // Upload is done once a document exists; submit is done once the shop has left the editable states (step 2).
  const done = [hasDocument, currentIndex >= 2, false];
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3"><CardTitle className="text-sm">What happens next</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-5">
          {NEXT_STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative">
              <span className={cn(
                "absolute -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                done[i] ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {done[i] ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </span>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function whatsappHref(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `94${digits.slice(1)}` : digits}`;
}

function websiteHref(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const ABOUT_CLAMP = 220;

/** The shop's description as a quote card, collapsed to a preview when it's long. */
function AboutBlock({ name, text }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > ABOUT_CLAMP;
  const words = text.trim().split(/\s+/).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
      <Quote aria-hidden="true" className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 rotate-12 text-primary/[0.06]" />
      <div className="relative flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
          <Quote className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">About {name}</p>
          <p className="text-[11px] text-muted-foreground">{words} words · shown on your public shop page</p>
        </div>
      </div>
      <p className="relative mt-4 whitespace-pre-line text-[15px] leading-7 text-foreground/90">
        {long && !expanded ? `${text.slice(0, ABOUT_CLAMP).trimEnd()}…` : text}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="relative mt-2 text-sm font-medium text-primary hover:underline">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/** Read-only review of what the shop registered with — grouped like the form, contacts clickable. */
function ShopSummary({ shop }) {
  const groups = [
    {
      title: "Contact",
      icon: Phone,
      items: [
        { icon: Mail, label: "Email", value: shop.email, href: shop.email && `mailto:${shop.email}` },
        { icon: Phone, label: "Phone", value: shop.phone, href: shop.phone && `tel:${shop.phone}` },
        { icon: MessageCircle, label: "WhatsApp", value: shop.whatsapp, href: whatsappHref(shop.whatsapp), external: true },
        { icon: Globe, label: "Website", value: shop.website, href: websiteHref(shop.website), external: true },
      ],
    },
    {
      title: "Location",
      icon: MapPin,
      items: [
        { icon: MapPin, label: "Address", value: [shop.address_line_1, shop.address_line_2].filter(Boolean).join(", ") },
        { icon: Building2, label: "City", value: shop.city },
        { icon: MapPin, label: "District", value: shop.district },
        { icon: Mail, label: "Postal code", value: shop.postal_code },
      ],
    },
    {
      title: "Business registration",
      icon: FileBarChart,
      items: [
        { icon: FileText, label: "Registration No.", value: shop.business_registration_no, mono: true },
        { icon: FileText, label: "Tax ID", value: shop.tax_id, mono: true },
      ],
    },
  ];
  const filled = groups.flatMap((g) => g.items).filter((i) => i.value).length;
  const total = groups.flatMap((g) => g.items).length;

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      {/* Identity header */}
      <div className="relative isolate overflow-hidden border-b bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-violet-500/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-xl font-bold text-white shadow-md">
              {shop.name?.trim()?.charAt(0)?.toUpperCase() || <Store className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted details</p>
              <h3 className="truncate text-lg font-semibold tracking-tight">{shop.name}</h3>
              {shop.tagline && <p className="truncate text-sm text-muted-foreground">{shop.tagline}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={shop.verification_status} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {(shop.city || shop.district) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 shadow-sm">
              <MapPin className="h-3 w-3 text-primary" />{[shop.city, shop.district].filter(Boolean).join(", ")}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 shadow-sm">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />{filled}/{total} details provided
          </span>
          {shop.created_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 shadow-sm">
              <Clock className="h-3 w-3 text-primary" />Registered {new Date(shop.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE })}
            </span>
          )}
        </div>
      </div>

      <CardContent className="space-y-5 p-5 pb-6 sm:p-6">
        {shop.description && <AboutBlock name={shop.name} text={shop.description} />}

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(({ title, icon: GroupIcon, items }) => (
            <div key={title} className={cn("rounded-xl border p-4", title === "Business registration" && "md:col-span-2")}>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><GroupIcon className="h-3.5 w-3.5" /></span>
                {title}
              </p>
              <dl className={cn("grid gap-3", title === "Business registration" && "sm:grid-cols-2")}>
                {items.map(({ icon: Icon, label, value, href, external, mono }) => (
                  <div key={label} className="flex min-w-0 items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className={cn("truncate text-sm", mono && "font-mono", !value && "italic text-muted-foreground/60")}>
                        {value && href ? (
                          <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-primary hover:underline">{value}</a>
                        ) : (value || "Not provided")}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
