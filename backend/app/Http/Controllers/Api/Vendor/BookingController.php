<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Actions\TransitionBooking;
use App\Http\Controllers\Controller;
use App\Http\Requests\Booking\InspectionRequest;
use App\Http\Requests\Booking\RejectBookingRequest;
use App\Http\Requests\Vendor\RecordPaymentRequest;
use App\Http\Requests\Vendor\RescheduleBookingRequest;
use App\Http\Resources\Vendor\BookingResource;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\AuditService;
use App\Services\BankTransferService;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The shop's booking inbox - ShopScope (via Booking's BelongsToShop,
 * shop_id denormalised from vehicle.shop_id) has already confined every
 * {booking} route parameter to the active shop before it reaches here.
 */
class BookingController extends Controller
{
    use JsonResponseTrait;

    /** InspectionRequest fields that are not columns on booking_inspections. */
    private const NON_INSPECTION_FIELDS = ['damages', 'cash_received', 'deposit_deduction', 'deposit_deduction_reason'];

    public function __construct(private TransitionBooking $transitions, private BankTransferService $transfers) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Booking::class);

        $sortable = ['pickup_at', 'return_at', 'status', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        $bookings = Booking::with('vehicle', 'customer', 'pricing')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where('booking_reference', 'like', "%{$request->search}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$request->search}%")))
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $bookings->setCollection(
            $bookings->getCollection()->map(fn ($b) => (new BookingResource($b))->resolve())
        ), 'message' => 'Bookings retrieved', 'status' => true]);
    }

    public function show(Booking $booking): JsonResponse
    {
        $this->authorize('view', $booking);

        return $this->response('Booking retrieved', new BookingResource($this->loadDetail($booking)));
    }

    private function loadDetail(Booking $booking): Booking
    {
        return $booking->load([
            'vehicle', 'vehicle.images' => fn ($q) => $q->where('is_primary', true)->with('attachment'),
            'customer', 'pickupLocation', 'returnLocation', 'pricing', 'securityDeposit',
            'statusHistories' => fn ($q) => $q->latest(), 'inspections', 'damages', 'payments.proof',
        ]);
    }

    public function accept(Booking $booking): JsonResponse
    {
        $this->authorize('respond', $booking);

        $booking = $this->transitions->accept($booking, AuthUser::id());

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'confirmed']);

        $message = $booking->payment_method === Booking::METHOD_BANK_TRANSFER
            ? 'Booking confirmed — the customer will transfer to your bank account'
            : 'Booking confirmed — the customer pays you in cash at pickup';

        return $this->response($message, new BookingResource($booking));
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

    public function verifyTransfer(Booking $booking, Payment $payment): JsonResponse
    {
        $this->authorize('reviewTransfer', $booking);

        $payment = $this->transfers->verify($booking, $payment, AuthUser::id());

        AuditService::edit('Payment', $payment->id, $payment->payment_reference, ['status' => 'pending'], ['status' => 'succeeded']);

        return $this->response('Transfer verified', new BookingResource($this->loadDetail($booking->fresh())));
    }

    public function rejectTransfer(RejectBookingRequest $request, Booking $booking, Payment $payment): JsonResponse
    {
        $this->authorize('reviewTransfer', $booking);

        $payment = $this->transfers->reject($booking, $payment, AuthUser::id(), $request->validated('reason'));

        AuditService::edit('Payment', $payment->id, $payment->payment_reference, ['status' => 'pending'], ['status' => 'failed', 'reason' => $request->validated('reason')]);

        return $this->response('Transfer rejected — the customer can upload a new receipt', new BookingResource($this->loadDetail($booking->fresh())));
    }

    /** What changing the dates would do (price, balance, whether the dates are free) - nothing is saved. */
    public function previewReschedule(RescheduleBookingRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('reschedule', $booking);

        $preview = $this->transitions->previewReschedule(
            $booking,
            Carbon::parse($request->validated('pickup_at')),
            Carbon::parse($request->validated('return_at')),
        );

        return $this->response('Reschedule preview', [
            'available' => $preview['available'],
            'conflict' => $preview['conflict'],
            'rental_days' => $preview['rental_days'],
            'current_total' => (float) $booking->pricing->total_payable,
            'new_total' => $preview['total_payable'],
            'amount_paid' => $preview['amount_paid'],
            'balance_due' => $preview['balance_due'],
            'overpaid' => $preview['overpaid'],
        ]);
    }

    public function reschedule(RescheduleBookingRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('reschedule', $booking);

        $old = ['pickup_at' => $booking->pickup_at?->toISOString(), 'return_at' => $booking->return_at?->toISOString()];
        $booking = $this->transitions->reschedule(
            $booking,
            AuthUser::id(),
            Carbon::parse($request->validated('pickup_at')),
            Carbon::parse($request->validated('return_at')),
            $request->validated('reason'),
        );

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, $old, [
            'pickup_at' => $booking->pickup_at->toISOString(), 'return_at' => $booking->return_at->toISOString(),
        ]);

        return $this->response('Booking dates changed', new BookingResource($this->loadDetail($booking)));
    }

    public function recordPayment(RecordPaymentRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('recordPayment', $booking);

        $payment = $this->transfers->recordByShop(
            $booking,
            AuthUser::id(),
            $request->validated('method'),
            (float) $request->validated('amount'),
            $request->validated('paid_at'),
            $request->validated('reference'),
            $request->file('proof'),
        );

        AuditService::create('Payment', $payment->id, $payment->payment_reference);

        return $this->response('Payment recorded', new BookingResource($this->loadDetail($booking->fresh())), 201);
    }

    /** The same booking voucher the customer gets - for staff to print or check at the counter. ?download=1 saves it. */
    public function voucher(Request $request, Booking $booking): Response
    {
        $this->authorize('view', $booking);
        abort_unless(in_array($booking->status, [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true), 422, 'The voucher is available once the booking is confirmed.');

        $booking->load(['vehicle', 'shop', 'customer', 'pricing', 'payments', 'pickupLocation', 'returnLocation']);

        $pdf = Pdf::loadView('pdf.booking-confirmation', [
            'booking' => $booking,
            'shop' => $booking->shop,
            'customer' => $booking->customer,
            'vehicle' => $booking->vehicle,
            'pricing' => $booking->pricing,
        ])->setPaper('a4');

        $filename = "booking-{$booking->booking_reference}.pdf";

        return $request->boolean('download') ? $pdf->download($filename) : $pdf->stream($filename);
    }

    /** The customer's uploaded receipt, streamed from the private disk. */
    public function transferProof(Booking $booking, Payment $payment): StreamedResponse
    {
        $this->authorize('view', $booking);
        abort_unless($payment->booking_id === $booking->id && $payment->proof, 404);

        return Storage::disk($payment->proof->disk)->response($payment->proof->file_path, $payment->proof->file_name);
    }

    public function handover(InspectionRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('conductHandover', $booking);

        $booking = $this->transitions->handover(
            $booking,
            AuthUser::id(),
            $request->safe()->except(self::NON_INSPECTION_FIELDS),
            $request->boolean('cash_received'),
        );

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'active']);

        return $this->response('Handover recorded — booking is now active', new BookingResource($booking));
    }

    public function return(InspectionRequest $request, Booking $booking): JsonResponse
    {
        $this->authorize('conductReturn', $booking);
        if (!empty($request->validated('damages'))) {
            $this->authorize('recordDamage', $booking);
        }

        $booking = $this->transitions->returnVehicle(
            $booking,
            AuthUser::id(),
            $request->safe()->except(self::NON_INSPECTION_FIELDS),
            $request->validated('damages', []),
            $request->filled('deposit_deduction') ? (float) $request->validated('deposit_deduction') : null,
            $request->validated('deposit_deduction_reason'),
        );

        AuditService::edit('Booking', $booking->id, $booking->booking_reference, null, ['status' => 'completed']);

        return $this->response('Return recorded — booking completed', new BookingResource($booking));
    }
}
