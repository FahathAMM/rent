"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownerOnboardingService } from "@/services/ownerOnboardingService";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OnboardingStepper } from "@/components/account/OnboardingStepper";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import {
  Loader2, UploadCloud, FileCheck2, CheckCircle2, UserPlus,
  Clock, XCircle, AlertTriangle, Info, IdCard, MapPinned,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { downloadBlob } from "@/lib/utils";

const REQUIRED_DOCS = [
  { type: "nic_front", label: "NIC — Front" },
  { type: "nic_back", label: "NIC — Back" },
  { type: "driving_licence", label: "Driving Licence" },
];

const EDITABLE_STATUSES = ["draft", "info_requested"];
const STEPS = ["Details", "Documents", "Review"];

function StatusBanner({ icon: Icon, tone, title, body }) {
  const tones = {
    info: "bg-muted/60 text-foreground [&_svg]:text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive [&_svg]:text-destructive",
    warning: "bg-amber-50 text-amber-800 [&_svg]:text-amber-600",
  };
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="mt-0.5 text-sm opacity-90">{body}</p>}
      </div>
    </div>
  );
}

export default function BecomeOwnerPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuthStore();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadingType, setUploadingType] = useState(null);
  const fileInputRef = useRef(null);
  const pendingTypeRef = useRef(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["owner-onboarding"],
    queryFn: () => ownerOnboardingService.show().then((r) => r.data.data),
  });

  // The applicant's local session still shows role "customer" until it's
  // refreshed — approval happens out-of-band on the platform admin side.
  useEffect(() => {
    if (profile?.status === "approved" && !hasRole("vehicle-owner")) {
      refreshUser();
    }
  }, [profile?.status, hasRole, refreshUser]);

  const saveDraft = useMutation({
    mutationFn: ownerOnboardingService.saveDraft,
    onSuccess: (res) => {
      qc.setQueryData(["owner-onboarding"], res.data.data);
      toast.success("Application saved");
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const upload = useMutation({
    mutationFn: ({ documentType, file }) => ownerOnboardingService.uploadDocument(documentType, file),
    onMutate: ({ documentType }) => setUploadingType(documentType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-onboarding"] });
      toast.success("Document uploaded");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Upload failed"),
    onSettled: () => setUploadingType(null),
  });

  const submit = useMutation({
    mutationFn: ownerOnboardingService.submit,
    onSuccess: (res) => {
      qc.setQueryData(["owner-onboarding"], res.data.data);
      toast.success("Application submitted for review");
    },
    onError: (err) => toast.error(err.response?.data?.errors?.documents?.[0] ?? err.response?.data?.message ?? "Could not submit"),
  });

  if (hasRole("vehicle-owner")) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-semibold">You&apos;re already a vehicle owner</p>
          <p className="max-w-sm text-sm text-muted-foreground">Manage your listings from your vendor dashboard.</p>
          <Button asChild><Link href="/vendor/dashboard">Go to vendor dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const data = form ?? profile;
  const status = profile?.status;
  const uploadedTypes = new Set((profile?.verifications ?? []).map((v) => v.document_type));
  const canEdit = !profile || EDITABLE_STATUSES.includes(status);
  const allDocsUploaded = REQUIRED_DOCS.every((d) => uploadedTypes.has(d.type));
  const stepIndex = !profile ? 0 : (canEdit ? 1 : 2);

  const fi = (k) => (e) => setForm((p) => ({ ...(p ?? profile ?? {}), [k]: e.target.value }));

  const handleSave = (e) => {
    e.preventDefault();
    setErrors({});
    saveDraft.mutate({
      full_name: data?.full_name ?? "",
      nic_number: data?.nic_number ?? "",
      date_of_birth: data?.date_of_birth ? String(data.date_of_birth).slice(0, 10) : undefined,
      contact_phone: data?.contact_phone ?? "",
      alt_phone: data?.alt_phone ?? undefined,
      address_line_1: data?.address_line_1 ?? undefined,
      address_line_2: data?.address_line_2 ?? undefined,
      city: data?.city ?? undefined,
      district: data?.district ?? undefined,
      postal_code: data?.postal_code ?? undefined,
    });
  };

  const triggerUpload = (type) => {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    const documentType = pendingTypeRef.current;
    if (file && documentType) upload.mutate({ documentType, file });
    e.target.value = "";
  };

  const handleDownload = async (verificationId, filename) => {
    try {
      const res = await ownerOnboardingService.downloadDocument(verificationId);
      downloadBlob(res.data, filename);
    } catch {
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-3" />
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Become a Vehicle Owner</h1>
              <p className="mt-1 text-sm text-muted-foreground">List your own vehicle and start earning.</p>
            </div>
          </div>
          {status && <StatusBadge status={status} />}
        </div>
        <div className="relative mt-6">
          <OnboardingStepper steps={STEPS} currentIndex={stepIndex} />
        </div>
      </div>

      {status === "submitted" && (
        <StatusBanner icon={Clock} tone="info" title="Your application is under review"
          body="We'll notify you once it's been checked — usually within 1–2 business days." />
      )}

      {status === "rejected" && (
        <StatusBanner icon={XCircle} tone="destructive" title="Application rejected" body={profile.rejection_reason} />
      )}

      {status === "suspended" && (
        <StatusBanner icon={AlertTriangle} tone="destructive" title="Your owner account is suspended" body={profile.suspension_reason} />
      )}

      {status === "info_requested" && (
        <StatusBanner icon={Info} tone="warning" title="More information requested" body={profile.info_requested_note} />
      )}

      {canEdit && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><IdCard className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Your Details</CardTitle>
              <CardDescription>This information is used to verify your identity — it&apos;s kept private.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <ValidationError errors={errors} />
              <Fieldset legend="Identity" grid={2}>
                <TextInput label="Full Name" value={data?.full_name ?? ""} onChange={fi("full_name")} required error={errors.full_name?.[0]} />
                <TextInput label="NIC Number" value={data?.nic_number ?? ""} onChange={fi("nic_number")} required error={errors.nic_number?.[0]} />
                <TextInput label="Date of Birth" type="date" value={data?.date_of_birth ? String(data.date_of_birth).slice(0, 10) : ""} onChange={fi("date_of_birth")} error={errors.date_of_birth?.[0]} />
                <TextInput label="Contact Phone" value={data?.contact_phone ?? ""} onChange={fi("contact_phone")} required error={errors.contact_phone?.[0]} />
              </Fieldset>
              <Fieldset legend="Address" grid={2}>
                <TextInput label="Address Line 1" value={data?.address_line_1 ?? ""} onChange={fi("address_line_1")} error={errors.address_line_1?.[0]} />
                <TextInput label="City" value={data?.city ?? ""} onChange={fi("city")} error={errors.city?.[0]} />
                <TextInput label="District" value={data?.district ?? ""} onChange={fi("district")} error={errors.district?.[0]} />
                <TextInput label="Postal Code" value={data?.postal_code ?? ""} onChange={fi("postal_code")} error={errors.postal_code?.[0]} />
              </Fieldset>
              <div className="flex justify-end">
                <Button type="submit" disabled={saveDraft.isPending} className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
                  {saveDraft.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Details
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {profile && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPinned className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Required Documents</CardTitle>
              <CardDescription>Upload clear photos or scans (JPG, PNG or PDF, max 5MB each).</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
            {REQUIRED_DOCS.map((doc) => {
              const verification = (profile.verifications ?? []).find((v) => v.document_type === doc.type);
              const isUploaded = !!verification;
              return (
                <div key={doc.type} className="flex items-center justify-between rounded-xl border p-3.5 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isUploaded ? "bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      {isUploaded ? <FileCheck2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.label}</p>
                      {isUploaded && <p className="text-xs text-muted-foreground">{verification.attachment?.file_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isUploaded && (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDownload(verification.id, verification.attachment?.file_name)}>
                        View
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant={isUploaded ? "outline" : "default"}
                        size="sm"
                        className={isUploaded ? "" : "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90"}
                        disabled={uploadingType === doc.type}
                        onClick={() => triggerUpload(doc.type)}
                      >
                        {uploadingType === doc.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isUploaded ? "Replace" : "Upload")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {canEdit && profile && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => submit.mutate()} disabled={!allDocsUploaded || submit.isPending} className="bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 hover:opacity-90">
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </div>
      )}
    </div>
  );
}
