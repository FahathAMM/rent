"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { publicService } from "@/services/publicService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextInput, TextareaInput } from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ContactShopDialog({ open, onOpenChange, vehicle, user }) {
  const t = useTranslations("contactShop");
  // The message starts filled in, so a customer can send it as is or edit it.
  const blank = { name: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "", message: t("defaultMessage", { vehicle: vehicle.title }) };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});

  const send = useMutation({
    mutationFn: () => publicService.sendInquiry({ vehicle_slug: vehicle.slug, ...form }),
    onSuccess: () => {
      toast.success(t("sent"));
      onOpenChange(false);
      setForm(blank);
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("title", { shop: vehicle.shop?.name ?? t("theShop") })}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <TextInput label={t("name")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name?.[0]} />
          <TextInput label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone?.[0]} />
          <TextInput label={t("email")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email?.[0]} />
          <TextareaInput label={t("message")} required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} error={errors.message?.[0]} />
        </div>
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
