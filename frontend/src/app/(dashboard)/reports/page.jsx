"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { REPORT_TYPES } from "./reportTypes";

// Reports is a menu section (see MenuSeeder's "reports" module) whose
// children are the actual report pages — there's no standalone /reports
// landing page in the sidebar, so send a bare visit to the first report.
export default function ReportsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    if (REPORT_TYPES[0]) router.replace(`/reports/${REPORT_TYPES[0].value}`);
  }, [router]);

  return null;
}
