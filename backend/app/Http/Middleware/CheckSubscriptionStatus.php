<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locks a tenant to read-only once its subscription is no longer in good
 * standing (trial expired, cancelled, past due, or missing) — reads still
 * work everywhere so the company can see its own data and go upgrade, but
 * every state-changing request outside auth/subscription/plans is refused.
 * Platform users (no company_id — super-admin) are never affected.
 */
class CheckSubscriptionStatus
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = AuthUser::user();

        if (!$user?->company_id || $request->isMethodSafe()) {
            return $next($request);
        }

        if ($request->is('api/auth/*', 'api/subscription*', 'api/plans')) {
            return $next($request);
        }

        if (app(SubscriptionService::class)->isBlocked($user->company)) {
            return response()->json([
                'message'               => 'Your subscription is no longer active. Upgrade your plan to continue.',
                'subscription_expired'  => true,
            ], 402);
        }

        return $next($request);
    }
}
