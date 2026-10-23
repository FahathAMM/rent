<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A company freshly created via public sign-up starts as `initiate` — locked
 * out of the app entirely until a Platform Admin activates it (existing
 * Platform\CompanyController@activate flow). Only the handful of endpoints
 * the frontend's account-pending page itself needs stay reachable; everything
 * else gets a 403 the axios interceptor turns into a redirect there.
 */
class EnsureCompanyActivated
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = AuthUser::user();

        if (!$user?->company_id || $user->company?->status !== 'initiate') {
            return $next($request);
        }

        if ($request->is('api/auth/*', 'api/company', 'api/subscription', 'api/plans')) {
            return $next($request);
        }

        return response()->json([
            'message'         => 'Your account is being set up. We will notify you once it is ready.',
            'company_pending' => true,
        ], 403);
    }
}
