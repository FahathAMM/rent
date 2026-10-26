<?php

use App\Http\Controllers\Api\Administration\AuditLogController;
use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\DisputeController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PayHereWebhookController;
use App\Http\Controllers\Api\PlatformDetailController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ShopOnboardingController;
use App\Http\Controllers\Api\Vendor\BankDetailController as VendorBankDetailController;
use App\Http\Controllers\Api\Vendor\BookingController as VendorBookingController;
use App\Http\Controllers\Api\Vendor\DashboardController as VendorDashboardController;
use App\Http\Controllers\Api\Vendor\EarningsController as VendorEarningsController;
use App\Http\Controllers\Api\Vendor\InquiryController as VendorInquiryController;
use App\Http\Controllers\Api\Vendor\PayoutController as VendorPayoutController;
use App\Http\Controllers\Api\Vendor\ReviewController as VendorReviewController;
use App\Http\Controllers\Api\Vendor\ShopProfileController as VendorShopProfileController;
use App\Http\Controllers\Api\Vendor\StaffController as VendorStaffController;
use App\Http\Controllers\Api\Vendor\VehicleController as VendorVehicleController;
use App\Http\Controllers\Api\Vendor\VehicleImageController;
use App\Http\Controllers\Api\VehicleAvailabilityController;
use App\Http\Controllers\Api\VisitLogController;
use Illuminate\Support\Facades\Route;

// ─── Public ───────────────────────────────────────────────────────────────────

