<?php

namespace App\Http\Controllers\Api\Platform;

use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Booking;
use App\Models\SystemAdmin;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            ->with('vehicle', 'shop', 'customer:id,name,email,phone', 'pricing', 'financials', 'statusHistories', 'disputes', 'review')
            ->first();
        abort_unless($booking, 404);

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

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
