<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\CompleteRefundRequest;
use App\Http\Requests\Platform\ReasonRequest;
use App\Http\Requests\Platform\StoreRefundRequest;
use App\Models\Booking;
use App\Models\Refund;
use App\Models\SystemAdmin;
use App\Services\AuditService;
use App\Services\RefundService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefundController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private RefundService $service) {}

    public function index(Request $request): JsonResponse
    {
        $refunds = Refund::with('booking:id,booking_reference,shop_id,customer_id', 'requestedBy:id,name', 'approvedBy:id,name')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $refunds, 'message' => 'Refunds retrieved', 'status' => true]);
    }

    public function show(Refund $refund): JsonResponse
    {
        $refund->load('booking.shop:id,name', 'booking.customer:id,name,email', 'requestedBy:id,name', 'approvedBy:id,name');

        return $this->response('Refund retrieved', $refund);
    }

    public function store(StoreRefundRequest $request): JsonResponse
    {
        $booking = Booking::where('booking_reference', $request->validated('booking_reference'))->first();
        abort_unless($booking, 404);

        $refund = $this->service->create($booking, $request->safe()->except('booking_reference'));

        AuditService::create('Refund', $refund->id, "Refund for {$booking->booking_reference}");

        return $this->response('Refund recorded', $refund, 201);
    }

    public function approve(Refund $refund): JsonResponse
    {
        return $this->response('Refund approved', $this->service->approve($this->admin(), $refund));
    }

    public function reject(ReasonRequest $request, Refund $refund): JsonResponse
    {
        return $this->response('Refund rejected', $this->service->reject($this->admin(), $refund, $request->validated('reason')));
    }

    public function complete(CompleteRefundRequest $request, Refund $refund): JsonResponse
    {
        return $this->response('Refund marked complete', $this->service->complete($this->admin(), $refund, $request->validated()));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
