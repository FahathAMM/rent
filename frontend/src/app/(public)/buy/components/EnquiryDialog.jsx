"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/** Ask the shop about a car. Asking again adds to the same conversation, so this always lands on it. */
export function EnquiryDialog({ open, onOpenChange, vehicle }) {
  const router = useRouter();
  // Starts filled in, so a buyer can send it as is or edit it.
  const [body, setBody] = useState(`Hi, is the ${vehicle.title} still available? When can I see it?`);
  const [error, setError] = useState(null);

  const send = useMutation({
    mutationFn: () => customerService.enquiries.create({ vehicle_slug: vehicle.slug, body: body.trim() }),
    onSuccess: (res) => {
      toast.success("Your enquiry has been sent to the shop");
      router.push(`/account/enquiries/${res.data.data.reference}`);
    },
    onError: (err) => setError(err.response?.data?.errors?.body?.[0] ?? err.response?.data?.message ?? "Could not send your enquiry"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ask {vehicle.shop?.name ?? "the shop"}</DialogTitle>
          <DialogDescription>The shop replies in your account, under Enquiries.</DialogDescription>
        </DialogHeader>
        <TextareaInput
          label="Your question"
          required
          rows={4}
          maxLength={5000}
          value={body}
          onChange={(e) => { setBody(e.target.value); setError(null); }}
          error={error}
        />
        <DialogFooter>
          <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
            {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send enquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