Route::prefix('auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// Platform branding (name/logo/tagline) — public so the marketing site, the
// login/register screens and the account/vendor sidebars can all show it
// before auth.
Route::get('platform-details', [PlatformDetailController::class, 'show']);

// Simple traffic logging (site visits, pricing preview) — writes to a log
// file only, no database table.
Route::post('visits', [VisitLogController::class, 'track']);

// PayHere server-to-server notification — public, unauthenticated, no
// CSRF (api.php routes never get the web CSRF middleware group). See
// PayHereWebhookController's docblock and
// app-doc/marketplace/04-lifecycles.md "Payment lifecycle".
Route::post('webhooks/payhere', [PayHereWebhookController::class, 'handle']);

// The public marketplace catalogue (search, vehicle detail, shop profile,
// categories, reviews) — see routes/public.php.
require __DIR__.'/public.php';

// ─── Protected — every marketplace account (customer / owner / staff) ───────

Route::middleware('auth:sanctum')->group(function () {

    // Auth self-service — no shop context needed, these act on the user
    // themselves.
    Route::prefix('auth')->group(function () {
        Route::post('logout',         [AuthController::class, 'logout']);
        Route::get('me',              [AuthController::class, 'me']);
        Route::put('profile',         [AuthController::class, 'updateProfile']);
        Route::put('change-password', [AuthController::class, 'changePassword']);
    });

    // Navigation — audience-aware (?audience=customer|vendor), filtered by
    // the caller's permissions. See app-doc/marketplace/03-permissions-
    // model.md "The navigation menu becomes three trees".
    Route::get('menus/navigation', [MenuController::class, 'navigation']);
    Route::get('menus/flat',       [MenuController::class, 'flat']);

    // Shop onboarding — deliberately NOT behind shop.context: shop
    // registration is how the first shop is created at all, and an
    // unverified shop's owner has no vendor role yet. See
    // app-doc/marketplace/01-phase1-architecture.md section 3.1.
    Route::prefix('onboarding')->group(function () {
        Route::get('shops',                       [ShopOnboardingController::class, 'index']);
        Route::post('shops',                      [ShopOnboardingController::class, 'store']);
        Route::post('shops/{shop}/documents',     [ShopOnboardingController::class, 'uploadDocument']);
        Route::get('shops/documents/{verification}/download', [ShopOnboardingController::class, 'downloadDocument']);
        Route::post('shops/{shop}/submit',        [ShopOnboardingController::class, 'submitForVerification']);
    });

    // Bookings/reviews/favorites moved to the separate `customer` guard —
    // see routes/customer.php. Disputes/reports stay here: they're
    // genuinely shared between the customer and the shop's owner/staff
    // (same account today), not customer-exclusive.

    // Disputes — raised by either side of a booking (customer or the
    // shop's owner/staff); every account holds the customer role, so
    // both sides reach these same routes. See CustomerDisputeQuery and
    // DisputeController's docblocks.
    Route::get('disputes', [DisputeController::class, 'index']);
    Route::post('disputes', [DisputeController::class, 'store']);
    Route::get('disputes/{reference}', [DisputeController::class, 'show']);
    Route::post('disputes/{reference}/messages', [DisputeController::class, 'addMessage']);

    // Abuse / fraud reporting against a vehicle, review, shop or user.
    Route::post('reports', [ReportController::class, 'store']);

    // Shared by both the customer and vendor apps — a notification
    // belongs to the User model itself, never to a shop.
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);

    // ─── Vendor-side — requires an active shop context ───────────────────────
    // shop.context validates X-Shop-Id against the caller's shop_members
    // rows and pins it for ShopScope/BelongsToShop — see
    // app-doc/marketplace/03-permissions-model.md "Layer 2".
    Route::middleware('shop.context')->group(function () {
        Route::get('dashboard', [VendorDashboardController::class, 'index']);

        Route::apiResource('vehicles', VendorVehicleController::class);
        Route::post('vehicles/{vehicle}/publish', [VendorVehicleController::class, 'publish']);
        Route::post('vehicles/{vehicle}/unpublish', [VendorVehicleController::class, 'unpublish']);
        Route::post('vehicles/{vehicle}/archive', [VendorVehicleController::class, 'archive']);
        Route::put('vehicles/{vehicle}/pricing', [VendorVehicleController::class, 'updatePricing']);

        // Listing photos — public disk, dedicated endpoints (not the
        // generic AttachmentController) since they need sort_order/
        // is_primary and are world-readable, unlike every other
        // attachable type. See VehicleImageController's docblock.
        Route::get('vehicles/{vehicle}/images', [VehicleImageController::class, 'index']);
        Route::post('vehicles/{vehicle}/images', [VehicleImageController::class, 'store']);
        Route::post('vehicles/{vehicle}/images/reorder', [VehicleImageController::class, 'reorder']);
        Route::delete('vehicle-images/{image}', [VehicleImageController::class, 'destroy']);
        Route::post('vehicle-images/{image}/primary', [VehicleImageController::class, 'setPrimary']);

        Route::apiResource('expense-categories', ExpenseCategoryController::class)->parameters(['expense-categories' => 'expenseCategory']);
        Route::apiResource('expenses', ExpenseController::class);

        // The shop's branches / pickup points — see App\Repositories\LocationRepo.
        Route::apiResource('locations', LocationController::class);

        // All-vehicle availability calendar.
        Route::get('vehicles-availability', [VehicleAvailabilityController::class, 'index']);
        Route::post('vehicles/{vehicle}/availability/block', [VehicleAvailabilityController::class, 'block']);
        Route::post('vehicles/{vehicle}/availability/unblock', [VehicleAvailabilityController::class, 'unblock']);

        // Attachments — generic polymorphic uploads. Permission is resolved
        // per attachable_type inside the controller (see
        // AttachmentController::PERMISSIONS), not via `can:` middleware.
        Route::get('attachments', [AttachmentController::class, 'index']);
        Route::post('attachments', [AttachmentController::class, 'store']);
        Route::get('attachments/{attachment}/download', [AttachmentController::class, 'download'])->name('attachments.download');
        Route::delete('attachments/{attachment}', [AttachmentController::class, 'destroy']);

        // A shop's own audit trail (platform admins see every shop's via
        // platform.php). AuditLog is deliberately not shop-scoped by a
        // global scope, so the controller filters explicitly by the active
        // shop context — see Administration\AuditLogController.
        Route::get('audit-logs', [AuditLogController::class, 'index']);

        // The shop's booking inbox — prefixed `vendor/` since
        // "/bookings" is already the customer's own-bookings endpoint
        // above (same auth:sanctum group, no other path segment would
        // otherwise distinguish them); matches
        // app-doc/marketplace/05-ui-and-api-map.md's `/vendor/bookings`
        // exactly. confirm/active/completed transitions (payment
        // webhook, handover, return) land in Phases 5-6 once payments
        // and inspections exist.
        Route::prefix('vendor')->group(function () {
            Route::get('bookings', [VendorBookingController::class, 'index']);
            Route::get('bookings/{booking:booking_reference}', [VendorBookingController::class, 'show']);
            Route::post('bookings/{booking:booking_reference}/accept', [VendorBookingController::class, 'accept']);
            Route::post('bookings/{booking:booking_reference}/reject', [VendorBookingController::class, 'reject']);
            Route::post('bookings/{booking:booking_reference}/cancel', [VendorBookingController::class, 'cancel']);
            Route::post('bookings/{booking:booking_reference}/handover', [VendorBookingController::class, 'handover']);
            Route::post('bookings/{booking:booking_reference}/return', [VendorBookingController::class, 'return']);
            Route::get('payouts', [VendorPayoutController::class, 'index']);
            Route::get('payouts/{payout}', [VendorPayoutController::class, 'show']);
            Route::get('reviews', [VendorReviewController::class, 'index']);
            Route::post('reviews/{review}/reply', [VendorReviewController::class, 'reply']);
            Route::get('inquiries', [VendorInquiryController::class, 'index']);
            Route::post('inquiries/{inquiry}/reply', [VendorInquiryController::class, 'reply']);

            Route::get('shop-profile', [VendorShopProfileController::class, 'show']);
            Route::put('shop-profile', [VendorShopProfileController::class, 'update']);
            Route::post('shop-profile/branding', [VendorShopProfileController::class, 'updateBranding']);

            Route::get('earnings', [VendorEarningsController::class, 'index']);
            Route::get('earnings/bookings', [VendorEarningsController::class, 'bookings']);

            Route::get('bank-details', [VendorBankDetailController::class, 'index']);
            Route::post('bank-details', [VendorBankDetailController::class, 'store']);
            Route::post('bank-details/{bankDetail}/primary', [VendorBankDetailController::class, 'makePrimary']);
            Route::delete('bank-details/{bankDetail}', [VendorBankDetailController::class, 'destroy']);

            Route::get('staff', [VendorStaffController::class, 'index']);
            Route::get('staff/abilities', [VendorStaffController::class, 'abilities']);
            Route::post('staff', [VendorStaffController::class, 'store']);
            Route::put('staff/{staff}', [VendorStaffController::class, 'update']);
            Route::delete('staff/{staff}', [VendorStaffController::class, 'destroy']);
        });
    });
});

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// account app above; moved out to its own file for readability.
require __DIR__.'/platform.php';

// ─── Customer — entirely separate identity/guard from the account app ───────
// above (which is actually the vendor/owner/staff `users` table); see
// routes/customer.php's own docblock.
require __DIR__.'/customer.php';
