<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\RentalShop;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\SubscriptionService;
use App\Support\VendorContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The shop's plan. `summary` is open to anyone in the shop (the vendor app
 * uses it to lock features the plan doesn't include); the plans page and
 * paying are owner-only (vendor-subscription-*, an owner-only area).
 */
class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
        $this->middleware('can:vendor-subscription-view')->only(['index', 'proof']);
        $this->middleware('can:vendor-subscription-create')->only('pay');
    }

    public function summary(): JsonResponse
    {
        return response()->json(['data' => $this->subscriptions->summary(VendorContext::shopId())]);
    }

    /** Current plan, every plan to choose from, where to pay, and past payments. */
    public function index(): JsonResponse
    {
        $shopId = VendorContext::shopId();

        return response()->json(['data' => [
            'current' => $this->subscriptions->summary($shopId),
            'plans' => SubscriptionPlan::where('is_active', true)->orderBy('sort_order')->get()
                ->map(fn ($plan) => $this->subscriptions->presentPlan($plan))->values(),
            'features' => SubscriptionPlan::FEATURES,
            'bank' => $this->subscriptions->bankDetails(),
            'payments' => SubscriptionPayment::with('plan:id,name')->where('shop_id', $shopId)->latest()->limit(50)->get()
                ->map(fn (SubscriptionPayment $p) => $this->presentPayment($p))->values(),
        ]]);
    }

    public function pay(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:subscription_plans,id'],
            'periods' => ['required', 'integer', 'min:1', 'max:24'],
            'bank_reference' => ['nullable', 'string', 'max:120'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ]);

        $payment = $this->subscriptions->submitPayment(
            RentalShop::findOrFail(VendorContext::shopId()), AuthUser::user(),
            SubscriptionPlan::findOrFail($data['plan_id']), (int) $data['periods'], $data['bank_reference'] ?? null, $request->file('proof'),
        );

        AuditService::create('SubscriptionPayment', $payment->id, $payment->reference_no, [
            'plan_id' => (int) $data['plan_id'], 'periods' => (int) $data['periods'], 'bank_reference' => $data['bank_reference'] ?? null, 'status' => $payment->status,
        ]);

        return response()->json(['message' => 'Payment sent — the platform will confirm it shortly', 'data' => $this->presentPayment($payment->load('plan:id,name'))], 201);
    }

    public function proof(SubscriptionPayment $payment): StreamedResponse
    {
        abort_unless($payment->shop_id === VendorContext::shopId() && $payment->proof, 404);

        return Storage::disk($payment->proof->disk)->response($payment->proof->file_path, $payment->proof->file_name);
    }

    private function presentPayment(SubscriptionPayment $p): array
    {
        return [
            'id' => $p->id, 'reference_no' => $p->reference_no, 'plan' => $p->plan?->name, 'periods' => $p->periods,
            'amount' => (float) $p->amount, 'bank_reference' => $p->bank_reference, 'status' => $p->status,
            'reject_reason' => $p->reject_reason, 'created_at' => $p->created_at?->toIso8601String(), 'reviewed_at' => $p->reviewed_at?->toIso8601String(),
        ];
    }
}
