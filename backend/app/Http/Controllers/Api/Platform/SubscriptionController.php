<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Models\RentalShop;
use App\Models\ShopSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Platform side of shop plans — app-doc/marketplace/10-monetization.md:
 * plans (owner edits), subscription settings (owner edits), shops' payments
 * to verify, and granting a plan to one shop.
 */
class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    // ── Overview ───────────────────────────────────────────────────────────

    /** Numbers for the Subscriptions page header. Plan state is worked out per verified shop (no stored status). */
    public function stats(): JsonResponse
    {
        $byState = ['trial' => 0, 'active' => 0, 'grace' => 0, 'unpaid' => 0];
        $byPlan = [];
        $trialsEndingSoon = 0;
        foreach (RentalShop::where('verification_status', RentalShop::VERIFICATION_VERIFIED)->pluck('id') as $shopId) {
            $current = $this->subscriptions->current($shopId);
            $byState[$current['state']]++;
            if (in_array($current['state'], ['active', 'grace'], true)) {
                $byPlan[$current['plan']->name] = ($byPlan[$current['plan']->name] ?? 0) + 1;
            }
            if ($current['state'] === 'trial' && $current['ends_at']->lessThanOrEqualTo(now()->addDays(7))) {
                $trialsEndingSoon++;
            }
        }

        $pending = SubscriptionPayment::where('status', SubscriptionPayment::STATUS_PENDING);
        $month = SubscriptionPayment::where('status', SubscriptionPayment::STATUS_APPROVED)->where('reviewed_at', '>=', now()->startOfMonth());

        return response()->json(['data' => [
            'pending' => ['count' => (clone $pending)->count(), 'amount' => (float) (clone $pending)->sum('amount')],
            'this_month' => ['count' => (clone $month)->count(), 'amount' => (float) (clone $month)->sum('amount')],
            'shops' => $byState + ['trials_ending_soon' => $trialsEndingSoon],
            'paying_by_plan' => $byPlan,
        ]]);
    }

    // ── Plans ──────────────────────────────────────────────────────────────

    public function plans(): JsonResponse
    {
        return response()->json(['data' => [
            'plans' => SubscriptionPlan::orderBy('sort_order')->get()->map(fn ($p) => $this->subscriptions->presentPlan($p))->values(),
            'features' => SubscriptionPlan::FEATURES,
        ]]);
    }

    public function storePlan(Request $request): JsonResponse
    {
        $plan = SubscriptionPlan::create($this->validatePlan($request));

        return response()->json(['message' => 'Plan created', 'data' => $this->subscriptions->presentPlan($plan)], 201);
    }

    public function updatePlan(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $plan->update($this->validatePlan($request, $plan));

        return response()->json(['message' => 'Plan saved', 'data' => $this->subscriptions->presentPlan($plan->fresh())]);
    }

    private function validatePlan(Request $request, ?SubscriptionPlan $plan = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40', 'alpha_dash', Rule::notIn([SubscriptionPlan::NONE]), Rule::unique('subscription_plans', 'code')->ignore($plan?->id)],
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'period_days' => ['required', 'integer', 'min:1', 'max:3660'],
            'max_vehicles' => ['nullable', 'integer', 'min:0'],
            'max_sale_listings' => ['nullable', 'integer', 'min:0'],
            'max_staff' => ['nullable', 'integer', 'min:0'],
            'max_locations' => ['nullable', 'integer', 'min:0'],
            'features' => ['array'],
            'features.*' => [Rule::in(array_keys(SubscriptionPlan::FEATURES))],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['features'] = array_values(array_unique($data['features'] ?? []));
        $data['sort_order'] ??= 0;

        return $data;
    }

    // ── Settings ───────────────────────────────────────────────────────────

    public function settings(): JsonResponse
    {
        return response()->json(['data' => [
            'trial_plan' => PlatformSetting::get('subscription_trial_plan', 'pro'),
            'trial_days' => (int) PlatformSetting::get('subscription_trial_days', 30),
            'grace_days' => $this->subscriptions->graceDays(),
            'bank' => $this->subscriptions->bankDetails(),
        ]]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_plan' => ['required', 'string', 'exists:subscription_plans,code'],
            'trial_days' => ['required', 'integer', 'min:0', 'max:365'],
            'grace_days' => ['required', 'integer', 'min:0', 'max:90'],
            'bank' => ['array'],
            'bank.bank_name' => ['nullable', 'string', 'max:120'],
            'bank.branch' => ['nullable', 'string', 'max:120'],
            'bank.account_name' => ['nullable', 'string', 'max:120'],
            'bank.account_number' => ['nullable', 'string', 'max:60'],
            'bank.instructions' => ['nullable', 'string', 'max:500'],
        ]);

        $bank = array_map(fn ($v) => $v ?? '', array_intersect_key($data['bank'] ?? [], array_flip(['bank_name', 'branch', 'account_name', 'account_number', 'instructions'])));
        foreach (['subscription_trial_plan' => $data['trial_plan'], 'subscription_trial_days' => $data['trial_days'], 'subscription_grace_days' => $data['grace_days'], 'subscription_bank_details' => $bank] as $key => $value) {
            PlatformSetting::updateOrCreate(['key' => $key], ['value' => ['value' => $value], 'group' => 'subscriptions', 'updated_by' => $this->admin()->id]);
        }

        return $this->settings();
    }

    // ── Payments ───────────────────────────────────────────────────────────

    public function payments(Request $request): JsonResponse
    {
        $payments = SubscriptionPayment::with(['shop:id,name,slug', 'plan:id,name', 'submitter:id,name,email', 'reviewer:id,name'])
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where(fn ($w) => $w
                ->where('reference_no', 'like', "%{$request->search}%")
                ->orWhere('bank_reference', 'like', "%{$request->search}%")
                ->orWhereHas('shop', fn ($s) => $s->where('name', 'like', "%{$request->search}%"))))
            ->orderByRaw("status = 'pending' desc")->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $payments, 'message' => 'Subscription payments retrieved', 'status' => true]);
    }

    public function approve(SubscriptionPayment $payment): JsonResponse
    {
        return response()->json(['message' => 'Payment approved — plan updated', 'data' => $this->subscriptions->approvePayment($this->admin(), $payment->load('plan'))]);
    }

    public function reject(Request $request, SubscriptionPayment $payment): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'max:255']])['reason'];

        return response()->json(['message' => 'Payment rejected', 'data' => $this->subscriptions->rejectPayment($this->admin(), $payment, $reason)]);
    }

    public function proof(SubscriptionPayment $payment): StreamedResponse
    {
        abort_unless($payment->proof, 404);

        return Storage::disk($payment->proof->disk)->response($payment->proof->file_path, $payment->proof->file_name);
    }

    // ── One shop ───────────────────────────────────────────────────────────

    public function shop(RentalShop $rentalShop): JsonResponse
    {
        return response()->json(['data' => [
            'current' => $this->subscriptions->summary($rentalShop->id),
            'history' => ShopSubscription::with('plan:id,name', 'createdBy:id,name')->where('shop_id', $rentalShop->id)->orderByDesc('starts_at')->limit(30)->get()
                ->map(fn (ShopSubscription $s) => [
                    'id' => $s->id, 'plan' => $s->plan?->name, 'kind' => $s->kind, 'note' => $s->note,
                    'starts_at' => $s->starts_at?->toIso8601String(), 'ends_at' => $s->ends_at?->toIso8601String(), 'by' => $s->createdBy?->name,
                ])->values(),
        ]]);
    }

    /**
     * Give a shop a plan until a date (a deal, a comp, a manual renewal, a trial
     * extension) — or shorten the one running. See SubscriptionService::setPlanUntil().
     * `ends_at` is a calendar date; the plan runs to the end of that day.
     */
    public function grant(Request $request, RentalShop $rentalShop): JsonResponse
    {
        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:subscription_plans,id'],
            'ends_at' => ['required', 'date_format:Y-m-d', 'after_or_equal:' . now()->toDateString(), 'before:' . now()->addYears(10)->toDateString()],
            'note' => ['nullable', 'string', 'max:255'],
            // Only used when the plan starts today (another plan / grace / unpaid) — saves it as a free trial.
            'trial' => ['boolean'],
        ]);

        $endsAt = Carbon::createFromFormat('Y-m-d', $data['ends_at'])->endOfDay();
        $result = $this->subscriptions->setPlanUntil($rentalShop->id, SubscriptionPlan::findOrFail($data['plan_id']), $endsAt, $data['note'] ?? null, $this->admin()->id, (bool) ($data['trial'] ?? false));

        return response()->json(['message' => match ($result['change']) {
            'extended' => "Plan extended by {$result['days']} days",
            'reduced' => 'Plan shortened by ' . abs($result['days']) . ' days',
            'unchanged' => 'End date unchanged',
            default => $result['subscription']->kind === ShopSubscription::KIND_TRIAL ? 'Free trial started' : 'Plan granted',
        }, 'data' => $this->shop($rentalShop)->getData(true)['data']]);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
