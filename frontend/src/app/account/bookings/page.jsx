import { CalendarCheck } from "lucide-react";

export default function AccountBookingsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">My Bookings</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarCheck className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Coming soon</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Booking requests, their status, and payment all land in a later phase — see
          app-doc/marketplace/04-lifecycles.md.
        </p>
      </div>
    </div>
  );
}
