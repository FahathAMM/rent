<?php

namespace App\Http\Controllers\Api\Customer;

use App\Services\RentalAgreementService;
use App\Support\PdfDocument;
use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Requests\Booking\SubmitTransferRequest;
use App\Http\Resources\Account\BookingResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Queries\CustomerBookingQuery;
use App\Repositories\PublicVehicleRepo;
use App\Services\AuditService;
use App\Services\BankTransferService;
use App\Services\BookingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function __construct(
        private BookingService $service,
        private TransitionBooking $transitions,
        private BankTransferService $transfers,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $bookings = CustomerBookingQuery::withRelations(CustomerBookingQuery::base(auth('customer')->id()))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 10), 50));

        return response()->json(['record' => $bookings->setCollection(
            $bookings->getCollection()->map(fn ($b) => (new BookingResource($b))->resolve())
        ), 'message' => 'Bookings retrieved', 'status' => true]);
    }

    /** Counts for the summary tiles on the customer's bookings page - across all their bookings, not one page of the list. */
    public function summary(): JsonResponse
    {
        $customerId = auth('customer')->id();
        $counts = CustomerBookingQuery::base($customerId)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        // Open bookings paid to the shop that still owe something (cash due at pickup or a transfer to make).
        $owing = CustomerBookingQuery::base($customerId)
            ->with('pricing', 'payments')
            ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
            ->whereIn('payment_method', [Booking::METHOD_CASH, Booking::METHOD_BANK_TRANSFER])
            ->where('payment_status', '!=', Booking::PAYMENT_PAID)
            ->get()
            ->filter(fn (Booking $b) => $b->balanceDue() > 0);

        return $this->response('Booking summary', [
            'requested' => (int) ($counts[Booking::STATUS_PENDING] ?? 0),
            'upcoming' => (int) ($counts[Booking::STATUS_CONFIRMED] ?? 0),
            'active' => (int) ($counts[Booking::STATUS_ACTIVE] ?? 0),
            'completed' => (int) ($counts[Booking::STATUS_COMPLETED] ?? 0),
            'to_pay_count' => $owing->count(),
            'to_pay_amount' => round($owing->sum(fn (Booking $b) => $b->balanceDue()), 2),
        ]);
    }

    public function show(string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking, 404);

        return $this->response('Booking retrieved', new BookingResource($booking));
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $vehicle = app(PublicVehicleRepo::class)->findById((int) $request->validated('vehicle_id'));
        abort_unless($vehicle, 404);

        $booking = $this->service->create(auth('customer')->user(), $vehicle, $request->validated());

        AuditService::create('Booking', $booking->id, $booking->booking_reference);

        return $this->response('Booking request submitted', new BookingResource($booking), 201);
    }

    public function submitTransfer(SubmitTransferRequest $request, string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking, 404);

        $payment = $this->transfers->submit(
            $booking,
            auth('customer')->user(),
            (float) $request->validated('amount'),
            $request->validated('transfer_reference'),
            $request->file('proof'),
        );

        AuditService::create('Payment', $payment->id, $payment->payment_reference);

        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);

        return $this->response('Receipt uploaded — the shop will check it', new BookingResource($booking), 201);
    }

    /**
     * The booking voucher the customer shows the shop at pickup. Inline by
     * default (opens in the browser's PDF viewer); ?download=1 saves it.
     * Only once the shop has confirmed - before that there is nothing to show.
     */
    public function voucher(Request $request, string $reference): Response
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking, 404);
        abort_unless(in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true), 422, 'The voucher is available once the shop confirms your booking.');

        return PdfDocument::make('pdf.booking-confirmation', [
            'booking' => $booking,
            'shop' => $booking->shop,
            'customer' => auth('customer')->user(),
            'vehicle' => $booking->vehicle,
            'pricing' => $booking->pricing,
        ], PdfDocument::localeFrom($request))->response($booking->booking_reference, $request->boolean('download'));
    }

    /** The rental agreement for the customer's own booking: the shop's terms and their handover signature. */
    public function agreement(Request $request, string $reference): Response
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking, 404);
        abort_unless(in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true), 422, 'The agreement is available once the shop confirms your booking.');

        return app(RentalAgreementService::class)->pdf($booking, PdfDocument::localeFrom($request))
            ->response($booking->booking_reference, $request->boolean('download'));
    }

    /** The customer's own receipt, streamed from the private disk. */
    public function transferProof(string $reference, Payment $payment): StreamedResponse
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking && $payment->booking_id === $booking->id && $payment->proof, 404);

        return Storage::disk($payment->proof->disk)->response($payment->proof->file_path, $payment->proof->file_name);
    }

    public function cancel(Request $request, string $reference): JsonResponse
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $reference);
        abort_unless($booking, 404);

        $booking = $this->transitions->cancelByCustomer($booking, auth('customer')->id(), $request->get('reason'));

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'cancelled_by_customer']);

        return $this->response('Booking cancelled', new BookingResource($booking));
    }
}
