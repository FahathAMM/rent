<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sets the app locale from the X-Locale header the frontend sends on public
 * and customer requests. Only that explicit header counts — not the
 * browser's own Accept-Language — so the vendor and platform panels, which
 * never send it, always get English (and edit the English columns).
 */
class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $requested = $request->header('X-Locale');
        $locale = in_array($requested, config('app.supported_locales', []), true)
            ? $requested
            : config('app.fallback_locale');

        app()->setLocale($locale);

        $response = $next($request);
        $response->headers->set('Content-Language', $locale);
        $response->setVary(array_unique([...$response->getVary(), 'X-Locale']));

        return $response;
    }
}
