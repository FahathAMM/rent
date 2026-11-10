"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { platformDetailService } from "@/services/platformDetailService";

const LINKS = [
  { href: "/faq", label: "Help" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

/** Slim footer under the dashboard content. Links open the public site in a new tab. */
export function DashboardFooter() {
  const { data: brand = {} } = useQuery({
    queryKey: ["platform-details"],
    queryFn: () => platformDetailService.get().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const brandName = brand.name || "LankaLane";

  return (
    <footer className="border-t bg-background px-4 py-3 text-xs text-muted-foreground">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
