<?php

namespace App\Http\Middleware;

use App\Models\SubscriptionPlan;
use App\Services\SubscriptionService;
use App\Support\VendorContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `plan.feature:calendar` — the active shop's plan must include the feature.
 * Runs after shop.context. 403 with `code: plan_feature` so the vendor app
 * can show an upgrade prompt instead of a generic error.
 */
class EnsurePlanFeature
{
    public function __construct(private SubscriptionService $subscriptions) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $shopId = VendorContext::shopId();
        if ($shopId && !$this->subscriptions->hasFeature($shopId, $feature)) {
            $plan = $this->subscriptions->plan($shopId);
            $label = SubscriptionPlan::FEATURES[$feature] ?? $feature;

            return response()->json([
                'message' => "{$label} isn't included in your {$plan->name} plan. Upgrade in Settings → Subscription.",
                'code' => 'plan_feature',
                'feature' => $feature,
            ], 403);
        }

        return $next($request);
    }
}
