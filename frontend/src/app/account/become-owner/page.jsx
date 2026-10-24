"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ownerOnboardingService } from "@/services/ownerOnboardingService";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { Loader2, UploadCloud, FileCheck2, CheckCircle2, Home } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { downloadBlob } from "@/lib/utils";

const REQUIRED_DOCS = [
  { type: "nic_front", label: "NIC — Front" },
  { type: "nic_back", label: "NIC — Back" },
  { type: "driving_licence", label: "Driving Licence" },
];

const EDITABLE_STATUSES = ["draft", "info_requested"];

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

  const breadcrumbItems = [
    { label: "Home", href: "/account/dashboard", icon: <Home className="size-4" /> },
    { label: "Become an Owner" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Become a Vehicle Owner</h1>
          <p className="text-sm text-muted-foreground">List your own vehicle on RentLanka and start earning.</p>
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      {status === "submitted" && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Your application is under review. We&apos;ll notify you once it&apos;s been checked — usually within 1–2 business days.
        </CardContent></Card>
      )}

      {status === "rejected" && (
        <Card className="border-destructive/40"><CardContent className="py-6">
          <p className="text-sm font-medium text-destructive">Application rejected</p>
          <p className="mt-1 text-sm text-muted-foreground">{profile.rejection_reason}</p>
        </CardContent></Card>
      )}

      {status === "suspended" && (
        <Card className="border-destructive/40"><CardContent className="py-6">
          <p className="text-sm font-medium text-destructive">Your owner account is suspended</p>
          <p className="mt-1 text-sm text-muted-foreground">{profile.suspension_reason}</p>
        </CardContent></Card>
      )}

      {status === "info_requested" && (
        <Card className="border-amber-400/60"><CardContent className="py-6">
          <p className="text-sm font-medium text-amber-700">More information requested</p>
          <p className="mt-1 text-sm text-muted-foreground">{profile.info_requested_note}</p>
        </CardContent></Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Details</CardTitle>
            <CardDescription>This information is used to verify your identity — it&apos;s kept private.</CardDescription>
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
                <Button type="submit" disabled={saveDraft.isPending}>
                  {saveDraft.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Details
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Required Documents</CardTitle>
            <CardDescription>Upload clear photos or scans (JPG, PNG or PDF, max 5MB each).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
            {REQUIRED_DOCS.map((doc) => {
              const verification = (profile.verifications ?? []).find((v) => v.document_type === doc.type);
              const isUploaded = !!verification;
              return (
                <div key={doc.type} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {isUploaded ? <FileCheck2 className="h-5 w-5 text-emerald-500" /> : <UploadCloud className="h-5 w-5 text-muted-foreground" />}
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
          <Button onClick={() => submit.mutate()} disabled={!allDocsUploaded || submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Application
          </Button>
        </div>
      )}
    </div>
  );
}
