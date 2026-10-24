<?php

use App\Http\Controllers\Api\Administration\AuditLogController;
use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\OwnerOnboardingController;
use App\Http\Controllers\Api\PayHereWebhookController;
use App\Http\Controllers\Api\PlatformDetailController;
use App\Http\Controllers\Api\ShopOnboardingController;
use App\Http\Controllers\Api\Vendor\BookingController as VendorBookingController;
use App\Http\Controllers\Api\Vendor\VehicleController as VendorVehicleController;
use App\Http\Controllers\Api\Vendor\VehicleImageController;
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

    // Owner/shop onboarding — deliberately NOT behind shop.context: an
    // individual owner has no shop until approval auto-provisions one,
    // and shop registration is how the first one is created at all. See
    // app-doc/marketplace/01-phase1-architecture.md section 3.1.
    Route::prefix('onboarding')->group(function () {
        Route::get('owner',             [OwnerOnboardingController::class, 'show']);
        Route::post('owner',            [OwnerOnboardingController::class, 'store']);
        Route::post('owner/documents',  [OwnerOnboardingController::class, 'uploadDocument']);
        Route::get('owner/documents/{verification}/download', [OwnerOnboardingController::class, 'downloadDocument']);
        Route::post('owner/submit',     [OwnerOnboardingController::class, 'submit']);

        Route::get('shops',                       [ShopOnboardingController::class, 'index']);
        Route::post('shops',                      [ShopOnboardingController::class, 'store']);
        Route::post('shops/{shop}/documents',     [ShopOnboardingController::class, 'uploadDocument']);
        Route::get('shops/documents/{verification}/download', [ShopOnboardingController::class, 'downloadDocument']);
        Route::post('shops/{shop}/submit',        [ShopOnboardingController::class, 'submitForVerification']);
    });

    // Customer's own bookings — ownership by customer_id, no shop context
    // needed at all. See BookingPolicy's docblock. Bound by
    // booking_reference (not id) to match the human-facing {reference}
    // URLs in app-doc/marketplace/05-ui-and-api-map.md.
    Route::get('bookings', [BookingController::class, 'index']);
    Route::post('bookings', [BookingController::class, 'store']);
    Route::get('bookings/{booking:booking_reference}', [BookingController::class, 'show']);
    Route::post('bookings/{booking:booking_reference}/checkout', [BookingController::class, 'checkout']);
    Route::post('bookings/{booking:booking_reference}/cancel', [BookingController::class, 'cancel']);

    // NOTE: favorites, reviews, disputes land in Phase 4+ once their
    // controllers exist — see app-doc/marketplace/05-ui-and-api-map.md.

    // ─── Vendor-side — requires an active shop context ───────────────────────
    // shop.context validates X-Shop-Id against the caller's shop_members
    // rows and pins it for ShopScope/BelongsToShop — see
    // app-doc/marketplace/03-permissions-model.md "Layer 2".
    Route::middleware('shop.context')->group(function () {
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
        });

        // NOTE: availability calendars, finance, staff and settings
        // endpoints land in Phases 5–6 once their controllers exist.
    });
});

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// account app above; moved out to its own file for readability.
require __DIR__.'/platform.php';
