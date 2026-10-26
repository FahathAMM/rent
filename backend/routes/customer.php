<?php

use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\Customer\AuthController as CustomerAuthController;
use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\ReviewController;
use Illuminate\Support\Facades\Route;

// ─── Customer — entirely separate identity/guard from the vendor/owner/───────
// staff `users` table above; moved out to its own file for readability,
// same as routes/platform.php. A vendor/owner/staff token is rejected by
// the `customer` guard, and vice versa (see config/auth.php).
Route::prefix('customer')->group(function () {
    Route::post('register', [CustomerAuthController::class, 'register']);
    Route::post('login',    [CustomerAuthController::class, 'login']);

    Route::middleware('customer.auth')->group(function () {
        Route::post('logout', [CustomerAuthController::class, 'logout']);
        Route::get('me',      [CustomerAuthController::class, 'me']);
        Route::put('profile',         [CustomerAuthController::class, 'updateProfile']);
        Route::put('change-password', [CustomerAuthController::class, 'changePassword']);
    });
});

// Customer's own bookings — ownership by customer_id, no shop context
// needed at all. See BookingPolicy's docblock. Bound by
// booking_reference (not id) to match the human-facing {reference}
// URLs in app-doc/marketplace/05-ui-and-api-map.md.
Route::middleware('customer.auth')->group(function () {
    Route::get('bookings', [BookingController::class, 'index']);
    Route::post('bookings', [BookingController::class, 'store']);
    Route::get('bookings/{booking:booking_reference}', [BookingController::class, 'show']);
    Route::post('bookings/{booking:booking_reference}/checkout', [BookingController::class, 'checkout']);
    Route::post('bookings/{booking:booking_reference}/cancel', [BookingController::class, 'cancel']);

    // Customer's own reviews — Review has no BelongsToShop/ShopScope at
    // all (unlike Booking/Vehicle), so there is no scope-bypass concern
    // here the way there is for CustomerBookingQuery.
    Route::get('reviews', [ReviewController::class, 'index']);
    Route::post('reviews', [ReviewController::class, 'store']);

    // Favorites — ownership by user_id, same reasoning as reviews. A
    // favorited vehicle may belong to any shop, so the lookup goes
    // through CustomerFavoriteQuery (the sanctioned bypass) rather than
    // a bare Vehicle::find(); {vehicle} below is always a plain id,
    // never Eloquent-bound, so ShopScope never gets a chance to fail
    // this closed for a customer with no shop context.
    Route::get('favorites', [FavoriteController::class, 'index']);
    Route::post('favorites/{vehicle}', [FavoriteController::class, 'store']);
    Route::delete('favorites/{vehicle}', [FavoriteController::class, 'destroy']);
});
