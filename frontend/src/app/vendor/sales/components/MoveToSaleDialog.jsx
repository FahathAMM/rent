"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SaleFields, emptySale, salePayload } from "./SaleFields";

/** Sell a rental car: it leaves the rental listings and goes back through review as a sale listing. */
export function MoveToSaleDialog({ vehicle, onClose, onMoved }) {
  const [sale, setSale] = useState(emptySale);
  const [errors, setErrors] = useState({});

  const move = useMutation({
    mutationFn: () => vendorService.sales.moveToSale(vehicle.id, salePayload(sale)),
    onSuccess: (res) => { toast.success(res.data.message); onMoved(); },
    onError: (err) => {
      const errs = err.response?.data?.errors ?? {};
      setErrors(errs);
      if (errs.listing_type) toast.error(errs.listing_type[0]);
      else if (err.response?.status !== 422) toast.error(err.response?.data?.message ?? "Could not move this vehicle");
    },
  });

  return (
    <Dialog open={!!vehicle} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move “{vehicle?.title}” to sale</DialogTitle>
          <DialogDescription>
            It stops being rentable and goes back through review. Its booking history stays. You can&apos;t do this while it has open bookings.
          </DialogDescription>
        </DialogHeader>
        <SaleFields sale={sale} onChange={setSale} errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => move.mutate()} disabled={move.isPending}>
            {move.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move to sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
