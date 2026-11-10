<?php

namespace App\Http\Controllers\Api\Platform;

use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Booking;
use App\Models\Dispute;
use App\Models\SystemAdmin;
use App\Models\VehicleAvailability;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cross-shop booking oversight. No ShopScope bypass is needed here —
 * ShopScope's platform-admin branch already leaves every platform-guard
 * query unrestricted (see ShopScope's docblock).
 */
class BookingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private TransitionBooking $action) {}

    public function index(Request $request): JsonResponse
    {
        $bookings = Booking::with('vehicle:id,title', 'shop:id,name', 'customer:id,name,email')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->shop_id, fn ($q) => $q->where('shop_id', $request->shop_id))
            ->when($request->search, fn ($q) => $q->where('booking_reference', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $bookings, 'message' => 'Bookings retrieved', 'status' => true]);
    }

    public function show(string $reference): JsonResponse
    {
        $booking = Booking::where('booking_reference', $reference)
            ->with([
                'vehicle', 'vehicle.images' => fn ($q) => $q->where('is_primary', true)->with('attachment'),
                'shop', 'customer:id,name,email,phone,created_at',
                'pickupLocation:id,name,address,city,district', 'returnLocation:id,name,address,city,district',
                'pricing', 'securityDeposit', 'statusHistories' => fn ($q) => $q->latest(),
                'inspections', 'damages', 'payments', 'disputes', 'review',
            ])
            ->first();
        abort_unless($booking, 404);

        // Same money figures the vendor and customer payloads carry (their BookingResources), so the
        // page doesn't have to re-derive them from the ledger — that misses deposits handed back at return.
        $booking->setAttribute('amount_paid', $booking->amountPaid());
        $booking->setAttribute('balance_due', $booking->balanceDue());

        return $this->response('Booking retrieved', $booking);
    }

    public function cancel(ReasonRequest $request, string $reference): JsonResponse
    {
        $booking = Booking::where('booking_reference', $reference)->first();
        abort_unless($booking, 404);

        $booking = $this->action->cancelByAdmin($booking, $this->admin()->id, $request->validated('reason'));

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'cancelled_by_admin']);

        return $this->response('Booking cancelled', $booking);
    }

    /**
     * Platform Owner only, with a reason. Soft delete: the booking disappears
     * from every list (platform, shop, customer) but its payments, history and
     * disputes stay in the database, while its days on the vehicle calendar
     * are freed. Not while it's live — a confirmed or
     * active booking holds the vehicle, so cancel it first — and not while a
     * dispute on it is still open.
     */
    public function destroy(ReasonRequest $request, string $reference): JsonResponse
    {
        $booking = Booking::where('booking_reference', $reference)->first();
        abort_unless($booking, 404);

        if (in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE], true)) {
            throw ValidationException::withMessages(['booking' => ['This booking is still live (confirmed or active) — cancel it first, then delete it.']]);
        }
        $openDisputes = $booking->disputes()->whereNotIn('status', [Dispute::STATUS_RESOLVED, Dispute::STATUS_CLOSED])->count();
        if ($openDisputes) {
            throw ValidationException::withMessages(['booking' => ["This booking has {$openDisputes} open dispute(s) — resolve them first."]]);
        }

        DB::transaction(function () use ($booking) {
            // Free the booking's days on the vehicle calendar (vehicle_availability) — otherwise they stay "booked".
            VehicleAvailability::where('booking_id', $booking->id)->delete();
            $booking->delete();
        });
        AuditService::delete('Booking', $booking->id, $booking->booking_reference, [
            'status' => $booking->status, 'reason' => $request->validated('reason'), 'decided_by_admin_id' => $this->admin()->id,
        ]);

        return $this->response('Booking deleted');
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
