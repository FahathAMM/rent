"use client";

import { Fragment } from "react";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * A single fixed-height breadcrumb row. Every crumb — icon or not, link or
 * current page — renders inline at the same text-sm scale, so adding an
 * icon (e.g. Home) never grows the row the way wrapping it in a full-size
 * <Button> used to.
 */
export default function DynamicBreadcrumb({ items = [] }) {
  return (
    <Breadcrumb className="rounded-lg border bg-card px-3 py-2 shadow-sm">
      <BreadcrumbList className="flex-nowrap overflow-x-auto">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={index}>
              <BreadcrumbItem className="shrink-0">
                {item.href && !isLast ? (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="inline-flex items-center gap-1.5 px-1 py-0.5 font-medium">
                    {item.icon}
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="shrink-0" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
