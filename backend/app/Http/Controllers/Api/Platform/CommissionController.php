<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreCommissionRequest;
use App\Http\Requests\Platform\UpdateCommissionRequest;
use App\Models\PlatformCommission;
use App\Models\SystemAdmin;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Commission rules — see app-doc/marketplace/04-lifecycles.md
 * "Commission model": the resolved rule's id/rate/amount freeze into
 * booking_financials at confirmation, so editing or deleting a rule
 * here never re-prices a booking that already confirmed. No delete
 * guard is needed the way CategoryController needs one for vehicles —
 * there is nothing a commission rule "owns" that would be orphaned.
 */
class CommissionController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $commissions = PlatformCommission::with('createdBy:id,name')
            ->when($request->scope_type, fn ($q) => $q->where('scope_type', $request->scope_type))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderByDesc('priority')
            ->orderByDesc('effective_from')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $commissions, 'message' => 'Commission rules retrieved', 'status' => true]);
    }

    public function store(StoreCommissionRequest $request): JsonResponse
    {
        $commission = PlatformCommission::create($request->validated() + ['created_by' => $this->admin()->id]);

        AuditService::create('PlatformCommission', $commission->id, $commission->name);

        return $this->response('Commission rule created', $commission, 201);
    }

    public function show(PlatformCommission $commission): JsonResponse
    {
        return $this->response('Commission rule retrieved', $commission->load('createdBy:id,name'));
    }

    public function update(UpdateCommissionRequest $request, PlatformCommission $commission): JsonResponse
    {
        $commission->update($request->validated());

        AuditService::edit('PlatformCommission', $commission->id, $commission->name);

        return $this->response('Commission rule updated', $commission->fresh());
    }

    public function destroy(PlatformCommission $commission): JsonResponse
    {
        $commission->delete();
        AuditService::delete('PlatformCommission', $commission->id, $commission->name);

        return $this->response('Commission rule deleted');
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
