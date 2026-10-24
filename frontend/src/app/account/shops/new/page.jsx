"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopOnboardingService } from "@/services/shopOnboardingService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatusBanner } from "@/components/shared/StatusBanner";
import { OnboardingStepper } from "@/components/account/OnboardingStepper";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import {
  Loader2, UploadCloud, FileCheck2, Store, Clock, XCircle, Building2, FileBarChart,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { downloadBlob } from "@/lib/utils";

const defaultForm = {
  name: "", description: "", tagline: "", email: "", phone: "", whatsapp: "", website: "",
  address_line_1: "", address_line_2: "", city: "", district: "", postal_code: "",
  business_registration_no: "", tax_id: "",
};

const EDITABLE_VERIFICATION_STATES = ["unverified", "rejected"];
const UNVERIFIED_STATES = ["unverified", "pending", "rejected"];
const STEPS = ["Details", "Documents", "Review"];

export default function NewShopPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: shops, isLoading } = useQuery({
    queryKey: ["onboarding-shops"],
    queryFn: () => shopOnboardingService.index().then((r) => r.data.data),
  });

  const inProgressShop = (shops ?? []).find((s) => UNVERIFIED_STATES.includes(s.verification_status));

  const register = useMutation({
    mutationFn: shopOnboardingService.register,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-shops"] });
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
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Store className="h-10 w-10 text-emerald-500" />
          <p className="font-semibold">You already have a verified shop</p>
          <Button asChild><Link href="/vendor/dashboard">Go to vendor dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const businessReg = inProgressShop?.verifications?.find((v) => v.document_type === "business_registration");
  const canEdit = !inProgressShop || EDITABLE_VERIFICATION_STATES.includes(inProgressShop.verification_status);
  const stepIndex = !inProgressShop ? 0 : (canEdit ? 1 : 2);

  return (
    <div className="space-y-5">
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
              <h1 className="text-2xl font-semibold tracking-tight">Register a Rental Shop</h1>
              <p className="mt-1 text-sm text-muted-foreground">Run a business with multiple vehicles and staff.</p>
            </div>
          </div>
          {inProgressShop && <StatusBadge status={inProgressShop.verification_status} />}
        </div>
        <div className="relative mt-6">
          <OnboardingStepper steps={STEPS} currentIndex={stepIndex} />
        </div>
      </div>

      {inProgressShop?.verification_status === "pending" && (
        <StatusBanner icon={Clock} tone="info" title="Awaiting platform review" body="Your shop is submitted and awaiting platform review." />
      )}

      {inProgressShop?.verification_status === "rejected" && (
        <StatusBanner icon={XCircle} tone="destructive" title="Verification rejected" body={inProgressShop.suspended_reason} />
      )}

      {!inProgressShop && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
            <CardTitle className="text-base">Shop Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <ValidationError errors={errors} />
              <Fieldset legend="Identity" grid={2}>
                <TextInput label="Shop Name" value={form.name} onChange={fi("name")} required error={errors.name?.[0]} />
                <TextInput label="Tagline" value={form.tagline} onChange={fi("tagline")} error={errors.tagline?.[0]} />
                <TextInput label="Email" type="email" value={form.email} onChange={fi("email")} error={errors.email?.[0]} />
                <TextInput label="Phone" value={form.phone} onChange={fi("phone")} error={errors.phone?.[0]} />
                <TextInput label="WhatsApp" value={form.whatsapp} onChange={fi("whatsapp")} error={errors.whatsapp?.[0]} />
                <TextInput label="Website" value={form.website} onChange={fi("website")} error={errors.website?.[0]} />
              </Fieldset>
              <Fieldset legend="Address" grid={2}>
                <TextInput label="Address Line 1" value={form.address_line_1} onChange={fi("address_line_1")} error={errors.address_line_1?.[0]} />
                <TextInput label="City" value={form.city} onChange={fi("city")} error={errors.city?.[0]} />
                <TextInput label="District" value={form.district} onChange={fi("district")} error={errors.district?.[0]} />
                <TextInput label="Postal Code" value={form.postal_code} onChange={fi("postal_code")} error={errors.postal_code?.[0]} />
              </Fieldset>
              <Fieldset legend="Registration" grid={2}>
                <TextInput label="Business Registration No." value={form.business_registration_no} onChange={fi("business_registration_no")} error={errors.business_registration_no?.[0]} />
                <TextInput label="Tax ID" value={form.tax_id} onChange={fi("tax_id")} error={errors.tax_id?.[0]} />
              </Fieldset>
              <Fieldset legend="Description" grid={1}>
                <TextareaInput label="Description" value={form.description} onChange={fi("description")} error={errors.description?.[0]} />
              </Fieldset>
              <div className="flex justify-end">
                <Button type="submit" disabled={register.isPending} className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                  {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register Shop
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {inProgressShop && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileBarChart className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Required Document</CardTitle>
              <CardDescription>Upload your business registration certificate (JPG, PNG or PDF, max 5MB).</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
            <div className="flex items-center justify-between rounded-xl border p-3.5 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${businessReg ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {businessReg ? <FileCheck2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Business Registration</p>
                  {businessReg && <p className="text-xs text-muted-foreground">{businessReg.attachment?.file_name}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {businessReg && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleDownload(businessReg.id, businessReg.attachment?.file_name)}>View</Button>
                )}
                {canEdit && (
                  <Button
                    type="button"
                    variant={businessReg ? "outline" : "default"}
                    size="sm"
                    className={businessReg ? "" : "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90"}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (businessReg ? "Replace" : "Upload")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {inProgressShop && canEdit && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => submit.mutate(inProgressShop.id)} disabled={!businessReg || submit.isPending} className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Verification
          </Button>
        </div>
      )}
    </div>
  );
}
