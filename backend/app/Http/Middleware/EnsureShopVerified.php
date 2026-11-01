<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the vendor workspace closed until a platform admin verifies the
 * caller's shop. Before that its owner only has the onboarding endpoints
 * (register, upload documents, submit). Runs after shop.context, so the
 * user is known to have a shop.
 */
class EnsureShopVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(
            AuthUser::user()?->shop?->isVerified(),
            403,
            'Your rental shop must be verified before you can use the vendor workspace.'
        );

        return $next($request);
    }
}
