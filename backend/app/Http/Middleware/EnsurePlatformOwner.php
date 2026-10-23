<?php

namespace App\Http\Middleware;

use App\Models\SystemAdmin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to the Platform Owner role — e.g. managing other
 * platform admin accounts. Always runs after EnsurePlatformAdmin, which has
 * already guaranteed an active SystemAdmin is authenticated.
 */
class EnsurePlatformOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        if (!$admin->isOwner()) {
            return response()->json(['message' => 'Only the Platform Owner can perform this action.'], 403);
        }

        return $next($request);
    }
}
