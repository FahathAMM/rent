<?php

namespace App\Http\Middleware;

use App\Models\SystemAdmin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The single gate for every /api/platform/* route (besides login).
 *
 * Deliberately does not trust guard resolution alone: it re-checks that the
 * resolved principal is actually a SystemAdmin instance and is active, so a
 * misconfiguration of the `platform` guard can never silently let a company
 * user through. This is the explicit, code-level check the platform area's
 * security requirements call for — never a request parameter.
 */
class EnsurePlatformAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $admin = auth('platform')->user();

        if (!$admin instanceof SystemAdmin) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$admin->isActive()) {
            return response()->json(['message' => 'Your platform admin account has been deactivated.'], 403);
        }

        return $next($request);
    }
}
