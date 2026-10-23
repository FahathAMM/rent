<?php

use App\Http\Controllers\Api\Administration\AuditLogController;
use App\Http\Controllers\Api\Administration\MenuController;
use App\Http\Controllers\Api\Administration\PermissionController;
use App\Http\Controllers\Api\Administration\RoleController;
use App\Http\Controllers\Api\Administration\UserController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\Dashboard\DashboardController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\ItemDailyPriceController;
use App\Http\Controllers\Api\PlatformDetailController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\VisitLogController;
use Illuminate\Support\Facades\Route;

// ─── Public ───────────────────────────────────────────────────────────────────

Route::prefix('auth')->group(function () {
    Route::post('login',    [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
});

// Platform branding (name/logo/tagline) — public so the login/register
// screens (and every tenant's app sidebar) can show it before auth.
Route::get('platform-details', [PlatformDetailController::class, 'show']);

// Simple traffic logging (site visits, pricing preview) — writes to a log
// file only, no database table.
Route::post('visits', [VisitLogController::class, 'track']);

// ─── Protected ────────────────────────────────────────────────────────────────

Route::middleware(['auth:sanctum', \App\Http\Middleware\EnsureCompanyActivated::class])->group(function () {

    // Auth self-service
    Route::prefix('auth')->group(function () {
        Route::post('logout',         [AuthController::class, 'logout']);
        Route::get('me',              [AuthController::class, 'me']);
        Route::put('profile',         [AuthController::class, 'updateProfile']);
        Route::put('change-password', [AuthController::class, 'changePassword']);
    });

    // Dashboard
    Route::get('dashboard', [DashboardController::class, 'index']);

    // Menus — navigation (all authenticated users)
    Route::get('menus/navigation', [MenuController::class, 'navigation']);
    Route::get('menus/flat',       [MenuController::class, 'flat']);

    // Company profile & numbering/tax settings — owner/admin of the tenant only
    Route::middleware('role:owner|admin')->group(function () {
        Route::get('company',  [CompanyController::class, 'show']);
        Route::put('company',  [CompanyController::class, 'update']);
        Route::post('company', [CompanyController::class, 'update']); // multipart + _method=PUT (logo upload)

        Route::get('company-settings', [CompanySettingController::class, 'show']);
        Route::put('company-settings', [CompanySettingController::class, 'update']);
    });

    // Vendors — suppliers purchases are made against.
    Route::apiResource('vendors', VendorController::class);

    // Products — the catalog purchase line items are picked from. Units are
    // the product measurement master list (kg, pcs, box, ...).
    Route::apiResource('items', ItemController::class);
    Route::get('item-daily-prices', [ItemDailyPriceController::class, 'index']);
    Route::post('item-daily-prices', [ItemDailyPriceController::class, 'store']);
    Route::apiResource('units', UnitController::class);

    // Purchases — stock bought from a vendor, with line items against the
    // product catalog. recordPayment logs a PurchasePayment row and bumps
    // paid_amount/balance_amount to match — no allocation across multiple
    // purchases, each payment belongs to exactly one purchase.
    Route::apiResource('purchases', PurchaseController::class);
    Route::post('purchases/{purchase}/record-payment', [PurchaseController::class, 'recordPayment']);
    Route::get('purchases/{purchase}/pdf', [PurchaseController::class, 'pdf']);

    // Expenses — general company spending, categorized. Categories are
    // managed inline from the Expenses page rather than their own nav item.
    Route::apiResource('expense-categories', ExpenseCategoryController::class)->parameters(['expense-categories' => 'expenseCategory']);
    Route::apiResource('expenses', ExpenseController::class);

    // Sales — walk-in (POS) or credit sales to a customer, with line items
    // against the product catalog. Mirrors Purchases exactly, other
    // direction: recordPayment logs a SalePayment row, pdf prints the
    // customer-facing invoice/receipt.
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('sales', SaleController::class);
    Route::post('sales/{sale}/record-payment', [SaleController::class, 'recordPayment']);
    Route::get('sales/{sale}/pdf', [SaleController::class, 'pdf']);

    // Attachments — generic polymorphic uploads (receipts, bills). Permission
    // is resolved per attachable_type inside the controller, not via `can:`
    // middleware (see AttachmentController::PERMISSIONS).
    Route::get('attachments', [AttachmentController::class, 'index']);
    Route::post('attachments', [AttachmentController::class, 'store']);
    Route::get('attachments/{attachment}/download', [AttachmentController::class, 'download'])->name('attachments.download');
    Route::delete('attachments/{attachment}', [AttachmentController::class, 'destroy']);

    // Reports — {type} is one of ReportService::types().
    Route::get('reports/{type}', [ReportController::class, 'index']);
    Route::get('reports/{type}/export', [ReportController::class, 'export']);

    // Tenant admin (owner is treated the same as admin — both run the company)
    Route::middleware('role:admin|owner')->group(function () {
        Route::apiResource('users', UserController::class);

        // Audit trail for this company (super-admin, below, sees every company's)
        Route::get('audit-logs', [AuditLogController::class, 'index']);
    });

    // Platform-only — shared across every tenant, so only the platform
    // super-admin may change them (a tenant admin editing "roles" or "menus"
    // would otherwise affect every other company on the platform).
    Route::middleware('role:super-admin')->group(function () {
        Route::apiResource('roles', RoleController::class)->except(['show']);
        Route::get('permissions', [PermissionController::class, 'index']);

        // Menu management
        Route::get('menus',           [MenuController::class, 'index']);
        Route::post('menus',          [MenuController::class, 'store']);
        Route::put('menus/{menu}',    [MenuController::class, 'update']);
        Route::delete('menus/{menu}', [MenuController::class, 'destroy']);
    });
});

// ─── Platform (SaaS Admin) — entirely separate identity/guard from the ───────
// company auth block above; moved out to its own file for readability.
require __DIR__.'/platform.php';
