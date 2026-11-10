"use client";

import { useEffect, useState } from "react";
import { APP_TIMEZONE } from "@/lib/utils";

/** Today's date and the time in the app's timezone. Starts after mount, so the server and browser render the same. */
export function HeaderClock({ variant = "header" }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  if (variant === "sidebar") {
    return (
      <div className="px-3 pt-3">
        <div className="flex flex-col rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5 leading-tight shadow-sm">
          <span className="text-lg font-semibold tabular-nums text-sidebar-foreground">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: APP_TIMEZONE })}
          </span>
          <span className="text-xs text-sidebar-foreground/60">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden h-[50px] shrink-0 flex-col items-start justify-center rounded-xl border bg-card px-3 leading-tight shadow-sm xl:flex">
      <span className="text-sm font-semibold tabular-nums">
        {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: APP_TIMEZONE })}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE })}
      </span>
    </div>
  );
}
