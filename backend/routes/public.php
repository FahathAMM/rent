<?php

use App\Http\Controllers\Api\Public\CategoryController;
use App\Http\Controllers\Api\Public\ShopController;
use App\Http\Controllers\Api\Public\VehicleController;
use Illuminate\Support\Facades\Route;

/**
 * The public marketplace catalogue - unauthenticated, cacheable reads
 * only. Every query behind these routes goes through
 * App\Queries\PublicVehicleQuery / PublicShopQuery (the only sanctioned
 * ShopScope bypass) and every response through Http\Resources\Public\*
 * (column allow-lists) - see
 * app-doc/marketplace/01-phase1-architecture.md section 2.2 and
 * app-doc/marketplace/05-ui-and-api-map.md.
 *
 * Functional today: search, detail, shop profile, categories, reviews.
 * NOTE: pickup-location search, date/availability filtering, comparison
 * and inquiries land in Phase 3 alongside the availability calendar and
 * VehicleInquiry endpoints.
 */
Route::prefix('public')->group(function () {
    Route::get('vehicles', [VehicleController::class, 'index']);
    Route::get('vehicles/{slug}', [VehicleController::class, 'show']);
    Route::get('vehicles/{slug}/reviews', [VehicleController::class, 'reviews']);

    Route::get('shops', [ShopController::class, 'index']);
    Route::get('shops/{slug}', [ShopController::class, 'show']);
    Route::get('shops/{slug}/vehicles', [ShopController::class, 'vehicles']);

    Route::get('categories', [CategoryController::class, 'index']);
});
