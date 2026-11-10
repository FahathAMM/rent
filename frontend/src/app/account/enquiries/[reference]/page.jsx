"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Car, ExternalLink, FileText, Loader2, Lock, Store } from "lucide-react";
import { openBlob } from "@/lib/utils";
import { pendingMessage } from "@/lib/chat";
import { toast } from "sonner";
import { QUICK_REPLIES } from "../chat-utils";

/** How often an open conversation checks for the shop's reply. */
const POLL_MS = 15000;
const OPEN = ["new", "replied"];

export default function AccountEnquiryDetailPage() {
  const { reference } = useParams();
  const qc = useQueryClient();
  const { format } = useCurrencyFormat();
  const queryKey = ["my-enquiry", reference];

  const [body, setBody] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const { data: enquiry, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => customerService.enquiries.getOne(reference).then((r) => r.data.data),
    retry: false,
    // Pick up the shop's replies while the conversation is open (paused when the tab is hidden).
    refetchInterval: (query) => (OPEN.includes(query.state.data?.status) ? POLL_MS : false),
    refetchOnWindowFocus: true,
  });

  const invalidateInbox = () => qc.invalidateQueries({ queryKey: ["my-enquiries"] });

  const reply = useMutation({
    mutationFn: (text) => customerService.enquiries.reply(reference, text).then((r) => r.data.data),
    // Show the message straight away; the server's copy replaces it when it lands.
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old) => old && { ...old, messages: [...(old.messages ?? []), pendingMessage("customer", text)] });
      setBody("");
      return { previous, text };
    },
    onSuccess: (fresh) => { qc.setQueryData(queryKey, fresh); invalidateInbox(); },
    onError: (err, _text, ctx) => {
      qc.setQueryData(queryKey, ctx?.previous);
      setBody((current) => current || ctx?.text || "");
      toast.error(err.response?.data?.message ?? "Could not send your message");
    },
  });

  const close = useMutation({
    mutationFn: () => customerService.enquiries.close(reference).then((r) => r.data.data),
    onSuccess: (fresh) => { qc.setQueryData(queryKey, fresh); invalidateInbox(); setConfirmClose(false); toast.success("Enquiry closed"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not close the enquiry"),
  });

  // Opening the conversation marks the shop's messages read — refresh the inbox badge.
  useEffect(() => { if (enquiry) invalidateInbox(); }, [enquiry?.reference]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAgreement = () => {
    const tab = window.open("", "_blank");
    customerService.enquiries.agreement(reference)
      .then((res) => openBlob(res.data, tab))
      .catch(() => { tab?.close(); toast.error("Could not open the sale agreement"); });
  };

  const back = (
    <Link href="/account/enquiries" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />Back to enquiries
    </Link>
  );

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError || !enquiry) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Enquiry not found, or it isn&apos;t available to your account.</div>
      </div>
    );
  }

  const isOpen = OPEN.includes(enquiry.status);
  const messages = enquiry.messages ?? [];
  const vehicle = enquiry.vehicle;
  const shop = enquiry.shop;
  const shopName = shop?.name ?? "Shop";
  const onSale = vehicle?.sale_status === "available";
  const hasMine = messages.some((m) => m.sender_type === "customer");

  return (
    <div className="space-y-3">
      {back}

      <div className="flex h-[calc(100dvh-11rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* The car and the shop this conversation is about. */}
        <header className="flex flex-wrap items-center gap-3 border-b p-3 sm:p-4">
          <VehicleThumb url={vehicle?.image_url} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-semibold">{vehicle?.title ?? "Enquiry"}</h1>
              <StatusBadge status={enquiry.status} />
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {vehicle?.price != null && <><span className="font-medium text-foreground">{format(vehicle.price)}</span>{" · "}</>}
              <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />{shopName}{shop?.city ? `, ${shop.city}` : ""}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">{enquiry.reference}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {onSale && vehicle?.slug && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={`/buy/${vehicle.slug}`}><ExternalLink className="h-3.5 w-3.5" />View listing</Link>
              </Button>
            )}
            {enquiry.sale && (
              <Button variant="outline" size="sm" onClick={openAgreement} className="gap-1.5"><FileText className="h-3.5 w-3.5" />Sale agreement</Button>
            )}
            {isOpen && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)} className="text-muted-foreground">Close enquiry</Button>
            )}
          </div>
        </header>

        <ChatThread className="flex-1" messages={messages} mySenderType="customer" other={{ name: shopName, avatarUrl: shop?.logo_url }} />

        {isOpen ? (
          <ChatComposer
            id="enquiry-reply"
            value={body}
            onChange={setBody}
            onSend={(text) => reply.mutate(text)}
            pending={reply.isPending}
            label={`Message ${shopName}`}
            placeholder={`Message ${shopName}…`}
            quickReplies={hasMine ? QUICK_REPLIES.slice(1) : QUICK_REPLIES}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 p-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0" />
              This enquiry is closed{enquiry.closed_reason ? `: ${enquiry.closed_reason}` : ""}.
            </span>
            {!enquiry.sale && <Button asChild variant="outline" size="sm"><Link href="/buy">Browse vehicles for sale</Link></Button>}
          </div>
        )}
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              You won&apos;t be able to send more messages here. If you change your mind, ask about the car again from its listing to start a new conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={close.isPending}>Keep it open</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); close.mutate(); }} disabled={close.isPending}>
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Close enquiry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VehicleThumb({ url }) {
  return (
    <div className="size-14 shrink-0 overflow-hidden rounded-xl border bg-muted">
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="size-full object-cover" />
        : <div className="flex size-full items-center justify-center text-muted-foreground"><Car className="h-6 w-6" /></div>}
    </div>
  );
}
