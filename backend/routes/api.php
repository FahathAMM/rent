<?php

use App\Http\Controllers\Api\Administration\AuditLogController;
use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\PlatformDetailController;
use App\Http\Controllers\Api\Vendor\VehicleController as VendorVehicleController;
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

    // NOTE: customer-facing endpoints (favorites, own bookings, reviews,
    // disputes, owner/shop onboarding) land in Phase 2+ once their
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

        // NOTE: availability calendars, bookings, finance, staff and
        // settings endpoints land in Phases 3–6 once their controllers
        // exist.
    });
});

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// account app above; moved out to its own file for readability.
require __DIR__.'/platform.php';
