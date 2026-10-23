"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import platformApi from "@/lib/platformAxios";
import { platformLogService } from "@/services/platformService";
import { usePlatformAuthStore } from "@/store/platformAuthStore";
import ServerDataTable from "@/components/Datatable/ServerDataTable";
import { SortableHeader } from "@/components/Datatable/SortableHeader";
import { ActionButton } from "@/components/Datatable/ActionButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { HomePageWrapper } from "@/components/shared/HomePageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Trash2, Maximize2, Copy, Home } from "lucide-react";
import { formatBytes } from "@/lib/utils";

const LEVELS = ["DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"];
const LEVEL_VARIANTS = {
  DEBUG: "secondary",
  INFO: "info",
  NOTICE: "secondary",
  WARNING: "warning",
  ERROR: "destructive",
  CRITICAL: "destructive",
  ALERT: "destructive",
  EMERGENCY: "destructive",
};

function firstLine(message) {
  return message.split("\n")[0];
}

export default function PlatformLogsPage() {
  const admin = usePlatformAuthStore((s) => s.admin);
  const isOwner = admin?.role === "platform_owner";

  const [file, setFile] = useState("");
  const [level, setLevel] = useState("");
  const [detail, setDetail] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: files } = useQuery({
    queryKey: ["platform-log-files"],
    queryFn: () => platformLogService.getFiles().then((r) => r.data.data),
  });

  // Default to the most recently modified file once the list loads.
  useEffect(() => {
    if (!file && files?.length) {
      setFile(files[0].name);
    }
  }, [files, file]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await platformLogService.download(file);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download log file");
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await platformLogService.clear(file);
      toast.success(`${file} cleared`);
      setConfirmClear(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Failed to clear log file");
    } finally {
      setClearing(false);
    }
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(detail?.message ?? "");
    toast.success("Copied to clipboard");
  };

  const columns = ({ sortField, sortOrder, handleSort }) => [
    {
      accessorKey: "datetime",
      header: () => (
        <SortableHeader label="Time" column="datetime" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      ),
      cell: (row) => <span className="text-xs whitespace-nowrap">{row.datetime}</span>,
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: (row) => <Badge variant={LEVEL_VARIANTS[row.level] ?? "outline"} className="text-[10px]">{row.level}</Badge>,
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: (row) => (
        <span className="block truncate font-mono text-xs" title={row.message}>
          {firstLine(row.message)}
        </span>
      ),
    },
    {
      accessorKey: "actions",
      header: "",
      cell: (row) => <ActionButton onClick={() => setDetail(row)} icon={Maximize2} label="View entry" />,
    },
  ];

  const breadcrumbItems = [
    { label: "Dashboard", href: "/platform/dashboard", icon: <Home className="size-4" /> },
    { label: "Logs" },
  ];

  return (
    <div>
      <HomePageWrapper breadcrumb={breadcrumbItems}>
        {file ? (
          <ServerDataTable
            key={`${file}-${refreshKey}`}
            api={platformApi}
            endpoint="/platform/logs/entries"
            columns={columns}
            breadcrumb={[]}
            defualtSortField="datetime"
            defaultSortOrder="desc"
            filters={{ file, level: level || undefined }}
            actions={
              <>
                <Button variant="outline" size="sm" className="h-8" onClick={handleDownload} disabled={downloading}>
                  <Download className="h-4 w-4" /> Download
                </Button>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-destructive border-destructive/40"
                    onClick={() => setConfirmClear(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </Button>
                )}
              </>
            }
          >
            <Select value={file} onValueChange={setFile}>
              <SelectTrigger className="h-8 w-full text-sm sm:w-52"><SelectValue placeholder="Log file" /></SelectTrigger>
              <SelectContent>
                {(files ?? []).map((f) => (
                  <SelectItem key={f.name} value={f.name}>{f.name} ({formatBytes(f.size)})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={level || "all"} onValueChange={(v) => setLevel(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-full text-sm sm:w-40"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </ServerDataTable>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading log files…</div>
        )}
      </HomePageWrapper>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={LEVEL_VARIANTS[detail?.level] ?? "outline"}>{detail?.level}</Badge>
              <span className="text-sm font-normal text-muted-foreground">{detail?.datetime}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Button variant="outline" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={copyMessage}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 pr-10 text-xs">
              {detail?.message}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear Log File"
        description={`Clear all entries from "${file}"? This cannot be undone.`}
        onConfirm={handleClear}
        loading={clearing}
        confirmText="Clear"
      />
    </div>
  );
}
