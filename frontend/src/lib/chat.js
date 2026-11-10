import { APP_TIMEZONE, appDateKey } from "@/lib/utils";

/** Date/time labels and grouping shared by the customer and vendor enquiry chats. */

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: APP_TIMEZONE });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: APP_TIMEZONE });
const shortDayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: APP_TIMEZONE });

/** "3:45 PM" in Sri Lanka time. */
export function chatTime(value) {
  return value ? timeFmt.format(new Date(value)) : "";
}

function yesterdayKey() {
  return appDateKey(Date.now() - 24 * 60 * 60 * 1000);
}

/** Separator label between days: "Today", "Yesterday" or "Monday, Nov 10". */
function chatDayLabel(value) {
  const key = appDateKey(value);
  if (key === appDateKey()) return "Today";
  if (key === yesterdayKey()) return "Yesterday";
  return dayFmt.format(new Date(value));
}

/** Inbox timestamp: time today, "Yesterday", otherwise "Nov 10". */
export function inboxTime(value) {
  if (!value) return "";
  const key = appDateKey(value);
  if (key === appDateKey()) return chatTime(value);
  if (key === yesterdayKey()) return "Yesterday";
  return shortDayFmt.format(new Date(value));
}

/**
 * Messages grouped for display: a day separator whenever the date changes,
 * and `grouped` when the same sender wrote again within 5 minutes (tighter
 * spacing, no repeated name).
 */
export function buildThread(messages) {
  const items = [];
  let lastDay = null;
  let prev = null;

  for (const m of messages) {
    const day = appDateKey(m.created_at);
    if (day !== lastDay) {
      items.push({ type: "day", key: `day-${day}`, label: chatDayLabel(m.created_at) });
      lastDay = day;
      prev = null;
    }
    const grouped = !!prev
      && prev.sender_type === m.sender_type
      && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
    items.push({ type: "message", key: `m-${m.id}`, message: m, grouped });
    prev = m;
  }

  return items;
}

/** A message shown before the server confirms it (removed or replaced once it answers). */
export function pendingMessage(senderType, body) {
  return { id: `pending-${Date.now()}`, sender_type: senderType, body, created_at: new Date().toISOString(), pending: true };
}
