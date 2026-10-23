<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks a route group when the company's current plan disables the given
 * module (e.g. 'accounting') — see SubscriptionService::hasModule(). Platform
 * users (no company_id) are never affected.
 */
class EnsureModuleEnabled
{
    public function handle(Request $request, Closure $next, string $module): Response
    {
        $user = AuthUser::user();

        if (!$user?->company_id) {
            return $next($request);
        }

        if (!app(SubscriptionService::class)->hasModule($user->company, $module)) {
            return response()->json([
                'message' => 'This module is not included in your plan.',
            ], 403);
        }

        return $next($request);
    }
}
