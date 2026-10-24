<?php

use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\Administration\PermissionController;
use App\Http\Controllers\Api\Administration\RoleController;
use App\Http\Controllers\Api\Platform\AuditLogController as PlatformAuditLogController;
use App\Http\Controllers\Api\Platform\AuthController as PlatformAuthController;
use App\Http\Controllers\Api\Platform\AutomationController as PlatformAutomationController;
use App\Http\Controllers\Api\Platform\BackupController as PlatformBackupController;
use App\Http\Controllers\Api\Platform\DashboardController as PlatformDashboardController;
use App\Http\Controllers\Api\Platform\DisputeController as PlatformDisputeController;
use App\Http\Controllers\Api\Platform\ImpersonationController;
use App\Http\Controllers\Api\Platform\ListingModerationController;
use App\Http\Controllers\Api\Platform\LogController as PlatformLogController;
use App\Http\Controllers\Api\Platform\OwnerVerificationController;
use App\Http\Controllers\Api\Platform\PayoutController as PlatformPayoutController;
use App\Http\Controllers\Api\Platform\ReportController as PlatformReportController;
use App\Http\Controllers\Api\Platform\ReviewController as PlatformReviewController;
use App\Http\Controllers\Api\Platform\ShopVerificationController;
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
        Route::get('dashboard',   [PlatformDashboardController::class, 'index']);

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

        // Individual-owner applications — see
        // app-doc/marketplace/01-phase1-architecture.md section 3.1:
        // approving one auto-provisions the applicant's personal shop.
        Route::get('owner-applications',                      [OwnerVerificationController::class, 'index']);
        Route::get('owner-applications/{ownerProfile}',        [OwnerVerificationController::class, 'show']);
        Route::post('owner-applications/{ownerProfile}/approve', [OwnerVerificationController::class, 'approve']);
        Route::post('owner-applications/{ownerProfile}/reject',  [OwnerVerificationController::class, 'reject']);
        Route::post('owner-applications/{ownerProfile}/request-info', [OwnerVerificationController::class, 'requestInfo']);
        Route::post('owner-applications/{ownerProfile}/suspend', [OwnerVerificationController::class, 'suspend']);
        Route::get('owner-applications/documents/{verification}/download', [OwnerVerificationController::class, 'downloadDocument']);

        // Business shop verification and publication status.
        Route::get('shops',                      [ShopVerificationController::class, 'index']);
        Route::get('shops/{rentalShop}',          [ShopVerificationController::class, 'show']);
        Route::post('shops/{rentalShop}/verify',  [ShopVerificationController::class, 'verify']);
        Route::post('shops/{rentalShop}/reject',  [ShopVerificationController::class, 'reject']);
        Route::post('shops/{rentalShop}/suspend', [ShopVerificationController::class, 'suspend']);
        Route::post('shops/{rentalShop}/activate', [ShopVerificationController::class, 'activate']);
        Route::get('shops/documents/{verification}/download', [ShopVerificationController::class, 'downloadDocument']);

        // Listing moderation queue — a vehicle's moderation_status starts
        // 'pending' at creation; approving here is the only path that
        // unblocks VehicleController::publish(). See
        // app-doc/marketplace/05-ui-and-api-map.md "/platform/listings".
        Route::get('listings',                     [ListingModerationController::class, 'index']);
        Route::get('listings/{vehicle}',            [ListingModerationController::class, 'show']);
        Route::post('listings/{vehicle}/approve',   [ListingModerationController::class, 'approve']);
        Route::post('listings/{vehicle}/reject',    [ListingModerationController::class, 'reject']);
        Route::post('listings/{vehicle}/flag',      [ListingModerationController::class, 'flag']);
        Route::post('listings/{vehicle}/unpublish', [ListingModerationController::class, 'unpublish']);
        Route::post('listings/{vehicle}/feature',   [ListingModerationController::class, 'feature']);
        Route::post('listings/{vehicle}/unfeature', [ListingModerationController::class, 'unfeature']);

        // Manual payout settlement — see
        // app-doc/marketplace/04-lifecycles.md "Payout cycle".
        Route::get('payouts',                     [PlatformPayoutController::class, 'index']);
        Route::get('payouts/{payout}',             [PlatformPayoutController::class, 'show']);
        Route::post('payouts/build',               [PlatformPayoutController::class, 'build']);
        Route::post('payouts/{payout}/approve',     [PlatformPayoutController::class, 'approve']);
        Route::post('payouts/{payout}/processing',  [PlatformPayoutController::class, 'markProcessing']);
        Route::post('payouts/{payout}/paid',        [PlatformPayoutController::class, 'markPaid']);
        Route::post('payouts/{payout}/failed',      [PlatformPayoutController::class, 'markFailed']);

        // Review moderation — see
        // app-doc/marketplace/05-ui-and-api-map.md "/platform/reviews".
        Route::get('reviews',                [PlatformReviewController::class, 'index']);
        Route::post('reviews/{review}/publish', [PlatformReviewController::class, 'publish']);
        Route::post('reviews/{review}/reject',  [PlatformReviewController::class, 'reject']);
        Route::post('reviews/{review}/hide',    [PlatformReviewController::class, 'hide']);

        // Disputes — see app-doc/marketplace/05-ui-and-api-map.md
        // "/platform/disputes". No shop-scope bypass is needed to read
        // across shops here: ShopScope's platform-admin branch already
        // leaves this guard unrestricted (see ShopScope's docblock).
        Route::get('disputes',                   [PlatformDisputeController::class, 'index']);
        Route::get('disputes/{reference}',        [PlatformDisputeController::class, 'show']);
        Route::post('disputes/{dispute}/assign',  [PlatformDisputeController::class, 'assign']);
        Route::post('disputes/{dispute}/resolve', [PlatformDisputeController::class, 'resolve']);
        Route::post('disputes/{dispute}/messages', [PlatformDisputeController::class, 'addMessage']);

        // Abuse / fraud reports — see "/platform/abuse-reports".
        Route::get('abuse-reports',               [PlatformReportController::class, 'index']);
        Route::post('abuse-reports/{report}/action', [PlatformReportController::class, 'action']);

        // NOTE: customers, categories, booking oversight, payments,
        // commissions and reconciliation land in Phase 8 once their
        // controllers exist — see app-doc/marketplace/05-ui-and-api-map.md
        // and 06-plan-and-risks.md.
    });
});
