<?php

use App\Http\Controllers\Api\Customer\AuthController as CustomerAuthController;
use App\Http\Controllers\Api\Customer\BookingController;
use App\Http\Controllers\Api\Customer\DisputeController as CustomerDisputeController;
use App\Http\Controllers\Api\Customer\FavoriteController;
use App\Http\Controllers\Api\Customer\NotificationController as CustomerNotificationController;
use App\Http\Controllers\Api\Customer\ReviewController;
use App\Http\Controllers\Api\Customer\SaleEnquiryController as CustomerSaleEnquiryController;
use Illuminate\Support\Facades\Route;

// ─── Customer — entirely separate identity/guard from the vendor/owner/───────
// staff `users` table above; moved out to its own file for readability,
// same as routes/platform.php. A vendor/owner/staff token is rejected by
// the `customer` guard, and vice versa (see config/auth.php).
Route::prefix('customer')->group(function () {
    Route::post('send-otp', [CustomerAuthController::class, 'sendOtp'])->middleware('throttle:otp');
    Route::post('register', [CustomerAuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('login',    [CustomerAuthController::class, 'login'])->middleware('throttle:auth');

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
    // Before bookings/{booking}, or "summary" would be taken as a booking reference.
    Route::get('bookings/summary', [BookingController::class, 'summary']);
    Route::get('bookings/{booking:booking_reference}', [BookingController::class, 'show']);
    Route::post('bookings/{booking:booking_reference}/cancel', [BookingController::class, 'cancel']);
    Route::post('bookings/{booking:booking_reference}/transfers', [BookingController::class, 'submitTransfer']);
    Route::get('bookings/{booking:booking_reference}/voucher', [BookingController::class, 'voucher']);
    Route::get('bookings/{booking:booking_reference}/agreement', [BookingController::class, 'agreement']);
    Route::get('bookings/{booking:booking_reference}/transfers/{payment}/proof', [BookingController::class, 'transferProof']);

    // Customer's own reviews — Review has no BelongsToShop/ShopScope at
    // all (unlike Booking/Vehicle), so there is no scope-bypass concern
    // here the way there is for CustomerBookingQuery.
    Route::get('reviews', [ReviewController::class, 'index']);
    Route::post('reviews', [ReviewController::class, 'store']);

    Route::prefix('customer')->group(function () {
        Route::get('notifications', [CustomerNotificationController::class, 'index']);
        Route::post('notifications/read-all', [CustomerNotificationController::class, 'markAllRead']);
        Route::post('notifications/{id}/read', [CustomerNotificationController::class, 'markRead']);

        Route::get('disputes', [CustomerDisputeController::class, 'index']);
        Route::post('disputes', [CustomerDisputeController::class, 'store']);
        Route::get('disputes/{reference}', [CustomerDisputeController::class, 'show']);
        Route::post('disputes/{reference}/messages', [CustomerDisputeController::class, 'addMessage']);
    });

    // A buyer's enquiries about cars for sale — ownership by customer_id
    // through CustomerSaleQuery. See app-doc/marketplace/13-vehicle-sales.md.
    Route::get('sales/enquiries', [CustomerSaleEnquiryController::class, 'index']);
    Route::post('sales/enquiries', [CustomerSaleEnquiryController::class, 'store'])->middleware('throttle:10,1');
    Route::get('sales/enquiries/{reference}', [CustomerSaleEnquiryController::class, 'show']);
    Route::post('sales/enquiries/{reference}/messages', [CustomerSaleEnquiryController::class, 'reply'])->middleware('throttle:30,1');
    Route::post('sales/enquiries/{reference}/close', [CustomerSaleEnquiryController::class, 'close']);
    Route::get('sales/enquiries/{reference}/agreement', [CustomerSaleEnquiryController::class, 'agreement']);

    // Favorites — ownership by user_id, same reasoning as reviews. A
    // favorited vehicle may belong to any shop, so the lookup goes
    // through CustomerFavoriteQuery (the sanctioned bypass) rather than
    // a bare Vehicle::find(); {vehicle} below is always a plain id,
    // never Eloquent-bound, so ShopScope never gets a chance to fail
    // this closed for a customer with no shop context.
    Route::get('favorites', [FavoriteController::class, 'index']);
    Route::get('favorites/ids', [FavoriteController::class, 'ids']);
    Route::post('favorites/{vehicle}', [FavoriteController::class, 'store']);
    Route::delete('favorites/{vehicle}', [FavoriteController::class, 'destroy']);
});
