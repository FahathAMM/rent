"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { SignaturePad } from "@/app/vendor/bookings/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { CheckboxInput, TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "lease", label: "Lease" },
  { value: "other", label: "Other" },
];

/**
 * Record the deal once the buyer has paid at the shop. Pass `enquiry` when it
 * came from one: the buyer's name and phone are filled in, and they get their
 * copy of the agreement in their account.
 */
export function RecordSaleDialog({ vehicle, enquiry, onClose, onRecorded }) {
  const [form, setForm] = useState({
    buyer_name: enquiry?.customer?.name ?? "",
    buyer_phone: enquiry?.customer?.phone ?? "",
    buyer_nic: "",
    buyer_address: "",
    sale_price: vehicle?.sale?.price ?? vehicle?.price ?? "",
    payment_method: "cash",
  });
  const [signature, setSignature] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const { data: terms, isLoading } = useQuery({
    queryKey: ["vendor-sale-terms"],
    queryFn: () => vendorService.sales.terms.get().then((r) => r.data.data.terms),
  });

  const record = useMutation({
    mutationFn: () => vendorService.sales.recordSale(vehicle.id, {
      ...form,
      enquiry_reference: enquiry?.reference,
      customer_signature: signature || undefined,
      terms_accepted: termsAccepted,
    }),
    onSuccess: (res) => { toast.success(`Sale recorded — ${res.data.data.reference}`); onRecorded(res.data.data); },
    onError: (err) => {
      setErrors(err.response?.data?.errors ?? {});
      if (err.response?.status !== 422) toast.error(err.response?.data?.message ?? "Could not record the sale");
    },
  });

  return (
    <Dialog open={!!vehicle} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record sale: {vehicle?.title}</DialogTitle>
          <DialogDescription>This can&apos;t be undone. The car leaves the Buy page and every other enquiry on it is closed.</DialogDescription>
        </DialogHeader>

        <ValidationError errors={errors} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput label="Buyer's name" required value={form.buyer_name} onChange={set("buyer_name")} error={errors.buyer_name?.[0]} />
          <TextInput label="Buyer's phone" required value={form.buyer_phone} onChange={set("buyer_phone")} error={errors.buyer_phone?.[0]} />
          <TextInput label="Buyer's NIC" required value={form.buyer_nic} onChange={set("buyer_nic")} error={errors.buyer_nic?.[0]} />
          <TextInput label="Sale price (LKR)" type="number" min="1" step="0.01" required value={form.sale_price} onChange={set("sale_price")} error={errors.sale_price?.[0]} />
          <SelectInput label="Paid by" required value={form.payment_method} onChange={(v) => setForm({ ...form, payment_method: v })} options={PAYMENT_METHODS} error={errors.payment_method?.[0]} />
        </div>
        <TextareaInput label="Buyer's address" rows={2} value={form.buyer_address} onChange={set("buyer_address")} error={errors.buyer_address?.[0]} />

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : terms ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Sale terms: the buyer reads and signs</p>
            <div className="rich-text max-h-48 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: terms }} />
            <CheckboxInput id="sale-terms-accepted" label="The buyer agrees to these terms" checked={termsAccepted} onChange={(v) => setTermsAccepted(!!v)} error={errors.terms_accepted?.[0]} />
            <SignaturePad onChange={setSignature} />
            {errors.customer_signature?.[0] && <p className="text-xs text-destructive">{errors.customer_signature[0]}</p>}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">You have no sale terms, so no signature is needed. Add them under Sales → Sale Terms.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => record.mutate()} disabled={record.isPending || isLoading || (!!terms && (!termsAccepted || !signature))}>
            {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
