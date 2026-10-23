"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "@/components/Elements/Modal";
import { Button } from "@/components/ui/button";
import { TextInput, TextareaInput, ValidationError } from "@/components/forms/FormField";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Emails a quotation/invoice PDF to a customer — shared between both detail
 * pages since the backend endpoints (POST .../email) are symmetric.
 */
export function EmailPdfModal({ open, onOpenChange, docLabel, docNumber, defaultTo, onSend, onSuccess, hideCloseButton = false }) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});

  // Re-seed the recipient whenever the modal is (re)opened for a document.
  useEffect(() => {
    if (open) {
      setTo(defaultTo ?? "");
      setCc("");
      setMessage("");
      setErrors({});
    }
  }, [open, defaultTo]);

  const send = useMutation({
    mutationFn: onSend,
    onSuccess: (res) => {
      toast.success(res?.data?.message ?? `${docLabel} emailed`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => setErrors(err.response?.data?.errors ?? {}),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    const ccList = cc.split(",").map((s) => s.trim()).filter(Boolean);
    send.mutate({ to, cc: ccList, message: message || undefined });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Email ${docLabel} ${docNumber}`} size="md" headerBorder hideCloseButton={hideCloseButton}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ValidationError errors={errors} />
        <TextInput
          label="To"
          type="email"
          placeholder="customer@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          error={errors.to?.[0]}
        />
        <TextInput
          label="CC (optional)"
          placeholder="comma-separated emails"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          error={errors.cc?.[0]}
        />
        <TextareaInput
          label="Message (optional)"
          placeholder={`Please find attached your ${docLabel.toLowerCase()} ${docNumber}.`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          error={errors.message?.[0]}
        />

        <div className="sticky bottom-0 z-10 -mx-6 flex justify-end items-center gap-2 border-t bg-background px-6 py-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
