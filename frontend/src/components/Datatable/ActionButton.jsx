"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Small icon button for table rows; `label` shows as a tooltip on hover. */
export function ActionButton({ href, onClick, icon: Icon, label, variant = "outline", className, disabled }) {
  const button = href ? (
    <Button variant={variant} size="icon" className={cn("!h-6 !w-6", className)} asChild>
      <Link href={href} aria-label={label}>
        <Icon className="!h-3.5 !w-3.5" />
      </Link>
    </Button>
  ) : (
    <Button variant={variant} size="icon" className={cn("!h-6 !w-6", className)} onClick={onClick} aria-label={label} disabled={disabled}>
      <Icon className="!h-3 !w-3" />
    </Button>
  );

  if (!label) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
