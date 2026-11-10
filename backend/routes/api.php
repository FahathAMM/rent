<?php

use App\Http\Controllers\Api\Vendor\SubscriptionController as VendorSubscriptionController;
use App\Http\Controllers\Api\Vendor\PromotionController as VendorPromotionController;
use App\Http\Controllers\Api\Administration\AuditLogController;
use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\Vendor\AttachmentController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\DisputeController;
use App\Http\Controllers\Api\Vendor\ExpenseCategoryController;
use App\Http\Controllers\Api\Vendor\ExpenseController;
use App\Http\Controllers\Api\Vendor\LocationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PlatformDetailController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\Vendor\ShopOnboardingController;
use App\Http\Controllers\Api\Vendor\BankDetailController as VendorBankDetailController;
use App\Http\Controllers\Api\Vendor\BookingController as VendorBookingController;
use App\Http\Controllers\Api\Vendor\DashboardController as VendorDashboardController;
use App\Http\Controllers\Api\Vendor\EarningsController as VendorEarningsController;
use App\Http\Controllers\Api\Vendor\InquiryController as VendorInquiryController;
use App\Http\Controllers\Api\Vendor\ReportController as VendorReportController;
use App\Http\Controllers\Api\Vendor\ReviewController as VendorReviewController;
use App\Http\Controllers\Api\Vendor\SaleEnquiryController as VendorSaleEnquiryController;
use App\Http\Controllers\Api\Vendor\SaleListingController as VendorSaleListingController;
use App\Http\Controllers\Api\Vendor\ShopProfileController as VendorShopProfileController;
use App\Http\Controllers\Api\Vendor\StaffController as VendorStaffController;
use App\Http\Controllers\Api\Vendor\ShopRoleController as VendorShopRoleController;
use App\Http\Controllers\Api\Vendor\VehicleController as VendorVehicleController;
use App\Http\Controllers\Api\Vendor\VehicleImageController;
use App\Http\Controllers\Api\Vendor\VehicleSaleController as VendorVehicleSaleController;
use App\Http\Controllers\Api\Vendor\VehicleAvailabilityController;
use App\Http\Controllers\Api\VisitLogController;
use Illuminate\Support\Facades\Route;

// ─── Public ───────────────────────────────────────────────────────────────────

// throttle:auth — see AppServiceProvider (per email+IP and per IP).
Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// Platform branding (name/logo/tagline) — public so the marketing site, the
// login/register screens and the account/vendor sidebars can all show it
// before auth.
Route::get('platform-details', [PlatformDetailController::class, 'show']);

