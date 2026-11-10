"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "@/services/vendorService";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useAuthStore } from "@/store/authStore";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeDollarSign, Car, Eye, Home, Loader2, Lock, Mail, MessageSquare, Phone, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { pendingMessage } from "@/lib/chat";
import { toast } from "sonner";
import { RecordSaleDialog } from "../../components/RecordSaleDialog";

/** How often an open conversation checks for the buyer's reply. */
const POLL_MS = 15000;
const OPEN = ["new", "replied"];

/** Answers a shop gives again and again — one tap fills the reply box. */
const QUICK_REPLIES = [
  "Yes, it's still available.",
  "You're welcome to come and see it — what day suits you?",
  "Yes, a test drive can be arranged.",
  "All the documents are clear and ready for transfer.",
  "The price is slightly negotiable for a serious buyer.",
];

const CLOSE_REASONS = [
  "Sold to another buyer",
  "Buyer stopped responding",
  "Price not agreed",
  "No longer selling this vehicle",
];

/** Sri Lankan mobile (07x…) to the international form WhatsApp links need (947x…). */
function whatsappNumber(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("94")) return digits;
  if (digits.startsWith("0")) return `94${digits.slice(1)}`;
  return digits;
}

export default function SaleEnquiryDetailPage() {
  const { reference } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuthStore();
  const { format } = useCurrencyFormat();
  const queryKey = ["vendor-sale-enquiry", reference];

  const [body, setBody] = useState("");
  const [selling, setSelling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const { data: enquiry, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => vendorService.sales.enquiries.getOne(reference).then((r) => r.data.data),
    retry: false,
    // Pick up the buyer's replies while the conversation is open (paused when the tab is hidden).
    refetchInterval: (query) => (OPEN.includes(query.state.data?.status) ? POLL_MS : false),
    refetchOnWindowFocus: true,
  });

  const reply = useMutation({
    mutationFn: (text) => vendorService.sales.enquiries.reply(reference, text).then((r) => r.data.data),
    // Show the reply straight away; the server's copy replaces it when it lands.
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old) => old && { ...old, messages: [...(old.messages ?? []), pendingMessage("shop", text)] });
      setBody("");
      return { previous, text };
    },
    onSuccess: (fresh) => qc.setQueryData(queryKey, fresh),
    onError: (err, _text, ctx) => {
      qc.setQueryData(queryKey, ctx?.previous);
      setBody((current) => current || ctx?.text || "");
      toast.error(err.response?.data?.message ?? "Could not send your reply");
    },
  });

  const close = useMutation({
    mutationFn: () => vendorService.sales.enquiries.close(reference, closeReason.trim() || undefined).then((r) => r.data.data),
    onSuccess: (fresh) => {
      qc.setQueryData(queryKey, fresh);
      setClosing(false);
      setCloseReason("");
      toast.success("Enquiry closed");
    },
    onError: (err) => toast.error(err.response?.data?.message ?? "Could not close the enquiry"),
  });

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Enquiries", href: "/vendor/sales/enquiries" },
    { label: reference },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError || !enquiry) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-semibold">Enquiry not found</p>
        <Button asChild variant="outline"><Link href="/vendor/sales/enquiries">Back to enquiries</Link></Button>
      </div>
    );
  }

  const isOpen = OPEN.includes(enquiry.status);
  const canReply = can("vendor-sales-enquiries-edit");
  const vehicle = enquiry.vehicle;
  const buyer = enquiry.customer;
  const buyerName = buyer?.name ?? "Buyer";
  const sellable = vehicle && vehicle.sale_status !== "sold" && can("vendor-sales-sold-create");
  const whatsapp = whatsappNumber(buyer?.phone);
  const messages = enquiry.messages ?? [];
  const waiting = enquiry.status === "new";

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems} className="p-4 sm:p-6 lg:p-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* The conversation. */}
        <div className="flex h-[calc(100dvh-12rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          <header className="flex items-center gap-3 border-b p-3 sm:p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {buyerName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-semibold">{buyerName}</h1>
                <StatusBadge status={enquiry.status} />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {vehicle?.title ?? "Vehicle"} · {enquiry.reference}
              </p>
            </div>
            {waiting && isOpen && (
              <span className="hidden shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 sm:inline dark:bg-amber-900/40 dark:text-amber-200">
                Waiting for your reply
              </span>
            )}
          </header>

          <ChatThread className="flex-1" messages={messages} mySenderType="shop" other={{ name: buyerName }} />

          {!isOpen ? (
            <div className="flex items-center gap-2 border-t bg-muted/30 p-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              This enquiry is closed{enquiry.closed_reason ? `: ${enquiry.closed_reason}` : ""}.
            </div>
          ) : canReply ? (
            <ChatComposer
              id="enquiry-reply"
              value={body}
              onChange={setBody}
              onSend={(text) => reply.mutate(text)}
              pending={reply.isPending}
              label={`Reply to ${buyerName}`}
              placeholder={`Reply to ${buyerName}…`}
              quickReplies={QUICK_REPLIES}
            />
          ) : (
            <div className="border-t bg-muted/30 p-4 text-sm text-muted-foreground">You can read this conversation, but your role can&apos;t reply to buyers.</div>
          )}
        </div>

        {/* The buyer, the car and what to do next. */}
        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Buyer</h2>
            <p className="font-medium">{buyerName}</p>
            <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              {buyer?.phone && <p>{buyer.phone}</p>}
              {buyer?.email && <p className="truncate">{buyer.email}</p>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ContactButton href={buyer?.phone ? `tel:${buyer.phone}` : null} icon={Phone} label="Call" />
              <ContactButton href={whatsapp ? `https://wa.me/${whatsapp}` : null} icon={MessageSquare} label="WhatsApp" external />
              <ContactButton href={buyer?.email ? `mailto:${buyer.email}` : null} icon={Mail} label="Email" />
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Vehicle</h2>
            <div className="flex gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                {vehicle?.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={vehicle.image_url} alt="" className="size-full object-cover" />
                  : <div className="flex size-full items-center justify-center text-muted-foreground"><Car className="h-6 w-6" /></div>}
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-snug">{vehicle?.title ?? "Vehicle"}</p>
                {vehicle?.price != null && <p className="text-sm">Asking <span className="font-semibold">{format(vehicle.price)}</span></p>}
                {vehicle?.sale_status && <StatusBadge status={vehicle.sale_status} className="mt-1" />}
              </div>
            </div>
            {vehicle?.id && (
              <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5">
                <Link href={`/vendor/sales/listings/${vehicle.id}/edit`}><Eye className="h-3.5 w-3.5" />Open listing</Link>
              </Button>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold">Actions</h2>
            {enquiry.sale ? (
              <Button asChild variant="outline" className="w-full gap-2">
                <Link href={`/vendor/sales/sold/${enquiry.sale.reference}`}><Receipt className="h-4 w-4" />View sale {enquiry.sale.reference}</Link>
              </Button>
            ) : sellable && (
              <Button className="w-full gap-2" onClick={() => setSelling(true)}><BadgeDollarSign className="h-4 w-4" />Record sale to {buyerName.split(" ")[0]}</Button>
            )}
            {isOpen && canReply && (
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setClosing(true)}>Close enquiry</Button>
            )}
            {!enquiry.sale && !sellable && !(isOpen && canReply) && <p className="text-sm text-muted-foreground">Nothing to do here.</p>}
          </section>
        </aside>
      </div>

      <Dialog open={closing} onOpenChange={(v) => { if (!close.isPending) setClosing(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close this enquiry?</DialogTitle>
            <DialogDescription>The buyer sees the reason, and neither side can send more messages.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CLOSE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCloseReason(r)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    closeReason === r ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <label htmlFor="close-reason" className="text-xs font-medium">Reason (optional)</label>
              <input
                id="close-reason"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                maxLength={255}
                placeholder="Closed by the shop"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(false)} disabled={close.isPending}>Keep it open</Button>
            <Button onClick={() => close.mutate()} disabled={close.isPending}>
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Close enquiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selling && (
        <RecordSaleDialog
          vehicle={vehicle}
          enquiry={enquiry}
          onClose={() => setSelling(false)}
          onRecorded={(sale) => router.push(`/vendor/sales/sold/${sale.reference}`)}
        />
      )}
    </HomePageWrapper>
  );
}

function ContactButton({ href, icon: Icon, label, external }) {
  if (!href) {
    return (
      <span className="flex flex-col items-center gap-1 rounded-lg border border-dashed py-2 text-[11px] text-muted-foreground/60" title={`No ${label.toLowerCase()} details`}>
        <Icon className="h-4 w-4" />{label}
      </span>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <Icon className="h-4 w-4 text-primary" />{label}
    </a>
  );
}
