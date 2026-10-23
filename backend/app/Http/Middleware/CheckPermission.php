<?php

namespace App\Http\Middleware;

use App\Services\AuthUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Registered per-action in a controller's constructor (the authorizeResource
 * replacement) — e.g. $this->middleware('can:crm-leads-edit,lead')->only('update').
 * The optional second argument is a route parameter name; when given, its
 * resolved model is passed to User::can() for the shop_id scoping check.
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission, ?string $parameter = null): Response
    {
        $model = $parameter ? $request->route($parameter) : null;

        abort_unless(AuthUser::can($permission, $model), 403);

        return $next($request);
    }
}
