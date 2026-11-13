<?php

namespace App\Providers;

use App\Models\Administration\User;
use App\Models\Expense;
use App\Models\RentalShop;
use App\Models\Role;
use App\Models\Vehicle;
use App\Services\SmsService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Short, stable aliases for polymorphic relations (Attachment.attachable)
        // instead of leaking full namespaced class strings into the database and
        // API. Extended as new modules land.
        // Not enforced: Spatie's own model_has_roles/model_has_permissions
        // polymorphic pivots resolve User's morph class through this same
        // map, and User is intentionally not in it.
        Relation::morphMap([
            'expense' => Expense::class,
            'rental_shop' => RentalShop::class,
            'vehicle' => Vehicle::class,
        ]);

        // shop-owner can do everything in their shop: every vendor-* check passes.
        Gate::before(fn ($user, string $ability) => $user instanceof User && str_starts_with($ability, 'vendor-') && $user->hasRole(Role::SHOP_OWNER) ? true : null);

        // Login / register (vendor, customer, platform) — stops password guessing:
        // 5 tries a minute per email+IP, and 20 a minute per IP across all emails.
        RateLimiter::for('auth', function (Request $request) {
            $email = Str::lower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by('auth:' . $request->path() . '|' . $email . '|' . $request->ip()),
                Limit::perMinute(20)->by('auth-ip:' . $request->ip()),
            ];
        });

        // Sending an OTP costs an SMS: 1 a minute (5 an hour) per phone, 10 an hour per IP.
        RateLimiter::for('otp', function (Request $request) {
            $phone = SmsService::formatPhone($request->input('phone')) ?? (string) $request->input('phone');

            // Friendly error under the phone field instead of "Too Many Attempts."
            $tooMany = fn (string $msg) => fn (Request $r, array $headers) => response()->json([
                'message' => $msg,
                'errors' => ['phone' => [$msg]],
            ], 429, $headers);

            $limits = [
                Limit::perMinute(1)->by('otp:' . $phone)
                    ->response($tooMany(__('Please wait a minute before requesting another code.'))),
            ];

            // Hourly caps only on the live server, so local testing isn't blocked.
            if (! app()->isLocal()) {
                $limits[] = Limit::perHour(5)->by('otp-hour:' . $phone)
                    ->response($tooMany(__('Too many codes requested for this number. Please try again in an hour.')));
                $limits[] = Limit::perHour(10)->by('otp-ip:' . $request->ip())
                    ->response($tooMany(__('Too many codes requested. Please try again later.')));
            }

            return $limits;
        });
    }
}
