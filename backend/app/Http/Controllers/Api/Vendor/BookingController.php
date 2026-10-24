<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\RejectBookingRequest;
use App\Http\Resources\Vendor\BookingResource;
use App\Models\Booking;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The shop's booking inbox - ShopScope (via Booking's BelongsToShop,
 * shop_id denormalised from vehicle.shop_id) has already confined every
 * {booking} route parameter to the active shop before it reaches here.
 */
class BookingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private TransitionBooking $transitions) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Booking::class);

        $bookings = Booking::with('vehicle', 'customer', 'pricing', 'financials')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $bookings->setCollection(
            $bookings->getCollection()->map(fn ($b) => (new BookingResource($b))->resolve())
        ), 'message' => 'Bookings retrieved', 'status' => true]);
    }

    public function show(Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        $booking->load('vehicle', 'customer', 'pickupLocation', 'returnLocation', 'pricing', 'financials', 'statusHistories');

        return $this->response('Booking retrieved', new BookingResource($booking));
    }

    public function accept(Booking $booking): JsonResponse
    {
        $this->authorize('respond', $booking);

        $shopSettings = $booking->shop->settings;
        $booking = $this->transitions->accept($booking, AuthUser::id(), $shopSettings->payment_window_hours ?? 12);

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'accepted']);

        return $this->response('Booking accepted — awaiting customer payment', new BookingResource($booking));
    }

    public function reject(RejectBookingRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('respond', $booking);

        $booking = $this->transitions->reject($booking, AuthUser::id(), $request->validated('reason'));

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'rejected', 'reason' => $request->validated('reason')]);

        return $this->response('Booking rejected', new BookingResource($booking));
    }

    public function cancel(RejectBookingRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('cancel', $booking);

        $booking = $this->transitions->cancelByOwner($booking, AuthUser::id(), $request->validated('reason'));

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'cancelled_by_owner', 'reason' => $request->validated('reason')]);

        return $this->response('Booking cancelled', new BookingResource($booking));
    }
}
