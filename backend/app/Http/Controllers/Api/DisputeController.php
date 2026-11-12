<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dispute\AddDisputeMessageRequest;
use App\Http\Requests\Dispute\StoreDisputeRequest;
use App\Models\Dispute;
use App\Queries\CustomerDisputeQuery;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\DisputeService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Shop owners and staff raise and read disputes through the marketplace
 * user guard. Customer identities use the separate customer-guard
 * controller; both paths share the dispute service and ownership query.
 */
class DisputeController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private DisputeService $service) {}

    public function index(Request $request): JsonResponse
    {
        $disputes = CustomerDisputeQuery::forUser(AuthUser::id())
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('per_page', 10), 50));

        return response()->json(['record' => $disputes, 'message' => 'Disputes retrieved', 'status' => true]);
    }

    public function show(string $reference): JsonResponse
    {
        $dispute = CustomerDisputeQuery::findByReference($reference);
        abort_unless($dispute, 404);

        $side = CustomerDisputeQuery::resolveSide(AuthUser::id(), $dispute->booking);
        abort_unless($side !== null, 404);

        $dispute->setRelation('messages', $dispute->messages()->where('is_internal', false)->orderBy('created_at')->get());

        return $this->response('Dispute retrieved', $dispute);
    }

    public function store(StoreDisputeRequest $request): JsonResponse
    {
        $booking = CustomerDisputeQuery::findBooking($request->validated('booking_reference'));
        abort_unless($booking, 404, 'Booking not found.');

        $side = CustomerDisputeQuery::resolveSide(AuthUser::id(), $booking);
        abort_unless($side !== null, 403, 'This booking does not belong to you.');

        $dispute = $this->service->create(
            AuthUser::user(),
            $booking,
            $side,
            $request->safe()->except('booking_reference'),
        );

        AuditService::create('Dispute', $dispute->id, "Dispute for {$booking->booking_reference}");

        return $this->response('Dispute submitted', $dispute, 201);
    }

    public function addMessage(AddDisputeMessageRequest $request, string $reference): JsonResponse
    {
        $dispute = CustomerDisputeQuery::findByReference($reference);
        abort_unless($dispute, 404);

        $side = CustomerDisputeQuery::resolveSide(AuthUser::id(), $dispute->booking);
        abort_unless($side !== null, 404);
        // Same rule as the customer side: a finished dispute takes no more messages.
        abort_if(in_array($dispute->status, [Dispute::STATUS_RESOLVED, Dispute::STATUS_CLOSED], true), 422, 'This dispute is closed.');

        $message = $this->service->addMessage(
            $dispute,
            authorType: $side === 'customer' ? 'customer' : $side,
            authorId: AuthUser::id(),
            message: $request->validated('message'),
            posterSide: $side,
        );

        AuditService::edit('Dispute', $dispute->id, "Dispute for {$dispute->booking->booking_reference}", null, ['message' => 'posted', 'side' => $side]);

        return $this->response('Message posted', $message, 201);
    }
}
