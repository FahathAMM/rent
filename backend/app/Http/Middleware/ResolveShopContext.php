<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use App\Support\VendorContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The ONLY place an X-Shop-Id header is ever read. Validates it against
 * the caller's own shop_members rows before trusting it - see
 * app-doc/marketplace/03-permissions-model.md "Layer 2 — Shop context".
 *
 * If the header is omitted and the user has exactly one active membership,
 * that membership is used automatically. Everything downstream (ShopScope,
 * BelongsToShop, ShopGate) reads the resolved shop_id from VendorContext,
 * never from the request directly.
 */
class ResolveShopContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = AuthUser::user();
        abort_if(!$user, 401, 'Unauthenticated.');

        $memberships = $user->activeShopMemberships()->with('shop')->get();

        $requestedShopId = $request->header('X-Shop-Id');

        $membership = $requestedShopId
            ? $memberships->firstWhere('shop_id', (int) $requestedShopId)
            : ($memberships->count() === 1 ? $memberships->first() : null);

        abort_if($requestedShopId && !$membership, 403, 'You are not a member of this shop.');
        abort_if(!$membership, 400, 'Active shop not specified. Pass X-Shop-Id.');
        abort_if($membership->shop?->status === 'suspended', 403, 'This shop has been suspended.');

        VendorContext::set($membership->shop_id, $membership);

        try {
            return $next($request);
        } finally {
            VendorContext::forget();
        }
    }
}
