<?php

namespace App\Http\Controllers\Api;

use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Resources\Account\BookingResource;
use App\Queries\CustomerBookingQuery;
use App\Queries\PublicVehicleQuery;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\BookingService;
use App\Services\PaymentService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The customer's own bookings - ownership by customer_id, no shop
 * context involved at all (see BookingPolicy's docblock). A customer
 * never needs an X-Shop-Id to see or act on their own booking.
 *
 * Every read here goes through CustomerBookingQuery, never a bare
 * Booking::query() or implicit route binding - Booking is shop-scoped
 * (BelongsToShop), and ShopScope fails closed for an authenticated user
 * with no shop context, which every customer request is. See
 * CustomerBookingQuery's docblock.
 */
class BookingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private BookingService $service, private TransitionBooking $transitions, private PaymentService $payments) {}

    public function index(Request $request): JsonResponse
    {
        $bookings = CustomerBookingQuery::withRelations(CustomerBookingQuery::base(AuthUser::id()))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 10), 50));

        return response()->json(['record' => $bookings->setCollection(
            $bookings->getCollection()->map(fn ($b) => (new BookingResource($b))->resolve())
        ), 'message' => 'Bookings retrieved', 'status' => true]);
    }

    public function show(string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(AuthUser::id(), $reference);
        abort_unless($booking, 404);

        return $this->response('Booking retrieved', new BookingResource($booking));
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findById((int) $request->validated('vehicle_id'));
        abort_unless($vehicle, 404);

        $booking = $this->service->create(AuthUser::user(), $vehicle, $request->validated());

        AuditService::create('Booking', $booking->id, $booking->booking_reference);

        return $this->response('Booking request submitted', new BookingResource($booking), 201);
    }

    public function checkout(string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(AuthUser::id(), $reference);
        abort_unless($booking, 404);

        $checkout = $this->payments->startCheckout($booking);

        return $this->response('Checkout ready', $checkout);
    }

    public function cancel(Request $request, string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(AuthUser::id(), $reference);
        abort_unless($booking, 404);

        $booking = $this->transitions->cancelByCustomer($booking, AuthUser::id(), $request->get('reason'));

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'cancelled_by_customer']);

        return $this->response('Booking cancelled', new BookingResource($booking));
    }
}
