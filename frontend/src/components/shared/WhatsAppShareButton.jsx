"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ImageOff,
  Check,
  Store,
  FileText,
  ExternalLink,
  ClipboardCopy,
  Copy,
} from "lucide-react";

export function WhatsAppIcon({ className = "size-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.31z" />
    </svg>
  );
}

/**
 * Extracts all image URLs from vehicle
 */
export function getVehicleImages(vehicle) {
  if (!vehicle) return [];
  const list = [];
  if (Array.isArray(vehicle.images)) {
    for (const img of vehicle.images) {
      if (img?.url) {
        list.push(img.url);
      } else if (img?.attachment?.file_path) {
        list.push(`/storage/${img.attachment.file_path}`);
      } else if (img?.file_path) {
        list.push(`/storage/${img.file_path}`);
      }
    }
  }
  if (list.length === 0 && vehicle.cover_image) {
    const cov = vehicle.cover_image;
    list.push(cov.startsWith("http") ? cov : `/storage/${cov}`);
  }
  return list;
}

const formatCurrency = (amount) => {
  if (amount == null || amount === "" || isNaN(Number(amount))) return null;
  return `LKR ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const cleanLabel = (val) => {
  if (!val) return null;
  return String(val)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Builds detailed, comprehensive formatted text for WhatsApp channel / status / group post
 */
export function buildDetailedVehicleWhatsAppText(vehicle) {
  if (!vehicle) return "";

  const title =
    vehicle.title || `${vehicle.make || ""} ${vehicle.model || ""}`.trim() || "Vehicle";
  const categoryName = vehicle.category?.name || null;
  const brandName = vehicle.brand?.name || vehicle.make || null;
  const modelName = vehicle.vehicle_model?.name || vehicle.model || null;
  const year = vehicle.year || null;
  const colour = vehicle.vehicle_colour?.name || vehicle.colour || null;

  // Shop details
  const shopName = vehicle.shop?.name || "Rental Shop";
  const location = [vehicle.shop?.city, vehicle.shop?.district].filter(Boolean).join(", ");
  const isVerified = vehicle.shop?.verification_status === "verified" || vehicle.shop?.is_verified;
  const contactPhone =
    vehicle.shop?.owner?.phone || vehicle.shop?.phone || "";

  // Pricing
  const pricing = vehicle.pricing || {};
  const dailyRate = formatCurrency(pricing.daily_rate);
  const weeklyRate = formatCurrency(pricing.weekly_rate);
  const monthlyRate = formatCurrency(pricing.monthly_rate);
  const deposit = formatCurrency(pricing.security_deposit);
  const depositMethod = pricing.deposit_method ? cleanLabel(pricing.deposit_method) : null;
  const driverRate = pricing.driver_rate_per_day != null
    ? `${formatCurrency(pricing.driver_rate_per_day)}/day`
    : null;
  const mileage = pricing.mileage_allowance_per_day_km
    ? `${pricing.mileage_allowance_per_day_km} km / day`
    : "Unlimited Mileage";
  const minDays = pricing.min_rental_days ? `${pricing.min_rental_days} day(s)` : null;
  const deliveryAvailable = pricing.delivery_available;

  // Specs
  const transmission = cleanLabel(vehicle.transmission);
  const fuelType = cleanLabel(vehicle.fuel_type);
  const seats = vehicle.seating_capacity ? `${vehicle.seating_capacity} Seats` : null;
  const luggage = vehicle.luggage_capacity ? `${vehicle.luggage_capacity} Luggage Bags` : null;
  const engine = vehicle.engine_capacity_cc ? `${vehicle.engine_capacity_cc} cc` : null;
  const ac = vehicle.air_conditioned ? "Air Conditioned (A/C)" : null;
  const doors = vehicle.doors ? `${vehicle.doors} Doors` : null;

  // Features array
  const featuresList = Array.isArray(vehicle.features) && vehicle.features.length > 0
    ? vehicle.features.slice(0, 6).join(" · ")
    : null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = vehicle.slug ? `${origin}/vehicles/${vehicle.slug}` : `${origin}/browse`;

  const lines = [
    `✨ *NEW VEHICLE LISTED FOR RENT!* ✨`,
    ``,
    `🚘 *${title.toUpperCase()}*`,
    [brandName, modelName, year].filter(Boolean).length > 0
      ? `📌 *Model:* ${[brandName, modelName, year].filter(Boolean).join(" · ")}`
      : null,
    categoryName || colour
      ? `🏷️ *Category:* ${[categoryName, colour ? `Colour: ${colour}` : null].filter(Boolean).join(" | ")}`
      : null,
    ``,
    `💰 *RENTAL RATES:*`,
    dailyRate ? `• Daily Rate: *${dailyRate}* / day` : null,
    weeklyRate ? `• Weekly Rate: *${weeklyRate}* / week` : null,
    monthlyRate ? `• Monthly Rate: *${monthlyRate}* / month` : null,
    deposit ? `• Security Deposit: *${deposit}* ${depositMethod ? `(${depositMethod})` : "(Refundable)"}` : null,
    ``,
    `⚙️ *SPECIFICATIONS:*`,
    transmission ? `• Transmission: *${transmission}*` : null,
    fuelType ? `• Fuel Type: *${fuelType}*` : null,
    seats ? `• Seating Capacity: *${seats}*` : null,
    ac ? `• Climate Control: *${ac}*` : null,
    engine ? `• Engine: *${engine}*` : null,
    luggage || doors ? `• Capacity: *${[luggage, doors].filter(Boolean).join(" | ")}*` : null,
    ``,
    featuresList ? `⭐ *KEY FEATURES:*\n• ${featuresList}` : null,
    featuresList ? `` : null,
    `📋 *RENTAL TERMS:*`,
    `• Mileage: *${mileage}*`,
    driverRate ? `• Driver Option: *Available (${driverRate}) or Self-Drive*` : `• Driver Option: *Self-Drive*`,
    minDays ? `• Minimum Rental: *${minDays}*` : null,
    deliveryAvailable ? `• Delivery: *Available to your location*` : null,
    ``,
    `🏢 *RENTAL COMPANY:*`,
    `• Shop: *${shopName}* ${isVerified ? "🛡️ (Verified Partner)" : ""}`,
    location ? `• Location: *${location}*` : null,
    contactPhone ? `• Inquiries / Call: *${contactPhone}*` : null,
    ``,
    `🔗 *VIEW PHOTOS & INSTANT BOOKING:*`,
    publicUrl,
    ``,
    `_Instant online booking & verified vehicles on LankaLane._`,
  ].filter((line) => line !== null);

  return lines.join("\n");
}

/**
 * Copies BOTH image AND text description together to the system clipboard
 */
export async function copyBothImageAndDescription(imageUrl, text) {
  try {
    if (!imageUrl) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }

    // 1. Fetch image and convert to data URI / blob
    let dataUrl = imageUrl;
    let imageBlob = null;

    try {
      const response = await fetch(imageUrl);
      imageBlob = await response.blob();
      dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(imageBlob);
      });
    } catch {
      dataUrl = imageUrl;
    }

    // 2. Method A: DOM Selection Copy (places CF_DIB image + text/plain + text/html onto OS clipboard)
    try {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("contenteditable", "true");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.style.opacity = "0";
      wrapper.style.pointerEvents = "none";
      wrapper.style.zIndex = "-1";

      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "Vehicle";
      img.style.maxWidth = "800px";
      img.style.display = "block";
      img.style.marginBottom = "14px";
      wrapper.appendChild(img);

      const textEl = document.createElement("div");
      textEl.style.whiteSpace = "pre-wrap";
      textEl.style.fontFamily = "sans-serif";
      textEl.innerText = text;
      wrapper.appendChild(textEl);

      document.body.appendChild(wrapper);

      const range = document.createRange();
      range.selectNodeContents(wrapper);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const ok = document.execCommand("copy");
      selection.removeAllRanges();
      document.body.removeChild(wrapper);

      if (ok) {
        return { success: true };
      }
    } catch (e) {
      console.warn("DOM copy fallback:", e);
    }

    // 3. Method B: Async Clipboard API with text/html (contains <img> and text) + text/plain
    if (typeof ClipboardItem !== "undefined") {
      try {
        const safeTextHtml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
        const htmlContent = `<div><img src="${dataUrl}" style="max-width:800px;display:block;margin-bottom:12px;" /><br/><div style="font-family:sans-serif;white-space:pre-wrap;">${safeTextHtml}</div></div>`;

        const htmlBlob = new Blob([htmlContent], { type: "text/html" });
        const textBlob = new Blob([text], { type: "text/plain" });

        const item = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([item]);
        return { success: true };
      } catch (err) {
        console.warn("Async clipboard write failed:", err);
      }
    }

    // Fallback: write text to clipboard
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (err) {
    console.error("Failed to copy both:", err);
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}

/**
 * Clean, user-friendly WhatsApp Share Dialog without duplicates or save buttons
 */
export function WhatsAppShareDialog({ vehicle, open, onOpenChange }) {
  const [copiedBoth, setCopiedBoth] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const images = getVehicleImages(vehicle);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const activeImage = images[selectedImgIndex] || images[0] || null;

  const [message, setMessage] = useState("");

  useEffect(() => {
    if (vehicle) {
      setMessage(buildDetailedVehicleWhatsAppText(vehicle));
    }
  }, [vehicle]);

  /**
   * SINGLE BUTTON 1: Copies BOTH image & description together!
   */
  const handleCopyBoth = async () => {
    const res = await copyBothImageAndDescription(activeImage, message);
    if (res.success) {
      setCopiedBoth(true);
      toast.success("Both Image & Description copied! Press Ctrl+V in WhatsApp to paste.", {
        duration: 4000,
      });
      setTimeout(() => setCopiedBoth(false), 3000);
    } else {
      toast.error("Failed to copy to clipboard");
    }
  };

  /**
   * Helper to fetch active image as File
   */
  const getActiveImageFile = async () => {
    if (!activeImage) return null;
    const response = await fetch(activeImage);
    const blob = await response.blob();
    const safeName = (vehicle?.title || "vehicle").toLowerCase().replace(/[^a-z0-9]/g, "-");
    return new File([blob], `${safeName}.jpg`, { type: blob.type || "image/jpeg" });
  };

  /**
   * SINGLE BUTTON 2: 1-Click Share All Details + Image directly to WhatsApp
   */
  const handleShareAllToWhatsApp = async () => {
    // 1. Auto-copy both to clipboard in background
    try {
      copyBothImageAndDescription(activeImage, message);
    } catch {}

    // 2. Try native share with image file if supported
    if (typeof navigator !== "undefined" && navigator.share && activeImage) {
      try {
        const file = await getActiveImageFile();
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: vehicle?.title || "Vehicle on LankaLane",
            text: message,
            files: [file],
          });
          toast.success("Shared image & details to WhatsApp!");
          return;
        }
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    // 3. Fallback: Open WhatsApp with full pre-filled text & link
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp! Image & description are also copied to your clipboard (Ctrl+V).", {
      duration: 5000,
    });
  };

  const handleCopyTextOnly = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedText(true);
      toast.success("Caption text copied to clipboard!");
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast.error("Failed to copy text");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0 sm:max-w-2xl">
        {/* Clean Header */}
        <div className="flex items-center gap-3 border-b bg-emerald-700 px-5 py-4 text-white">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
            <WhatsAppIcon className="size-6 fill-current" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-white">
              Share Vehicle to WhatsApp Channel
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-100">
              Copy both photo and description, or share directly to your Channel in 1 click
            </DialogDescription>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {/* ── Vehicle Photo (Clean, No Save Button) ─────────────────── */}
          <div className="overflow-hidden rounded-2xl border bg-slate-900 shadow-sm">
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeImage}
                  alt={vehicle?.title || "Vehicle"}
                  className="h-full w-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageOff className="size-8" />
                  <span className="text-xs">No vehicle image uploaded</span>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Badges */}
              <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                {vehicle?.pricing?.daily_rate != null && (
                  <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                    {formatCurrency(vehicle.pricing.daily_rate)} / day
                  </span>
                )}
                {vehicle?.category?.name && (
                  <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                    {vehicle.category.name}
                  </span>
                )}
              </div>

              {/* Vehicle Title & Shop Info at bottom */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                <div>
                  <h3 className="text-base font-bold tracking-tight drop-shadow-md sm:text-lg">
                    {vehicle?.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-200">
                    <span className="flex items-center gap-1 font-medium">
                      <Store className="size-3 text-emerald-400" />
                      {vehicle?.shop?.name || "Shop"}
                    </span>
                    {(vehicle?.shop?.city || vehicle?.shop?.district) && (
                      <span>· {[vehicle.shop?.city, vehicle.shop?.district].filter(Boolean).join(", ")}</span>
                    )}
                  </div>
                </div>

                {images.length > 0 && (
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white/90">
                    {selectedImgIndex + 1} / {images.length}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Selector (Clean, only when multiple images) */}
            {images.length > 1 && (
              <div className="flex gap-2 border-t border-white/10 bg-black/40 p-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setSelectedImgIndex(idx)}
                    className={cn(
                      "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                      idx === selectedImgIndex
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── WhatsApp Message Caption ─────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="size-3.5 text-emerald-600" />
                <span>Post Description (Editable)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTextOnly}
                  className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  {copiedText ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  <span>{copiedText ? "Text Copied" : "Copy Text Only"}</span>
                </button>

                {vehicle?.slug && (
                  <a
                    href={`/vehicles/${vehicle.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                  >
                    <span>Public Page</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Authentic WhatsApp Bubble */}
            <div className="rounded-2xl border border-emerald-200/60 bg-[#efeae2] p-3 text-sm dark:bg-muted/40">
              <div className="relative rounded-xl bg-[#d9fdd3] p-3 shadow-sm text-gray-900 dark:bg-emerald-950/70 dark:text-emerald-100">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="w-full resize-y border-none bg-transparent p-0 text-xs sm:text-sm font-sans focus-visible:ring-0 leading-relaxed shadow-none"
                  placeholder="Post text..."
                />
                <span className="block text-right text-[10px] text-gray-500 mt-1">LankaLane ✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CLEAN, USER-FRIENDLY FOOTER (NO DUPLICATES, NO SAVE BUTTON) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t bg-muted/20 px-5 py-3.5">
          {/* BUTTON 1: COPIES BOTH IMAGE AND DESCRIPTION */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyBoth}
            className={cn(
              "w-full sm:w-auto h-10 gap-2 border-emerald-300 font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 transition-all",
              copiedBoth && "bg-emerald-100 border-emerald-500 text-emerald-900"
            )}
          >
            {copiedBoth ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <ClipboardCopy className="size-4 text-emerald-700" />
            )}
            <span>{copiedBoth ? "Both Copied! (Ctrl+V)" : "Copy Image & Description"}</span>
          </Button>

          {/* BUTTON 2: 1-CLICK SHARE ALL DETAILS + IMAGE DIRECTLY */}
          <Button
            type="button"
            onClick={handleShareAllToWhatsApp}
            className="w-full sm:w-auto h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white shadow-md transition-all active:scale-95"
          >
            <WhatsAppIcon className="size-4 fill-current" />
            <span>Share All to WhatsApp</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Single clean button on the listing review page (NO DUPLICATES)
 */
export function WhatsAppShareButton({ vehicle, className, size = "sm", variant = "default" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(
          "gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <WhatsAppIcon className="size-4 fill-current" />
        <span>Share to WhatsApp Channel</span>
      </Button>

      <WhatsAppShareDialog vehicle={vehicle} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Single compact icon action button in tables
 */
export function WhatsAppTableActionButton({ vehicle, className }) {
  const [open, setOpen] = useState(false);

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "!h-6 !w-6 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400",
              className
            )}
            onClick={handleOpen}
            aria-label="Share to WhatsApp"
          >
            <WhatsAppIcon className="!h-3.5 !w-3.5 fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Share to WhatsApp Channel</TooltipContent>
      </Tooltip>

      <WhatsAppShareDialog vehicle={vehicle} open={open} onOpenChange={setOpen} />
    </>
  );
}
