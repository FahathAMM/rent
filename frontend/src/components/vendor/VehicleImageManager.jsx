"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vehicleService } from "@/services/vehicleService";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Star, Trash2, ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Listing photos for one vehicle — upload, reorder, set primary, delete.
 * Separate from AttachmentPanel because vehicle images need sort_order/
 * is_primary and dedicated vendor endpoints (public disk) rather than the
 * generic Attachment model's permission-slug pattern.
 */
export function VehicleImageManager({ vehicle, open, onOpenChange }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const queryKey = ["vehicle-images", vehicle?.id];

  const { data: images, isLoading } = useQuery({
    queryKey,
    queryFn: () => vehicleService.getImages(vehicle.id).then((r) => r.data.data),
    enabled: !!vehicle,
  });

  const upload = useMutation({
    mutationFn: (file) => vehicleService.uploadImage(vehicle.id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Image uploaded"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Upload failed"),
  });

  const remove = useMutation({
    mutationFn: vehicleService.deleteImage,
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Image removed"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to remove"),
  });

  const setPrimary = useMutation({
    mutationFn: vehicleService.setPrimaryImage,
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("Primary photo updated"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed"),
  });

  const reorder = useMutation({
    mutationFn: (ids) => vehicleService.reorderImages(vehicle.id, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reorder"),
  });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => upload.mutate(file));
    e.target.value = "";
  };

  const move = (index, direction) => {
    const list = [...(images ?? [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    reorder.mutate(list.map((img) => img.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Photos — {vehicle?.title}</DialogTitle>
          <DialogDescription>JPG, PNG or WebP, max 5MB each. The starred photo is shown first to shoppers.</DialogDescription>
        </DialogHeader>

        <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handleFileChange} />
        <Button type="button" variant="outline" className="w-fit gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload Photos
        </Button>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !images?.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <p className="text-sm">No photos yet — shoppers won&apos;t be able to see this vehicle clearly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={img.id} className={cn("group relative overflow-hidden rounded-lg border", img.is_primary && "ring-2 ring-primary")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt_text ?? ""} className="aspect-video w-full object-cover" />
                {img.is_primary && (
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    <Star className="h-2.5 w-2.5 fill-current" /> Primary
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  <Button type="button" size="icon" variant="secondary" className="!h-7 !w-7" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowLeft className="!h-3.5 !w-3.5" />
                  </Button>
                  {!img.is_primary && (
                    <Button type="button" size="icon" variant="secondary" className="!h-7 !w-7" onClick={() => setPrimary.mutate(img.id)}>
                      <Star className="!h-3.5 !w-3.5" />
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="destructive" className="!h-7 !w-7" onClick={() => remove.mutate(img.id)}>
                    <Trash2 className="!h-3.5 !w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="secondary" className="!h-7 !w-7" onClick={() => move(i, 1)} disabled={i === images.length - 1}>
                    <ArrowRight className="!h-3.5 !w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
