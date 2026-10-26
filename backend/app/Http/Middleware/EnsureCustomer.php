<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The single gate for every protected /api/customer/* route (besides
 * register/login) — mirrors EnsurePlatformAdmin. Re-checks the resolved
 * principal is actually a Customer instance and is active, rather than
 * trusting guard resolution alone, so a misconfiguration of the
 * `customer` guard can never silently let a vendor/owner/staff user
 * through.
 */
class EnsureCustomer
{
    public function handle(Request $request, Closure $next): Response
    {
        $customer = auth('customer')->user();

        if (!$customer instanceof Customer) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$customer->isActive()) {
            return response()->json(['message' => 'Your account is ' . $customer->status . '.'], 403);
        }

        return $next($request);
    }
}
