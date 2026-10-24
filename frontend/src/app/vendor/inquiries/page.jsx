"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorInquiryService } from "@/services/vendorInquiryService";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2, MessageCircle, Home, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

function ReplyBox({ inquiry }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const reply = useMutation({
    mutationFn: () => vendorInquiryService.reply(inquiry.id, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-inquiries"] }); toast.success("Reply sent"); setDraft(""); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reply"),
  });

  if (inquiry.reply_message) {
    return (
      <div className="mt-2 rounded-md bg-muted p-2.5 text-sm">
        <p className="text-xs font-semibold text-muted-foreground">Your reply</p>
        <p>{inquiry.reply_message}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <TextareaInput className="flex-1" placeholder="Reply..." value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button size="sm" onClick={() => reply.mutate()} disabled={!draft.trim() || reply.isPending}>
        {reply.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reply"}
      </Button>
    </div>
  );
}

export default function VendorInquiriesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-inquiries", page],
    queryFn: () => vendorInquiryService.getAll({ page }).then((r) => r.data.record),
  });

  const inquiries = data?.data ?? [];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Inquiries" },
  ];

  return (
    <HomePageWrapper breadcrumb={breadcrumbItems}>
      <PageHeader title="Inquiries" description="Questions from prospective renters about your vehicles." />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !inquiries.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-4"><MessageCircle className="h-7 w-7 text-muted-foreground" /></div>
          <p className="text-sm font-medium">No inquiries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((i) => (
            <Card key={i.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.vehicle?.title} · {i.phone} {i.email && `· ${i.email}`}</p>
                  </div>
                  <StatusBadge status={i.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{i.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(i.created_at)}</p>
                <ReplyBox inquiry={i} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.last_page > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {data.current_page} of {data.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </HomePageWrapper>
  );
}
