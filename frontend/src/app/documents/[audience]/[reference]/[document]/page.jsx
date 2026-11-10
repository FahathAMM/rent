"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FileWarning, Loader2 } from "lucide-react";
import { vendorService } from "@/services/vendorService";
import { customerService } from "@/services/customerService";
import { isLocale } from "@/i18n/config";

// Who is looking → which signed-in API client fetches the PDF.
const SERVICES = { vendor: vendorService, customer: customerService };
const DOCUMENTS = { voucher: "booking voucher", agreement: "rental agreement" };

/**
 * A booking PDF (voucher or rental agreement) shown full-screen in its own tab, titled with the booking number.
 * The booking pages open this page for "View": the tab fetches the PDF itself, because Chrome shows a blank
 * page for a blob: URL that the opening tab created. ?lang=en|ta picks the PDF's language.
 */
export default function BookingDocumentPage() {
  const { audience, reference, document: kind } = useParams();
  const langParam = useSearchParams().get("lang");
  const lang = isLocale(langParam) ? langParam : undefined;
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const service = SERVICES[audience];
    if (!service || !DOCUMENTS[kind]) {
      setError("This document doesn't exist.");
      return;
    }

    let objectUrl = null;
    let cancelled = false;
    service.bookings[kind](reference, false, lang)
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 404
          ? "Booking not found, or you don't have access to it."
          : `Could not load the ${DOCUMENTS[kind]}. Please sign in again and retry.`);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [audience, reference, kind, lang]);

  // React puts <title> in the document head — the tab shows the booking number.
  if (url) {
    return (
      <>
        <title>{reference}</title>
        <iframe src={url} title={reference} className="block h-screen w-screen border-0" />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <title>{reference}</title>
      {error ? (
        <>
          <FileWarning className="h-8 w-8 text-destructive" />
          <p>{error}</p>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading {DOCUMENTS[kind] ?? "document"} {reference}…</p>
        </>
      )}
    </div>
  );
}
