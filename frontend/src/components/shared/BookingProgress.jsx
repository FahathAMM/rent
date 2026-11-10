"use client";

import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDateTime } from "@/lib/utils";

const label = (v) => (v ? String(v).replace(/_/g, " ") : null);

// The happy path a booking walks; cancelled/rejected/expired/no-show branch off it.
const LIFECYCLE = [
  { key: "pending", at: "created_at", label: "Requested" },
  { key: "confirmed", at: "confirmed_at", label: "Confirmed" },
  { key: "active", at: "actual_pickup_at", label: "Picked up" },
  { key: "completed", at: "actual_return_at", label: "Returned" },
];
const ENDED = ["rejected", "expired", "cancelled_by_customer", "cancelled_by_owner", "cancelled_by_admin", "no_show"];

// The words that differ between the customer's and the shop's view of the same booking.
const TEXT = {
  customer: {
    pickedUp: "Picked up",
    replyLate: (due) => `Shop reply was due ${due}`,
    replyBy: (due) => `Shop replies by ${due}`,
    replyByWarnsWhenCurrent: false,
    next: (b, past) => ({
      pending: "Waiting for the shop to confirm",
      confirmed: past(b.pickup_at) ? "Pickup time has passed — contact the shop" : "Next: collect the vehicle at pickup",
      active: past(b.return_at) ? "Your return is overdue — contact the shop" : `On your trip — return by ${formatDateTime(b.return_at)}`,
      completed: "Trip complete",
    }),
  },
  shop: {
    pickedUp: "Handed over",
    replyLate: (due) => `Response was due ${due}`,
    replyBy: (due) => `Respond by ${due}`,
    replyByWarnsWhenCurrent: true,
    next: (b, past) => ({
      pending: "Waiting for you to confirm or reject",
      confirmed: past(b.pickup_at) ? "Pickup time has passed — hand over the vehicle or mark a no-show" : "Next: hand over the vehicle at pickup",
      active: past(b.return_at) ? "The vehicle is overdue for return" : "On rent — waiting for the return",
      completed: "Trip complete",
    }),
  },
};

