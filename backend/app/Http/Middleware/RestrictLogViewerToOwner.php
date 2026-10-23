<?php

namespace App\Http\Middleware;

use App\Models\SystemAdmin;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locks the Log Viewer (opcodesio/log-viewer, config/log-viewer.php) down to
 * a single hardcoded platform owner — everyone else gets a 403, regardless
 * of role. The initial page load is opened with `?token=<platform bearer
 * token>` (see PlatformSidebar.jsx); once verified, that authorization is
 * remembered in the session so the viewer's own AJAX calls (which don't know
 * about our `token` param) keep working without it.
 */
class RestrictLogViewerToOwner
{
    private const ALLOWED_EMAIL = 'fahathammex90@gmail.com';

    public function handle(Request $request, Closure $next): Response
    {
        // On the API middleware stack, EnsureFrontendRequestsAreStateful only
        // starts a session when it recognizes the request's Referer/Origin as
        // a trusted frontend (log-viewer.api_stateful_domains) — for any
        // other request, no session store exists on $request at all, and
        // calling ->session() would throw rather than just failing the auth
        // check. hasSession() lets that case fall straight through to the
        // token check below instead of 500ing.
        if ($request->hasSession() && $request->session()->get('log_viewer_owner_email') === self::ALLOWED_EMAIL) {
            return $next($request);
        }

        $token = $request->query('token') ?: $request->bearerToken();
        $admin = $token ? PersonalAccessToken::findToken($token)?->tokenable : null;

        if ($admin instanceof SystemAdmin && $admin->email === self::ALLOWED_EMAIL) {
            if ($request->hasSession()) {
                $request->session()->put('log_viewer_owner_email', $admin->email);
            }

            return $next($request);
        }

        abort(403, 'Only the platform owner can access the Log Viewer.');
    }
}
