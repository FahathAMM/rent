<?php

use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\Administration\PermissionController;
use App\Http\Controllers\Api\Administration\RoleController;
use App\Http\Controllers\Api\Platform\AuditLogController as PlatformAuditLogController;
use App\Http\Controllers\Api\Platform\AuthController as PlatformAuthController;
use App\Http\Controllers\Api\Platform\AutomationController as PlatformAutomationController;
use App\Http\Controllers\Api\Platform\BackupController as PlatformBackupController;
use App\Http\Controllers\Api\Platform\ImpersonationController;
use App\Http\Controllers\Api\Platform\LogController as PlatformLogController;
use App\Http\Controllers\Api\Platform\SystemAdminController;
use App\Http\Controllers\Api\PlatformDetailController;
use Illuminate\Support\Facades\Route;

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// account/vendor routes in api.php. Never nested inside `auth:sanctum`; a
// marketplace user's token is rejected by the `platform` guard (see
// config/auth.php).
Route::prefix('platform')->group(function () {
    Route::post('login', [PlatformAuthController::class, 'login']);

    Route::middleware('platform.admin')->group(function () {
        Route::post('logout', [PlatformAuthController::class, 'logout']);
        Route::get('me',      [PlatformAuthController::class, 'me']);

        Route::get('audit-logs',  [PlatformAuditLogController::class, 'index']);

        // Platform branding shown on the public site and every account/vendor sidebar
        Route::get('details',  [PlatformDetailController::class, 'show']);
        Route::put('details',  [PlatformDetailController::class, 'update']);
        Route::post('details', [PlatformDetailController::class, 'update']); // multipart + _method=PUT (logo upload)

        // Roles, permissions and the two marketplace-facing nav trees are
        // shared across every shop, so only a platform admin may change
        // them (a shop owner editing "roles" or "menus" would otherwise
        // affect every other shop on the platform) — reuses the
        // Administration controllers as-is.
        Route::apiResource('roles', RoleController::class)->except(['show']);
        Route::get('permissions', [PermissionController::class, 'index']);
        Route::get('menus',           [MenuController::class, 'index']);
        Route::post('menus',          [MenuController::class, 'store']);
        Route::put('menus/{menu}',    [MenuController::class, 'update']);
        Route::delete('menus/{menu}', [MenuController::class, 'destroy']);

        // Managing other platform admin accounts — Platform Owner only.
        Route::get('users', [SystemAdminController::class, 'index']);
        Route::middleware('platform.owner')->group(function () {
            Route::post('users',              [SystemAdminController::class, 'store']);
            Route::put('users/{systemAdmin}', [SystemAdminController::class, 'update']);
            Route::delete('users/{systemAdmin}', [SystemAdminController::class, 'destroy']);
        });

        // Scheduled tasks (name, cadence, on/off) — /platform/settings "Automations".
        Route::get('automations',              [PlatformAutomationController::class, 'index']);
        Route::post('automations',             [PlatformAutomationController::class, 'store']);
        Route::put('automations/{automation}', [PlatformAutomationController::class, 'update']);
        Route::delete('automations/{automation}', [PlatformAutomationController::class, 'destroy']);

        // Database backups (Spatie Laravel Backup) — /platform/settings.
        Route::get('backups',          [PlatformBackupController::class, 'index']);
        Route::post('backups',         [PlatformBackupController::class, 'store']);
        Route::get('backups/download', [PlatformBackupController::class, 'download']);
        Route::post('backups/email',   [PlatformBackupController::class, 'email']);
        Route::middleware('platform.owner')->group(function () {
            Route::delete('backups', [PlatformBackupController::class, 'destroy']);
        });

        // Application log viewer (storage/logs) — /platform/logs.
        Route::get('logs',          [PlatformLogController::class, 'index']);
        Route::get('logs/entries',  [PlatformLogController::class, 'entries']);
        Route::get('logs/download', [PlatformLogController::class, 'download']);
        Route::middleware('platform.owner')->group(function () {
            Route::delete('logs', [PlatformLogController::class, 'destroy']);
        });

        Route::post('impersonation/start', [ImpersonationController::class, 'start']);
        Route::post('impersonation/stop',  [ImpersonationController::class, 'stop']);

        // NOTE: dashboard, customers, owner/shop verification, listing
        // moderation, categories, booking oversight, payments, commissions,
        // payouts, reconciliation, disputes, abuse reports, review
        // moderation and platform settings land in Phases 2–8 once their
        // controllers and models' business logic exist — see
        // app-doc/marketplace/05-ui-and-api-map.md and 06-plan-and-risks.md.
    });
});
