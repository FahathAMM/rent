"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { vendorInquiryService } from "@/services/vendorInquiryService";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TextareaInput } from "@/components/forms/FormField";
import { Loader2, MessageSquareReply, Home } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function VendorInquiriesPage() {
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const reply = useMutation({
    mutationFn: () => vendorInquiryService.reply(selected.id, draft),
    onSuccess: () => { setRefreshKey((k) => k + 1); toast.success("Reply sent"); setSelected(null); setDraft(""); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to reply"),
  });

  const openInquiry = (inquiry) => { setSelected(inquiry); setDraft(""); };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    { accessorKey: "name", header: "Name", cell: (row) => row.name ?? "—" },
    { accessorKey: "vehicle", header: "Vehicle", cell: (row) => row.vehicle?.title ?? "—" },
    { accessorKey: "contact", header: "Contact", cell: (row) => row.phone || row.email || "—" },
    { accessorKey: "message", header: "Message", cell: (row) => <span className="line-clamp-1">{row.message}</span> },
    {
      accessorKey: "status",
      header: () => <SortableHeader label="Status" column="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      accessorKey: "created_at",
      header: () => <SortableHeader label="Date" column="created_at" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />,
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: (row) => row.reply_message ? (
        <span className="text-xs font-medium text-emerald-600">Replied</span>
      ) : (
        <ActionButton onClick={() => openInquiry(row)} icon={MessageSquareReply} label="Reply" className="text-purple-600 border-purple-300 hover:text-purple-700 hover:bg-purple-50 hover:border-purple-400" />
      ),
    },
  ];

  const breadcrumbItems = [
    { label: "Home", href: "/vendor/dashboard", icon: <Home className="size-4" /> },
    { label: "Inquiries" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        <ServerDataTable
          key={refreshKey}
          endpoint="/vendor/inquiries"
          columns={columns}
          breadcrumb={[]}
          defualtSortField="created_at"
          defaultSortOrder="desc"
        />
      </HomePageWrapper>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {selected.vehicle?.title} · {selected.phone} {selected.email && `· ${selected.email}`} · {formatDateTime(selected.created_at)}
              </p>
              <p className="rounded-md bg-muted p-2.5 text-sm">{selected.message}</p>
              <TextareaInput label="Your reply" placeholder="Reply..." value={draft} onChange={(e) => setDraft(e.target.value)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={() => reply.mutate()} disabled={!draft.trim() || reply.isPending}>
                  {reply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reply
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
