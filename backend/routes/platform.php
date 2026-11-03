<?php

use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\Administration\PermissionController;
use App\Http\Controllers\Api\Administration\RoleController;
use App\Http\Controllers\Api\Platform\AuditLogController as PlatformAuditLogController;
use App\Http\Controllers\Api\Platform\AuthController as PlatformAuthController;
use App\Http\Controllers\Api\Platform\AutomationController as PlatformAutomationController;
use App\Http\Controllers\Api\Platform\BackupController as PlatformBackupController;
use App\Http\Controllers\Api\Platform\BookingController as PlatformBookingController;
use App\Http\Controllers\Api\Platform\BrandController as PlatformBrandController;
use App\Http\Controllers\Api\Platform\HeroSlideController as PlatformHeroSlideController;
use App\Http\Controllers\Api\Platform\VehicleColourController;
use App\Http\Controllers\Api\Platform\VehicleModelController;
use App\Http\Controllers\Api\Platform\VehicleVariantController;
use App\Http\Controllers\Api\Platform\CategoryController as PlatformCategoryController;
use App\Http\Controllers\Api\Platform\CityController as PlatformCityController;
use App\Http\Controllers\Api\Platform\CustomerController as PlatformCustomerController;
use App\Http\Controllers\Api\Platform\DashboardController as PlatformDashboardController;
use App\Http\Controllers\Api\Platform\DisputeController as PlatformDisputeController;
use App\Http\Controllers\Api\Platform\ImpersonationController;
use App\Http\Controllers\Api\Platform\ListingModerationController;
use App\Http\Controllers\Api\Platform\LogController as PlatformLogController;
use App\Http\Controllers\Api\Platform\PaymentController as PlatformPaymentController;
use App\Http\Controllers\Api\Platform\PublicVisitController;
use App\Http\Controllers\Api\Platform\ReportController as PlatformReportController;
use App\Http\Controllers\Api\Platform\ReviewController as PlatformReviewController;
use App\Http\Controllers\Api\Platform\ShopVerificationController;
use App\Http\Controllers\Api\Platform\SubscriptionController as PlatformSubscriptionController;
use App\Http\Controllers\Api\Platform\PromotionController as PlatformPromotionController;
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
        // shared across every shop, so only the platform may change them (a
        // shop owner editing "roles" or "menus" would otherwise affect every
        // other shop on the platform). Any platform admin can view roles;
        // changing what a role can do is Platform Owner only.
        Route::get('roles', [RoleController::class, 'index']);
        Route::get('permissions', [PermissionController::class, 'index']);
        Route::middleware('platform.owner')->group(function () {
            Route::post('roles', [RoleController::class, 'store']);
            Route::put('roles/{role}', [RoleController::class, 'update']);
            Route::delete('roles/{role}', [RoleController::class, 'destroy']);
        });
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

        // Public site visits (public_visits table) — /platform/visits.
        Route::get('visits/summary', [PublicVisitController::class, 'summary']);
        Route::get('visits',         [PublicVisitController::class, 'index']);

        // Application log viewer (storage/logs) — /platform/logs.
        Route::get('logs',          [PlatformLogController::class, 'index']);
        Route::get('logs/entries',  [PlatformLogController::class, 'entries']);
        Route::get('logs/download', [PlatformLogController::class, 'download']);
        Route::middleware('platform.owner')->group(function () {
            Route::delete('logs', [PlatformLogController::class, 'destroy']);
        });

        Route::post('impersonation/start', [ImpersonationController::class, 'start']);
        Route::post('impersonation/stop',  [ImpersonationController::class, 'stop']);

        // Shop verification and publication status — verifying a shop is
        // also what grants its owner the shop-owner role.
        Route::get('shops',                      [ShopVerificationController::class, 'index']);
        Route::get('shops/{rentalShop}',          [ShopVerificationController::class, 'show']);
        Route::post('shops/{rentalShop}/verify',  [ShopVerificationController::class, 'verify']);
        Route::post('shops/{rentalShop}/reject',  [ShopVerificationController::class, 'reject']);
        Route::post('shops/{rentalShop}/suspend', [ShopVerificationController::class, 'suspend']);
        Route::post('shops/{rentalShop}/activate', [ShopVerificationController::class, 'activate']);
        Route::get('shops/documents/{verification}/download', [ShopVerificationController::class, 'downloadDocument']);
        Route::middleware('platform.owner')->group(function () {
            Route::delete('shops/{rentalShop}', [ShopVerificationController::class, 'destroy']);
        });

        // Shop subscription plans — app-doc/marketplace/10-monetization.md.
        // Any admin can review payments and grant a plan; plans and settings are Platform Owner only.
        Route::get('subscription-stats',     [PlatformSubscriptionController::class, 'stats']);
        Route::get('subscription-plans',     [PlatformSubscriptionController::class, 'plans']);
        Route::get('subscription-settings',  [PlatformSubscriptionController::class, 'settings']);
        Route::middleware('platform.owner')->group(function () {
            Route::post('subscription-plans',             [PlatformSubscriptionController::class, 'storePlan']);
            Route::put('subscription-plans/{plan}',       [PlatformSubscriptionController::class, 'updatePlan']);
            Route::put('subscription-settings',           [PlatformSubscriptionController::class, 'updateSettings']);
        });
        Route::get('subscription-payments',                    [PlatformSubscriptionController::class, 'payments']);
        Route::post('subscription-payments/{payment}/approve', [PlatformSubscriptionController::class, 'approve']);
        Route::post('subscription-payments/{payment}/reject',  [PlatformSubscriptionController::class, 'reject']);
        Route::get('subscription-payments/{payment}/proof',    [PlatformSubscriptionController::class, 'proof']);
        Route::get('shops/{rentalShop}/subscription',          [PlatformSubscriptionController::class, 'shop']);
        Route::post('shops/{rentalShop}/subscription',         [PlatformSubscriptionController::class, 'grant']);

        // Paid visibility (featured vehicles, category / city sponsorship) — 10-monetization.md 2.2.
        // Any admin reviews payments, grants and ends; packages and slot limits are Platform Owner only.
        Route::get('promotions/stats',                [PlatformPromotionController::class, 'stats']);
        Route::get('promotions/packages',             [PlatformPromotionController::class, 'packages']);
        Route::get('promotions',                      [PlatformPromotionController::class, 'index']);
        Route::post('promotions/{promotion}/approve', [PlatformPromotionController::class, 'approve']);
        Route::post('promotions/{promotion}/reject',  [PlatformPromotionController::class, 'reject']);
        Route::post('promotions/{promotion}/end',     [PlatformPromotionController::class, 'end']);
        Route::get('promotions/{promotion}/proof',    [PlatformPromotionController::class, 'proof']);
        Route::post('shops/{rentalShop}/promotions',  [PlatformPromotionController::class, 'grant']);
        Route::middleware('platform.owner')->group(function () {
            Route::post('promotions/packages',           [PlatformPromotionController::class, 'storePackage']);
            Route::put('promotions/packages/{package}',  [PlatformPromotionController::class, 'updatePackage']);
            Route::put('promotions/settings',            [PlatformPromotionController::class, 'updateSettings']);
        });

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
        Route::post('listings/{vehicle}/republish', [ListingModerationController::class, 'republish']);
        Route::post('listings/{vehicle}/feature',   [ListingModerationController::class, 'feature']);
        Route::post('listings/{vehicle}/unfeature', [ListingModerationController::class, 'unfeature']);

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

        // Customer accounts (the `customers` table / customer guard, not
        // vendor `users`) — suspend/ban revokes every token the account
        // already holds.
        Route::get('customers',                      [PlatformCustomerController::class, 'index']);
        Route::get('customers/{customer}',           [PlatformCustomerController::class, 'show']);
        Route::post('customers/{customer}/suspend',  [PlatformCustomerController::class, 'suspend']);
        Route::post('customers/{customer}/ban',      [PlatformCustomerController::class, 'ban']);
        Route::post('customers/{customer}/activate', [PlatformCustomerController::class, 'activate']);

        // Vehicle categories — platform-managed, feeds the public search
        // facets.
        Route::apiResource('categories', PlatformCategoryController::class)->parameters(['categories' => 'category']);

        // Vehicle brands — platform-managed list vendors pick from. Logo
        // uploads are multipart, so updates go through POST + _method=PUT.
        Route::apiResource('brands', PlatformBrandController::class)->parameters(['brands' => 'brand']);

        // Home page hero slides (image + headline). Multipart updates go
        // through POST + _method=PUT, like brands.
        Route::post('hero-slides/reorder', [PlatformHeroSlideController::class, 'reorder']);
        Route::apiResource('hero-slides', PlatformHeroSlideController::class)->except('show')->parameters(['hero-slides' => 'heroSlide']);

        // The rest of the vehicle hierarchy: brand -> model -> variant, plus colours.
        Route::apiResource('vehicle-models', VehicleModelController::class)->except('show')->parameters(['vehicle-models' => 'model']);
        Route::apiResource('vehicle-variants', VehicleVariantController::class)->except('show')->parameters(['vehicle-variants' => 'variant']);
        Route::apiResource('vehicle-colours', VehicleColourController::class)->except('show')->parameters(['vehicle-colours' => 'colour']);

        // Sri Lanka District/City reference data — feeds the owner/shop
        // onboarding forms' location dropdowns. Districts are fixed
        // (seeded); platform admins can only add/remove cities.
        Route::get('cities', [PlatformCityController::class, 'index']);
        Route::post('cities', [PlatformCityController::class, 'store']);
        Route::delete('cities/{city}', [PlatformCityController::class, 'destroy']);

        // Payments — read-only here; cash and bank-transfer payments are
        // written by the shop's booking flow (handover, transfers).
        Route::get('payments',           [PlatformPaymentController::class, 'index']);
        Route::get('payments/{payment}', [PlatformPaymentController::class, 'show']);

        // Cross-shop booking oversight — no ShopScope bypass needed (see
        // PlatformBookingController's docblock).
        Route::get('bookings',                       [PlatformBookingController::class, 'index']);
        Route::get('bookings/{reference}',             [PlatformBookingController::class, 'show']);
        Route::post('bookings/{reference}/cancel',     [PlatformBookingController::class, 'cancel']);
        Route::middleware('platform.owner')->group(function () {
            Route::delete('bookings/{reference}', [PlatformBookingController::class, 'destroy']); // soft delete, with a reason
        });
    });
});
