"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActionButton({ href, onClick, icon: Icon, label, variant = "outline", className }) {
  if (href) {
    return (
      <Button variant={variant} size="icon" className={cn("!h-6 !w-6", className)} asChild>
        <Link href={href} aria-label={label}>
          <Icon className="!h-3.5 !w-3.5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} size="icon" className={cn("!h-6 !w-6", className)} onClick={onClick} aria-label={label}>
      <Icon className="!h-3 !w-3" />
    </Button>
  );
}
