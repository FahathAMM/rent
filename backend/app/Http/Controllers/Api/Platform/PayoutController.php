<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\MarkPayoutPaidRequest;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\OwnerPayout;
use App\Models\SystemAdmin;
use App\Services\PayoutService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Finance oversight of the manual payout cycle — see
 * app-doc/marketplace/04-lifecycles.md "Payout cycle". build() is also
 * reachable manually here (not only via the daily payouts:build-cycle
 * sweep) so finance doesn't have to wait a full day to settle a shop
 * that just crossed its threshold.
 */
class PayoutController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private PayoutService $service) {}

    public function index(Request $request): JsonResponse
    {
        $payouts = OwnerPayout::with('shop:id,name', 'bankDetail')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->shop_id, fn ($q) => $q->where('shop_id', $request->shop_id))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $payouts, 'message' => 'Payouts retrieved', 'status' => true]);
    }

    public function show(OwnerPayout $payout): JsonResponse
    {
        $payout->load('shop:id,name,owner_user_id', 'shop.owner:id,name,email', 'bankDetail', 'items.booking:id,booking_reference');

        return $this->response('Payout retrieved', $payout);
    }

    public function build(): JsonResponse
    {
        $created = $this->service->buildCycle();

        return $this->response(count($created) . ' payout(s) built', $created);
    }

    public function approve(OwnerPayout $payout): JsonResponse
    {
        return $this->response('Payout approved', $this->service->approve($this->admin(), $payout));
    }

    public function markProcessing(OwnerPayout $payout): JsonResponse
    {
        return $this->response('Payout marked processing', $this->service->markProcessing($this->admin(), $payout));
    }

    public function markPaid(MarkPayoutPaidRequest $request, OwnerPayout $payout): JsonResponse
    {
        $result = $this->service->markPaid(
            $this->admin(),
            $payout,
            $request->validated('evidence_attachment_id'),
            $request->validated('evidence_reference'),
        );

        return $this->response('Payout marked paid', $result);
    }

    public function markFailed(ReasonRequest $request, OwnerPayout $payout): JsonResponse
    {
        return $this->response('Payout marked failed', $this->service->markFailed($this->admin(), $payout, $request->validated('reason')));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
