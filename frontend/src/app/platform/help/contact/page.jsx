"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformService } from "@/services/platformService";
import { PageWrapper } from "@/components/shared/PageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { ExternalLink, Home, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const breadcrumbItems = [
  { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
  { label: "Contact Details" },
];

const emptyForm = { support_email: "", support_phone: "", support_whatsapp: "", support_hours: "", support_address: "" };

export default function PlatformContactDetailsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const { data: details, isLoading } = useQuery({
    queryKey: ["platform-support-contact"],
    queryFn: () => platformService.details.get().then((r) => r.data.data),
  });

  useEffect(() => {
    if (!details) return;
    setForm(Object.fromEntries(Object.keys(emptyForm).map((key) => [key, details[key] ?? ""])));
  }, [details]);

  const save = useMutation({
    mutationFn: () => platformService.supportContact.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-support-contact"] });
      qc.invalidateQueries({ queryKey: ["platform-details"] });
      toast.success("Contact details saved");
    },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.networkError ?? err.response?.data?.message ?? "Could not save");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate();
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
    error: errors[key]?.[0],
  });

  return (
    <PageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader
        title="Contact Details"
        description="Shown on the public Contact us page. Leave a field blank to hide it."
        action={
          <a href="/contact" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Support email" type="email" maxLength={255} placeholder="support@yourdomain.com" {...field("support_email")} />
            <TextInput label="Phone" maxLength={30} placeholder="+94 11 234 5678" {...field("support_phone")} />
            <div>
              <TextInput label="WhatsApp" maxLength={30} placeholder="+94 77 123 4567" {...field("support_whatsapp")} />
              <p className="mt-1 text-xs text-muted-foreground">Include the country code, so the WhatsApp link works.</p>
            </div>
            <TextInput label="Support hours" maxLength={255} placeholder="Mon to Sat, 9:00 AM to 6:00 PM" {...field("support_hours")} />
          </div>
          <TextareaInput label="Address" rows={3} maxLength={500} {...field("support_address")} />

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={save.isPending} className="gap-1.5">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </form>
      )}
    </PageWrapper>
  );
}
