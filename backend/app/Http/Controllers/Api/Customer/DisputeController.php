<?php

namespace App\Http\Controllers\Api\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dispute\AddDisputeMessageRequest;
use App\Http\Requests\Dispute\StoreCustomerDisputeRequest;
use App\Http\Resources\Customer\CustomerDisputeResource;
use App\Models\Customer;
use App\Models\Dispute;
use App\Queries\CustomerDisputeQuery;
use App\Services\AuditService;
use App\Services\DisputeService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DisputeController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private DisputeService $service) {}

    public function index(Request $request): JsonResponse
    {
        $disputes = CustomerDisputeQuery::forCustomer($request->user('customer')->id)
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('per_page', 10), 50));
        $disputes->through(fn ($dispute) => (new CustomerDisputeResource($dispute))->resolve());

        return response()->json(['record' => $disputes, 'message' => 'Disputes retrieved', 'status' => true]);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $dispute = CustomerDisputeQuery::findForCustomer($request->user('customer')->id, $reference);
        abort_unless($dispute, 404);
        $dispute->setRelation('messages', $dispute->messages()->where('is_internal', false)->orderBy('created_at')->get());

        return $this->response('Dispute retrieved', (new CustomerDisputeResource($dispute))->resolve());
    }

    public function store(StoreCustomerDisputeRequest $request): JsonResponse
    {
        $customer = $request->user('customer');
        $booking = CustomerDisputeQuery::findBooking($request->validated('booking_reference'));
        abort_unless($booking && (int) $booking->customer_id === (int) $customer->id, 404, 'Booking not found.');

        $dispute = $this->service->createForCustomer(
            $customer,
            $booking,
            $request->safe()->except('booking_reference'),
        );

        AuditService::create('Dispute', $dispute->id, "Dispute for {$booking->booking_reference}");

        return $this->response('Dispute submitted', $dispute, 201);
    }

    public function addMessage(AddDisputeMessageRequest $request, string $reference): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user('customer');
        $dispute = CustomerDisputeQuery::findForCustomer($customer->id, $reference);
        abort_unless($dispute, 404);
        abort_if(in_array($dispute->status, [Dispute::STATUS_RESOLVED, Dispute::STATUS_CLOSED], true), 422, 'This dispute is closed.');

        $message = $this->service->addMessage(
            $dispute,
            authorType: 'customer',
            authorId: $customer->id,
            message: $request->validated('message'),
            posterSide: 'customer',
        );

        return $this->response('Message posted', $message, 201);
    }
}
