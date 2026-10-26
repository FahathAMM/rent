<?php

use App\Http\Controllers\Api\Customer\AuthController as CustomerAuthController;
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
    });
});
