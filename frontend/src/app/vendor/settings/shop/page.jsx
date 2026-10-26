"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorShopProfileService } from "@/services/vendorShopProfileService";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Fieldset } from "@/components/forms/Fieldset";
import { Loader2, Home, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function ShopProfileSettingsPage() {
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  const { data: shop, isLoading } = useQuery({
    queryKey: ["vendor-shop-profile"],
    queryFn: () => vendorShopProfileService.show().then((r) => r.data.data),
  });

  useEffect(() => {
    if (shop && !form) setForm(shop);
  }, [shop, form]);

  const save = useMutation({
    mutationFn: (payload) => vendorShopProfileService.update(payload),
    onSuccess: (res) => {
      qc.setQueryData(["vendor-shop-profile"], res.data.data);
      toast.success("Shop profile updated");
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const fi = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    save.mutate(form);
  };

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Shop Profile" },
  ];

  if (isLoading || !form) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const canEdit = can("vendor-settings-shop-edit");

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-base">Shop Details</CardTitle>
            <CardDescription>Name, contact info and address shown on your public shop page.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ValidationError errors={errors} />

            <Fieldset legend="Identity" grid={2}>
              <TextInput label="Shop Name" value={form.name ?? ""} onChange={fi("name")} required disabled={!canEdit} error={errors.name?.[0]} />
              <TextInput label="Tagline" value={form.tagline ?? ""} onChange={fi("tagline")} disabled={!canEdit} error={errors.tagline?.[0]} />
              <TextInput label="Email" type="email" value={form.email ?? ""} onChange={fi("email")} disabled={!canEdit} error={errors.email?.[0]} />
              <TextInput label="Phone" value={form.phone ?? ""} onChange={fi("phone")} disabled={!canEdit} error={errors.phone?.[0]} />
              <TextInput label="WhatsApp" value={form.whatsapp ?? ""} onChange={fi("whatsapp")} disabled={!canEdit} error={errors.whatsapp?.[0]} />
              <TextInput label="Website" value={form.website ?? ""} onChange={fi("website")} disabled={!canEdit} error={errors.website?.[0]} />
            </Fieldset>

            <Fieldset legend="Address" grid={2}>
              <TextInput label="Address Line 1" value={form.address_line_1 ?? ""} onChange={fi("address_line_1")} disabled={!canEdit} error={errors.address_line_1?.[0]} />
              <TextInput label="Address Line 2" value={form.address_line_2 ?? ""} onChange={fi("address_line_2")} disabled={!canEdit} error={errors.address_line_2?.[0]} />
              <TextInput label="City" value={form.city ?? ""} onChange={fi("city")} disabled={!canEdit} error={errors.city?.[0]} />
              <TextInput label="District" value={form.district ?? ""} onChange={fi("district")} disabled={!canEdit} error={errors.district?.[0]} />
              <TextInput label="Postal Code" value={form.postal_code ?? ""} onChange={fi("postal_code")} disabled={!canEdit} error={errors.postal_code?.[0]} />
            </Fieldset>

            <Fieldset legend="Description & Policies" grid={1}>
              <TextareaInput label="Description" rows={4} value={form.description ?? ""} onChange={fi("description")} disabled={!canEdit} error={errors.description?.[0]} />
              <TextareaInput label="Pickup Instructions" rows={2} value={form.pickup_instructions ?? ""} onChange={fi("pickup_instructions")} disabled={!canEdit} error={errors.pickup_instructions?.[0]} />
              <TextareaInput label="Return Instructions" rows={2} value={form.return_instructions ?? ""} onChange={fi("return_instructions")} disabled={!canEdit} error={errors.return_instructions?.[0]} />
              <TextareaInput label="Rental Terms" rows={3} value={form.rental_terms ?? ""} onChange={fi("rental_terms")} disabled={!canEdit} error={errors.rental_terms?.[0]} />
              <TextareaInput label="Cancellation Policy" rows={3} value={form.cancellation_policy ?? ""} onChange={fi("cancellation_policy")} disabled={!canEdit} error={errors.cancellation_policy?.[0]} />
            </Fieldset>

            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </HomePageWrapper>
  );
}
