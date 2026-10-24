"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2 } from "lucide-react";

/**
 * A confirm dialog that also collects a required free-text reason — for
 * admin actions (reject / suspend / request-info) whose backend validation
 * requires a non-empty `reason` string. ConfirmDialog has no input field,
 * so this is a separate component rather than overloading it.
 */
export function ReasonDialog({ open, onOpenChange, title, description, onConfirm, loading, confirmText = "Confirm", placeholder = "Explain why..." }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <TextareaInput
          label="Reason"
          required
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(""); }}
          placeholder={placeholder}
          error={error}
          rows={4}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
