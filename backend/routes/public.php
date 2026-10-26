<?php

use App\Http\Controllers\Api\Public\BrandController;
use App\Http\Controllers\Api\Public\CategoryController;
use App\Http\Controllers\Api\Public\VehicleCatalogueController;
use App\Http\Controllers\Api\Public\DistrictController;
use App\Http\Controllers\Api\Public\InquiryController;
use App\Http\Controllers\Api\Public\LocationController;
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
 * Functional today: search, detail, shop profile, categories, reviews,
 * inquiries, city browse. NOTE: pickup_at/return_at date-availability
 * filtering and vehicle comparison are still outstanding.
 */
Route::prefix('public')->group(function () {
    Route::get('vehicles', [VehicleController::class, 'index']);
    Route::get('vehicles/{slug}', [VehicleController::class, 'show']);
    Route::get('vehicles/{slug}/reviews', [VehicleController::class, 'reviews']);

    Route::get('shops', [ShopController::class, 'index']);
    Route::get('shops/{slug}', [ShopController::class, 'show']);
    Route::get('shops/{slug}/vehicles', [ShopController::class, 'vehicles']);
    Route::get('shops/{slug}/reviews', [ShopController::class, 'reviews']);

    Route::get('categories', [CategoryController::class, 'index']);
    Route::get('brands', [BrandController::class, 'index']);
    Route::get('models', [VehicleCatalogueController::class, 'models']);     // ?brand_id=
    Route::get('variants', [VehicleCatalogueController::class, 'variants']); // ?model_id=
    Route::get('colours', [VehicleCatalogueController::class, 'colours']);
    Route::get('locations', [LocationController::class, 'index']);
    Route::get('districts', [DistrictController::class, 'index']);

    // Contact-the-owner form on a vehicle detail page — rate-limited per
    // app-doc/marketplace/05-ui-and-api-map.md since it's reachable
    // anonymously.
    Route::post('inquiries', [InquiryController::class, 'store'])->middleware('throttle:5,1');
});
