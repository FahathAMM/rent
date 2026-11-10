<?php

namespace App\Http\Middleware;

use App\Models\SystemAdmin;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locks the Log Viewer (opcodesio/log-viewer, config/log-viewer.php) down to
 * the platform owner set in LOG_VIEWER_OWNER_EMAIL — everyone else gets a
 * 403, regardless of role, and so does everyone when it isn't set.
 *
 * Runs on BOTH the viewer page and its API (config/log-viewer.php's
 * `middleware` and `api_middleware`) — the API lists, reads, downloads and
 * deletes log files, so it must never be left open.
 *
 * The initial page load is opened with `?token=<platform bearer token>`
 * (see PlatformSidebar.jsx); once verified, that authorization is
 * remembered in the session so the viewer's own AJAX calls (which don't know
 * about our `token` param) keep working without it.
 */
class RestrictLogViewerToOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        $ownerEmail = config('log-viewer.owner_email');
        abort_unless($ownerEmail, 403, 'Only the platform owner can access the Log Viewer.');

        // On the API middleware stack, EnsureFrontendRequestsAreStateful only
        // starts a session when it recognizes the request's Referer/Origin as
        // a trusted frontend (log-viewer.api_stateful_domains) — for any
        // other request, no session store exists on $request at all, and
        // calling ->session() would throw rather than just failing the auth
        // check. hasSession() lets that case fall straight through to the
        // token check below instead of 500ing.
        if ($request->hasSession() && $request->session()->get('log_viewer_owner_email') === $ownerEmail) {
            return $next($request);
        }

        $token = $request->query('token') ?: $request->bearerToken();
        $accessToken = $token ? PersonalAccessToken::findToken($token) : null;
        $admin = $accessToken?->tokenable;

        // findToken() alone ignores expiry — an expired or deactivated admin's token must not open the viewer.
        $valid = $accessToken
            && (!$accessToken->expires_at || $accessToken->expires_at->isFuture())
            && $admin instanceof SystemAdmin
            && $admin->isActive()
            && $admin->email === $ownerEmail;

        if ($valid) {
            if ($request->hasSession()) {
                $request->session()->regenerate();
                $request->session()->put('log_viewer_owner_email', $admin->email);
            }

            return $next($request);
        }

        abort(403, 'Only the platform owner can access the Log Viewer.');
    }
}
