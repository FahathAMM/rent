<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\DisputeMessageRequest;
use App\Http\Requests\Platform\ResolveDisputeRequest;
use App\Models\Dispute;
use App\Models\SystemAdmin;
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
        $disputes = Dispute::with(['booking:id,booking_reference,shop_id', 'raisedBy:id,name', 'assignedTo:id,name'])
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->priority, fn ($q) => $q->where('priority', $request->priority))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $disputes, 'message' => 'Disputes retrieved', 'status' => true]);
    }

    public function show(string $reference): JsonResponse
    {
        $dispute = Dispute::where('dispute_reference', $reference)
            ->with(['booking', 'raisedBy:id,name', 'assignedTo:id,name', 'resolvedBy:id,name'])
            ->first();
        abort_unless($dispute, 404);

        $dispute->setRelation('messages', $dispute->messages()->orderBy('created_at')->get());

        return $this->response('Dispute retrieved', $dispute);
    }

    public function assign(Request $request, Dispute $dispute): JsonResponse
    {
        return $this->response('Dispute assigned', $this->service->assign($this->admin(), $dispute, $request->integer('assigned_to') ?: null));
    }

    public function resolve(ResolveDisputeRequest $request, Dispute $dispute): JsonResponse
    {
        return $this->response('Dispute resolved', $this->service->resolve($this->admin(), $dispute, $request->validated()));
    }

    public function addMessage(DisputeMessageRequest $request, Dispute $dispute): JsonResponse
    {
        $admin = $this->admin();

        $message = $this->service->addMessage(
            $dispute,
            authorType: 'system_admin',
            authorId: $admin->id,
            message: $request->validated('message'),
            isInternal: (bool) $request->validated('is_internal', false),
        );

        return $this->response('Message posted', $message, 201);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
