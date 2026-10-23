"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachmentService } from "@/services/attachmentService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, Image as ImageIcon, Trash2, Loader2, Download } from "lucide-react";
import { formatDateTime, downloadBlob } from "@/lib/utils";

function fileIcon(mime) {
  if (mime?.startsWith("image/")) return ImageIcon;
  return FileText;
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPanel({ attachableType, attachableId }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const queryKey = ["attachments", attachableType, attachableId];

  const { data: attachments, isLoading } = useQuery({
    queryKey,
    queryFn: () => attachmentService.getAll(attachableType, attachableId).then((r) => r.data.data),
    enabled: !!attachableId,
  });

  const upload = useMutation({
    mutationFn: (file) => attachmentService.upload(attachableType, attachableId, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("File uploaded"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Upload failed"),
  });

  const remove = useMutation({
    mutationFn: attachmentService.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success("File removed"); },
    onError: (err) => toast.error(err.response?.data?.message ?? "Failed to remove"),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = "";
  };

  const handleDownload = async (attachment) => {
    try {
      const res = await attachmentService.download(attachment.id);
      downloadBlob(res.data, attachment.file_name);
    } catch {
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload File
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !attachments?.length ? (
        <p className="text-sm text-muted-foreground text-center py-6">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => {
            const Icon = fileIcon(a.mime_type);
            return (
              <li key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatSize(a.file_size)} · {a.uploaded_by ?? "System"} · {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="icon" className="!h-7 !w-7" onClick={() => handleDownload(a)}>
                    <Download className="!h-3.5 !w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="!h-7 !w-7 text-destructive border-destructive/40" onClick={() => remove.mutate(a.id)}>
                    <Trash2 className="!h-3.5 !w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
