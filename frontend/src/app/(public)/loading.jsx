import { Loader2 } from "lucide-react";

/** Shown between public pages while the next one loads — the full-screen PublicPreloader only runs on the first visit. */
export default function PublicLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
    </div>
  );
}
