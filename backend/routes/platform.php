<?php

use App\Http\Controllers\Api\Platform\AuditLogController as PlatformAuditLogController;
use App\Http\Controllers\Api\Platform\AuthController as PlatformAuthController;
use App\Http\Controllers\Api\Platform\AutomationController as PlatformAutomationController;
use App\Http\Controllers\Api\Platform\BackupController as PlatformBackupController;
use App\Http\Controllers\Api\Platform\CompanyController as PlatformCompanyController;
use App\Http\Controllers\Api\Platform\DashboardController as PlatformDashboardController;
use App\Http\Controllers\Api\Platform\ImpersonationController;
use App\Http\Controllers\Api\Platform\LogController as PlatformLogController;
use App\Http\Controllers\Api\Platform\PlanController as PlatformPlanController;
use App\Http\Controllers\Api\Platform\SubscriptionController as PlatformSubscriptionController;
use App\Http\Controllers\Api\Platform\SystemAdminController;
use App\Http\Controllers\Api\PlatformDetailController;
use Illuminate\Support\Facades\Route;

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// company auth block in api.php. Never nested inside `auth:sanctum`; a
// company user's token is rejected by the `platform` guard (see config/auth.php).
Route::prefix('platform')->group(function () {
    Route::post('login', [PlatformAuthController::class, 'login']);

    Route::middleware('platform.admin')->group(function () {
        Route::post('logout', [PlatformAuthController::class, 'logout']);
        Route::get('me',      [PlatformAuthController::class, 'me']);

        Route::get('dashboard', [PlatformDashboardController::class, 'index']);

        Route::get('companies',                    [PlatformCompanyController::class, 'index']);
        Route::post('companies',                   [PlatformCompanyController::class, 'store']);
        Route::get('companies/{company}',           [PlatformCompanyController::class, 'show']);
        Route::get('companies/{company}/users',      [PlatformCompanyController::class, 'users']);
        Route::post('companies/{company}/suspend',   [PlatformCompanyController::class, 'suspend']);
        Route::post('companies/{company}/activate',  [PlatformCompanyController::class, 'activate']);

        Route::get('audit-logs',  [PlatformAuditLogController::class, 'index']);
        Route::get('subscriptions', [PlatformSubscriptionController::class, 'index']);

        Route::get('plans',              [PlatformPlanController::class, 'index']);
        Route::post('plans',             [PlatformPlanController::class, 'store']);
        Route::put('plans/{plan}',       [PlatformPlanController::class, 'update']);
        Route::delete('plans/{plan}',    [PlatformPlanController::class, 'destroy']);

        // Platform branding shown in every tenant's app sidebar
        Route::get('details',  [PlatformDetailController::class, 'show']);
        Route::put('details',  [PlatformDetailController::class, 'update']);
        Route::post('details', [PlatformDetailController::class, 'update']); // multipart + _method=PUT (logo upload)

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
    });
});
