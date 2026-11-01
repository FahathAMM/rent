<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use App\Support\VendorContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An unpaid shop (no trial / paid / granted plan running, grace over) has its
 * vendor workspace locked: every vendor route answers 403 `code:
 * subscription_required` except the subscription endpoints, so the owner can
 * still see the plans and send a payment. Its listings stay live for customers.
 */
class EnsureSubscriptionActive
{
    /** Paths (under /api) that stay open while locked. */
    private const OPEN = ['vendor/subscription', 'vendor/subscription/*'];

    public function __construct(private SubscriptionService $subscriptions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $shopId = VendorContext::shopId();
        if (!$shopId || $request->is(...array_map(fn ($p) => "api/{$p}", self::OPEN))) {
            return $next($request);
        }

        if ($this->subscriptions->isLocked($shopId)) {
            return response()->json([
                'message' => "Your shop's subscription has ended. Renew it in Settings → Subscription to keep using the vendor workspace.",
                'code' => 'subscription_required',
            ], 403);
        }

        return $next($request);
    }
}
