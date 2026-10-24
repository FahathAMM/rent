<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only — payments are only ever written by PaymentService/PayHereWebhookController. */
class PaymentController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with('booking:id,booking_reference,shop_id,customer_id')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->gateway, fn ($q) => $q->where('gateway', $request->gateway))
            ->when($request->date_from, fn ($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn ($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $payments, 'message' => 'Payments retrieved', 'status' => true]);
    }

    public function show(Payment $payment): JsonResponse
    {
        $payment->load('booking.shop:id,name', 'booking.customer:id,name,email', 'refunds');

        return $this->response('Payment retrieved', $payment);
    }
}
