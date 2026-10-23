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

        // Runs across every tenant — console context is intentionally
        // unrestricted by CompanyScope (see App\Support\Tenant).
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

        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'role'               => RoleMiddleware::class,
            'permission'         => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'platform.admin'     => \App\Http\Middleware\EnsurePlatformAdmin::class,
            'platform.owner'     => \App\Http\Middleware\EnsurePlatformOwner::class,
            'can'                => \App\Http\Middleware\CheckPermission::class,
        ]);

        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (UnauthorizedException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthorized. Insufficient permissions.'], 403);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Resource not found.'], 404);
            }
        });
    })->create();