// Simple traffic logging (public page visits, link clicks) — one log file
// per day in storage/logs/public_visit/, no database table.
Route::post('visits', [VisitLogController::class, 'track'])->middleware('throttle:60,1');

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

    // Shop onboarding — deliberately NOT behind shop.context: shop
    // registration is how the first shop is created at all, and until a
    // platform admin verifies the shop these endpoints are all its owner
    // can reach (shop.verified closes the vendor workspace). See
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
    // shop.context pins the caller's own shop (users.shop_id) as the
    // active shop for ShopScope/BelongsToShop — see
    // app-doc/marketplace/03-permissions-model.md "Layer 2".
    // shop.verified then keeps the whole workspace closed until a platform
    // admin verifies the shop — before that the owner only has onboarding.
    // subscription.active then locks it again for an unpaid shop (no running plan) — only the
    // vendor/subscription endpoints stay open so the owner can pay. See EnsureSubscriptionActive.
    Route::middleware(['shop.context', 'shop.verified', 'subscription.active'])->group(function () {
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

        // Plan features (see SubscriptionPlan::FEATURES) — 403 code=plan_feature when the shop's plan lacks them.
        Route::middleware('plan.feature:expenses')->group(function () {
            Route::apiResource('expense-categories', ExpenseCategoryController::class)->parameters(['expense-categories' => 'expenseCategory']);
            Route::apiResource('expenses', ExpenseController::class);
        });

        // The shop's branches / pickup points — see App\Repositories\LocationRepo.
        Route::apiResource('locations', LocationController::class);

        // All-vehicle availability calendar.
        Route::middleware('plan.feature:calendar')->group(function () {
            Route::get('vehicles-availability', [VehicleAvailabilityController::class, 'index']);
            Route::post('vehicles/{vehicle}/availability/block', [VehicleAvailabilityController::class, 'block']);
            Route::post('vehicles/{vehicle}/availability/unblock', [VehicleAvailabilityController::class, 'unblock']);
        });

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
        // exactly.
        Route::prefix('vendor')->group(function () {
            Route::get('bookings', [VendorBookingController::class, 'index']);
            Route::get('bookings/{booking:booking_reference}', [VendorBookingController::class, 'show']);
            Route::post('bookings/{booking:booking_reference}/accept', [VendorBookingController::class, 'accept']);
            Route::post('bookings/{booking:booking_reference}/reject', [VendorBookingController::class, 'reject']);
            Route::post('bookings/{booking:booking_reference}/cancel', [VendorBookingController::class, 'cancel']);
            Route::post('bookings/{booking:booking_reference}/handover', [VendorBookingController::class, 'handover']);
            Route::post('bookings/{booking:booking_reference}/return', [VendorBookingController::class, 'return']);
            Route::post('bookings/{booking:booking_reference}/payments', [VendorBookingController::class, 'recordPayment']);
            Route::post('bookings/{booking:booking_reference}/reschedule/preview', [VendorBookingController::class, 'previewReschedule']);
            Route::post('bookings/{booking:booking_reference}/reschedule', [VendorBookingController::class, 'reschedule']);
            Route::get('bookings/{booking:booking_reference}/voucher', [VendorBookingController::class, 'voucher']);
            Route::get('bookings/{booking:booking_reference}/agreement', [VendorBookingController::class, 'agreement']);
            Route::post('bookings/{booking:booking_reference}/transfers/{payment}/verify', [VendorBookingController::class, 'verifyTransfer']);
            Route::post('bookings/{booking:booking_reference}/transfers/{payment}/reject', [VendorBookingController::class, 'rejectTransfer']);
            Route::get('bookings/{booking:booking_reference}/transfers/{payment}/proof', [VendorBookingController::class, 'transferProof']);
            Route::get('reviews', [VendorReviewController::class, 'index']);
            Route::post('reviews/{review}/reply', [VendorReviewController::class, 'reply']);
            Route::get('inquiries', [VendorInquiryController::class, 'index']);
            Route::post('inquiries/{inquiry}/reply', [VendorInquiryController::class, 'reply']);

            Route::get('shop-profile', [VendorShopProfileController::class, 'show']);
            Route::put('shop-profile', [VendorShopProfileController::class, 'update']);
            Route::post('shop-profile/branding', [VendorShopProfileController::class, 'updateBranding']);
            Route::get('terms', [VendorShopProfileController::class, 'terms']);
            Route::put('terms', [VendorShopProfileController::class, 'updateTerms']);

            // Permission per report, checked in the controller. A plan feature (Pro / Business).
            Route::middleware('plan.feature:reports')->group(function () {
                Route::get('reports/{report}', [VendorReportController::class, 'show']);
                Route::get('reports/{report}/export', [VendorReportController::class, 'export']);
            });

            Route::get('earnings', [VendorEarningsController::class, 'index']);
            Route::get('earnings/bookings', [VendorEarningsController::class, 'bookings']);

            Route::get('bank-details', [VendorBankDetailController::class, 'index']);
            Route::post('bank-details', [VendorBankDetailController::class, 'store']);
            Route::put('bank-details/{bankDetail}', [VendorBankDetailController::class, 'update']);
            Route::post('bank-details/{bankDetail}/primary', [VendorBankDetailController::class, 'makePrimary']);
            Route::delete('bank-details/{bankDetail}', [VendorBankDetailController::class, 'destroy']);

            Route::middleware('plan.feature:staff')->group(function () {
                Route::get('staff', [VendorStaffController::class, 'index']);
                Route::get('staff/roles', [VendorStaffController::class, 'roles']);
                Route::post('staff', [VendorStaffController::class, 'store']);
                Route::put('staff/{staff}', [VendorStaffController::class, 'update']);
                Route::delete('staff/{staff}', [VendorStaffController::class, 'destroy']);

                // The shop's own roles — shop owner only (enforced in the controller).
                Route::get('roles', [VendorShopRoleController::class, 'index']);
                Route::get('roles/permissions', [VendorShopRoleController::class, 'permissions']);
                Route::post('roles', [VendorShopRoleController::class, 'store']);
                Route::put('roles/{role}', [VendorShopRoleController::class, 'update']);
                Route::delete('roles/{role}', [VendorShopRoleController::class, 'destroy']);
            });

            // Vehicle sales — see app-doc/marketplace/13-vehicle-sales.md. Photos reuse vehicles/{vehicle}/images.
            Route::middleware('plan.feature:sales')->prefix('sales')->group(function () {
                Route::get('listings', [VendorSaleListingController::class, 'index']);
                Route::post('listings', [VendorSaleListingController::class, 'store']);
                Route::get('listings/{vehicle}', [VendorSaleListingController::class, 'show']);
                Route::put('listings/{vehicle}', [VendorSaleListingController::class, 'update']);
                Route::delete('listings/{vehicle}', [VendorSaleListingController::class, 'destroy']);
                Route::post('listings/{vehicle}/publish', [VendorSaleListingController::class, 'publish']);
                Route::post('listings/{vehicle}/withdraw', [VendorSaleListingController::class, 'withdraw']);
                Route::post('listings/{vehicle}/move-to-rent', [VendorSaleListingController::class, 'switchToRent']);
                Route::post('listings/{vehicle}/sell', [VendorVehicleSaleController::class, 'store']);
                Route::post('vehicles/{vehicle}/move-to-sale', [VendorSaleListingController::class, 'switchToSale']);

                Route::get('enquiries', [VendorSaleEnquiryController::class, 'index']);
                Route::get('enquiries/{enquiry:reference}', [VendorSaleEnquiryController::class, 'show']);
                Route::post('enquiries/{enquiry:reference}/messages', [VendorSaleEnquiryController::class, 'reply']);
                Route::post('enquiries/{enquiry:reference}/close', [VendorSaleEnquiryController::class, 'close']);

                Route::get('sold', [VendorVehicleSaleController::class, 'index']);
                Route::get('sold/{sale:reference}', [VendorVehicleSaleController::class, 'show']);
                Route::get('sold/{sale:reference}/agreement', [VendorVehicleSaleController::class, 'agreement']);

                Route::get('terms', [VendorVehicleSaleController::class, 'terms']);
                Route::put('terms', [VendorVehicleSaleController::class, 'updateTerms']);
            });

            // Paid visibility — featured vehicles and category / city sponsorship (owner only, see the controller).
            Route::get('promotions', [VendorPromotionController::class, 'index']);
            Route::get('promotions/availability', [VendorPromotionController::class, 'availability']);
            Route::post('promotions/payments', [VendorPromotionController::class, 'pay']);
            Route::get('promotions/{promotion}/proof', [VendorPromotionController::class, 'proof']);

            // The shop's plan — summary for everyone in the shop, the rest owner-only (see the controller).
            Route::get('subscription/summary', [VendorSubscriptionController::class, 'summary']);
            Route::get('subscription', [VendorSubscriptionController::class, 'index']);
            Route::post('subscription/payments', [VendorSubscriptionController::class, 'pay']);
            Route::get('subscription/payments/{payment}/proof', [VendorSubscriptionController::class, 'proof']);
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