/** "3 min", "2 h 15 min", "4 days" — a rough, readable gap between two times. */
function duration(ms) {
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** Early/late against the scheduled time; within 15 minutes counts as on time. */
function versus(actual, scheduled) {
  if (!actual || !scheduled) return null;
  const diff = new Date(actual) - new Date(scheduled);
  if (Math.abs(diff) < 15 * 60000) return { text: "On time", tone: "ok" };
  return diff < 0 ? { text: `${duration(diff)} early`, tone: "ok" } : { text: `${duration(diff)} late`, tone: "warn" };
}

/**
 * Requested → Confirmed → Picked up (the shop: Handed over) → Returned as a stepper: done steps with their
 * time (and how long after the request / early or late against the schedule), the current step highlighted,
 * upcoming steps with their scheduled time (amber once overdue). A cancelled/rejected/expired booking
 * shows the steps it reached, then where it ended.
 *
 * view: "customer" (the account page) or "shop" (the vendor booking page) — only the wording differs.
 */
export function BookingProgress({ booking: b, view = "customer" }) {
  const t = TEXT[view] ?? TEXT.customer;
  const now = Date.now();
  const past = (t) => t && new Date(t).getTime() < now;
  const ended = ENDED.includes(b.status);
  const stage = LIFECYCLE.findIndex((s) => s.key === b.status);

  // Ended bookings: the happy-path steps that actually happened, then the end.
  const reached = ended ? LIFECYCLE.filter((s) => b[s.at]).length : stage + 1;
  const endEntry = [...(b.status_histories ?? [])].reverse().find((h) => (h.field ?? "status") === "status" && h.to_value === b.status);
  const endAt = b.ended_at ?? b.cancelled_at ?? endEntry?.created_at;

  const steps = (ended ? LIFECYCLE.slice(0, reached) : LIFECYCLE).map((s, i) => {
    const at = b[s.at];
    const done = i < reached;
    const current = !ended && i === reached; // the next thing to happen
    const prevAt = i > 0 ? b[LIFECYCLE[i - 1].at] : null;
    let note = null;

    if (done && s.key === "confirmed" && at && prevAt) note = { text: `${duration(new Date(at) - new Date(prevAt))} after request` };
    if (done && s.key === "active") note = versus(at, b.pickup_at);
    if (done && s.key === "completed") note = versus(at, b.return_at);

    if (!done && s.key === "confirmed" && b.owner_response_deadline_at) {
      const due = formatDateTime(b.owner_response_deadline_at);
      note = past(b.owner_response_deadline_at)
        ? { text: t.replyLate(due), tone: "warn" }
        : { text: t.replyBy(due), tone: t.replyByWarnsWhenCurrent && current ? "warn" : undefined };
    }
    if (!done && s.key === "active") {
      note = current && past(b.pickup_at)
        ? { text: `Pickup was due ${formatDateTime(b.pickup_at)}`, tone: "warn" }
        : { text: `Scheduled ${formatDateTime(b.pickup_at)}` };
    }
    if (!done && s.key === "completed") {
      note = current && past(b.return_at)
        ? { text: `Overdue · was due ${formatDateTime(b.return_at)}`, tone: "warn" }
        : { text: `Due ${formatDateTime(b.return_at)}` };
    }

    return { key: s.key, label: s.key === "active" ? t.pickedUp : s.label, at: done ? at : null, done, current, note };
  });

  // The reason (if any) is shown in the page's own banner.
  if (ended) steps.push({ key: b.status, label: label(b.status), at: endAt, ended: true, done: true });

  // One line on what happens next.
  const summary = ended ? `Ended · ${label(b.status)}` : t.next(b, past)[b.status];
  const warn = !ended && ((b.status === "confirmed" && past(b.pickup_at)) || (b.status === "active" && past(b.return_at)));

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
        <CardTitle className="text-base">Progress</CardTitle>
        {summary && (
          <span className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium first-letter:uppercase",
            ended ? "bg-destructive/10 text-destructive"
              : warn ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : b.status === "completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-primary/10 text-primary",
          )}>
            {summary}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <ol className="grid gap-0 sm:gap-2 sm:[grid-template-columns:repeat(var(--steps),minmax(0,1fr))]" style={{ "--steps": steps.length }}>
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            // The line leaving this step is filled once the next step happened.
            const lineDone = !last && steps[i + 1].done && !steps[i + 1].ended;
            return (
              <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                {!last && (
                  <>
                    {/* vertical connector (mobile) */}
                    <span className={cn("absolute bottom-0 left-4 top-9 w-0.5 -translate-x-1/2 rounded-full sm:hidden", lineDone ? "bg-emerald-500" : "bg-border")} />
                    {/* horizontal connector (sm+) */}
                    <span
                      className={cn("absolute top-4 hidden h-0.5 -translate-y-1/2 rounded-full sm:block", lineDone ? "bg-emerald-500" : "bg-border")}
                      style={{ left: "calc(50% + 22px)", right: "calc(-50% + 22px)" }}
                    />
                  </>
                )}
                <StepDot s={s} />
                <div className="min-w-0 pt-1 sm:pt-0">
                  <p className={cn("text-sm font-medium capitalize", !s.done && !s.current && "text-muted-foreground", s.ended && "text-destructive")}>{s.label}</p>
                  {s.at && <p className="text-xs text-muted-foreground">{formatDateTime(s.at)}</p>}
                  {s.note && (
                    <p className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      s.note.tone === "warn" ? "font-medium text-amber-700 dark:text-amber-300"
                        : s.note.tone === "ok" ? "text-emerald-600"
                        : "text-muted-foreground",
                    )}>
                      {s.note.text}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function StepDot({ s }) {
  if (s.ended) {
    return <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-4 ring-card"><XCircle className="h-5 w-5" /></span>;
  }
  if (s.done) {
    return <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-card"><CheckCircle2 className="h-5 w-5" /></span>;
  }
  if (s.current) {
    return (
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card ring-4 ring-card">
        <span className="absolute inline-flex size-3 animate-ping rounded-full bg-primary/40" />
        <span className="relative size-2.5 rounded-full bg-primary" />
      </span>
    );
  }
  return <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-card ring-4 ring-card"><Circle className="h-2 w-2 fill-muted-foreground/30 text-transparent" /></span>;
}
