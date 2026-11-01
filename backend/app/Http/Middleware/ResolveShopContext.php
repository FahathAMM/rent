<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use App\Support\VendorContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pins the caller's own shop (users.shop_id) as the active shop context -
 * see app-doc/marketplace/03-permissions-model.md "Layer 2 — Shop context".
 * Nothing in the request can pick a different shop. Everything downstream
 * (ShopScope, BelongsToShop, ShopGate) reads the resolved shop_id from
 * VendorContext, never from the request directly.
 */
class ResolveShopContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = AuthUser::user();
        abort_if(!$user, 401, 'Unauthenticated.');

        abort_if(!$user->shop_id, 403, 'Your account is not linked to a rental shop.');
        abort_if($user->shop?->status === 'suspended', 403, 'This shop has been suspended.');

        VendorContext::set($user->shop_id, $user);

        try {
            return $next($request);
        } finally {
            VendorContext::forget();
        }
    }
}
