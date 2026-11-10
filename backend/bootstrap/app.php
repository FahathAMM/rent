<?php

use App\Models\Automation;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Auth\AuthenticationException;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Spatie\Permission\Exceptions\UnauthorizedException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__ . '/../routes/api.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withSchedule(function (Schedule $schedule) {

        // Runs across every shop — console context is intentionally
        // unrestricted by ShopScope (see App\Support\VendorContext).
        //
        // Database Backup is driven by the `automations` table (editable at
        // /platform/settings) rather than hardcoded here — see
        // Automation::scheduleAll() for the name→command mapping, per-row
        // interval handling, and the safe fallback to the original hardcoded
        // schedule if the table isn't ready or empty.
        Automation::scheduleAll($schedule);

        // Not admin-configurable — just cleanup piggybacking on the backup
        // cadence above. Runs hourly rather than matching it exactly: cheap
        // to run and keeps pruning in step even at a sub-hour interval; see
        // config/backup.php's shortened keep_all_backups_for_days.
        $schedule->command('backup:clean')->hourly();
    })->withMiddleware(function (Middleware $middleware) {

        // Only our own reverse proxies (nginx, the Next.js server) may set
        // X-Forwarded-For — trusting '*' let any visitor fake their IP, which
        // defeated the IP rate limits and the IPs in audit logs / visits.
        // Override with TRUSTED_PROXIES (comma-separated IPs/CIDRs).
        // Read with getenv() too: env() is empty here once config is cached.
        $middleware->trustProxies(at: array_filter(array_map('trim', explode(',',
            (string) (env('TRUSTED_PROXIES') ?: getenv('TRUSTED_PROXIES') ?: '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')
        ))));

        $middleware->alias([
            'role'               => RoleMiddleware::class,
            'permission'         => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'platform.admin'     => \App\Http\Middleware\EnsurePlatformAdmin::class,
            'platform.owner'     => \App\Http\Middleware\EnsurePlatformOwner::class,
            'customer.auth'      => \App\Http\Middleware\EnsureCustomer::class,
            'can'                => \App\Http\Middleware\CheckPermission::class,
            'shop.context'       => \App\Http\Middleware\ResolveShopContext::class,
            'shop.verified'      => \App\Http\Middleware\EnsureShopVerified::class,
            'plan.feature'       => \App\Http\Middleware\EnsurePlanFeature::class,
            'subscription.active' => \App\Http\Middleware\EnsureSubscriptionActive::class,
        ]);

        // Critical ordering: SubstituteBindings is where Laravel resolves a
        // {vehicle}/{expense}/... route parameter via implicit model
        // binding — which runs the model's global scopes (ShopScope)
        // immediately. If that happens before ResolveShopContext has
        // called VendorContext::set(), ShopScope sees "authenticated, no
        // context" and fails closed, 404ing a legitimate owner's own
        // record. shop.context must run first.
        $middleware->prependToPriorityList(
            before: \Illuminate\Routing\Middleware\SubstituteBindings::class,
            prepend: \App\Http\Middleware\ResolveShopContext::class,
        );

        $middleware->statefulApi();

        // Public/customer requests carry X-Locale (en/ta); see SetLocale.
        $middleware->api(prepend: [\App\Http\Middleware\SetLocale::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (UnauthorizedException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => __('Unauthorized. Insufficient permissions.')], 403);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => __('Validation failed'),
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => __('Unauthenticated.')], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => __('Resource not found.')], 404);
            }
        });
    })->create();
